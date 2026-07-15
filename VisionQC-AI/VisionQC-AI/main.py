from __future__ import annotations

import json
import os
#logging is used to print backend logs
import logging

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from local_inference import classify_image, get_local_model_paths, humanize_label
from ollama_client import (
    OLLAMA_MODEL,
    OLLAMA_URL,
    OllamaUnavailableError,
    generate_ai_explanation,
    generate_more_info_chat_answer,
)
from plant_presence import analyze_plant_presence
from photo_quality import analyze_photo_quality
from schemas import DiagnoseResponse, MoreInfoChatRequest, MoreInfoChatResponse, PastScanSummary

"""
VisionQC API entry flow
=======================

This file is the HTTP/API layer for the local AI service.

Backend flow:

    frontend uploads image
      -> main.py validates the request
      -> plant_presence.py checks whether the image looks like a plant leaf
      -> photo_quality.py evaluates whether the image is usable
      -> local_inference.py runs the model
      -> ollama_client.py generates a readable explanation
    -> main.py returns the final JSON response
"""

# creating the logger and printing the info , waring , error and critical when having values
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("visionqc-ai")

# creating the fastAPI 
app = FastAPI(title="VisionQC AI Annotator", version="2.0.0")

MIN_DIAGNOSIS_CONFIDENCE = 0.5

# join_sentences function that receives a list of strings and returns one string
def join_sentences(items: list[str]) -> str:
    return " ".join(item.strip().rstrip(".") + "." for item in items if item.strip())


#this function converts pastScans that comes in as json into a list of structured PastScanSummary objects.
def parse_past_scans(raw_past_scans: str | None) -> list[PastScanSummary]:
    #If no past scans were sent or values not string , return an empty list
    if not raw_past_scans or not isinstance(raw_past_scans, str):
        return []

    try:
        #convert the json into a Pydantic  object
        # Because Pydantic checks the shape/types and gives you a clean object.
        payload = json.loads(raw_past_scans)
    except json.JSONDecodeError as exc:
        #If the string is not valid JSON, catch the error
        raise HTTPException(status_code=400, detail="pastScans must be valid JSON.") from exc

    if not isinstance(payload, list):
        #This means the caller sent invalid data
        raise HTTPException(status_code=400, detail="pastScans must be a JSON array.")

    try:
        #This converts each item in the list into a PastScanSummary and take the first 5 scans
        return [PastScanSummary.model_validate(item) for item in payload[:5]]
    except Exception as exc:
        #If any item is badly shaped, return a 400 error.
        raise HTTPException(status_code=400, detail=f"Invalid pastScans item: {exc}") from exc

#checks whether the backend is alive and whether the local model files exist
#this function is ran when /health get request is called
@app.get("/health")
def health() -> dict:
    #values of model checkpoint and labels paths , function found in local_inference.py
    local_checkpoint, local_labels = get_local_model_paths()
    return {
        "status": "ok",
        #local host and not online API
        "provider": "local-model",
        #file name
        "model": str(local_checkpoint.name),
        #server directory
        "cwd": os.getcwd(),
        #casting the model checkpoint to a string
        "local_model_checkpoint": str(local_checkpoint),
        #making sure the path exists
        "local_model_checkpoint_exists": local_checkpoint.exists(),
        #casting the label path to a string
        "local_model_labels": str(local_labels),
        #making sure the path exists
        "local_model_labels_exists": local_labels.exists(),
        #ollama url saved from import
        "ollama_url": OLLAMA_URL,
    }

#the result of this function are returned in DiagnoseResponse structure (function found in schemas.py)
@app.post("/diagnose", response_model=DiagnoseResponse)
async def diagnose(
    # image is a FastAPI UploadFile object; alias and location are form values parsed by FastAPI
    #... means required and None optional
    image: UploadFile = File(...),
    alias: str = Form(...),
    location: str | None = Form(None),
    pastScans: str | None = Form(None),
) -> DiagnoseResponse:
    #specifying the info log 
    logger.info(
        "Received diagnose request alias=%s location=%s filename=%s content_type=%s",
        alias,
        location or "Unknown",
        image.filename,
        image.content_type,
    )

    #additional validation related to the image
    #additional because there are validation are done in the front and back ends
    #exception are returned to who called /diagnose

    #raise an exception if the file received is not an image
    #content_type is a property/attribute of FastAPI’s UploadFile object that returns the file type
    #here we are checking if content_type is empty or don't start with image/
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed.")

    # the image file is read and its content is saved as bytes so it can be transferred between files
    image_bytes = await image.read()
    #if no content in image_bytes, raise an exception
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file.")

    #parsing last scans
    past_scans = parse_past_scans(pastScans)

    #analyze_plant_presence method found in plant_presence.py
    try:
        #analyse green/yellow/brown colors presences , so checks if the image looks like a plant 
        plant_presence = analyze_plant_presence(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    #raise an error if its not like a plant image
    if not plant_presence.isPlantLike:
        raise HTTPException(
            status_code=400,
            detail="This is not a valid plant image. Please upload a valid plant picture in PNG, JPG, or JPEG format.",
        )

    #analyze photo quality with analyze_photo_quality function from photo_quality.py
    try:
        #analyse photo blur, brightness, contrast
        photo_quality = analyze_photo_quality(image_bytes)
    except Exception as exc:
        #raise an Exception if image not valid
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    try:
        #label image with classify_image found in local_inference.py
        raw_label, confidence, architecture = classify_image(image_bytes)
    except Exception as exc:
        #raise an Exception and print it if fail to classify plant 
        logger.exception("Local inference failed for alias=%s", alias)
        raise HTTPException(status_code=500, detail=f"Local inference failed: {exc}") from exc

    if confidence < MIN_DIAGNOSIS_CONFIDENCE:
        raise HTTPException(
            status_code=400,
            detail="Please upload a clear plant leaf image. The AI was not confident enough to diagnose this file.",
        )

    #humanize label via humanize_label function found in local_inference.py
    disease = humanize_label(raw_label)

    #generate readable explination using ollama
    try:
        explanation = generate_ai_explanation(
            label=disease,
            confidence=confidence,
            quality_report=photo_quality,
            location=location,
            past_scans=past_scans,
        )
    except OllamaUnavailableError as exc:
        logger.exception("Ollama explanation failed for alias=%s", alias)
        #raise an error if ollama didn't return a proper response
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    #append explanation of what it is + possible causes
    analysis_parts = [explanation["what_it_is"], explanation["causes"]]
    #Combines the analysis parts into one string, if part skips empty values
    analysis = " ".join(part for part in analysis_parts if part)
    # join what to do into a solution string
    solution = join_sentences(explanation["what_to_do"])
    #join when to worry array into a prevention string
    prevention = join_sentences(explanation["when_to_worry"])
    
    #return all fields
    return DiagnoseResponse(
        disease=disease,
        confidence=confidence,
        analysis=analysis,
        photoQuality=photo_quality,
        provider="local-model",
        solution=solution,
        prevention=prevention,
        recommendedProducts=explanation["product_suggestions"],
        careSteps=explanation["what_to_do"],
        rescanRecommended=explanation["should_rescan"],
        rescanDays=explanation["rescan_days"],
        rescanReason=explanation["rescan_reason"],
        model=f"{architecture}:{get_local_model_paths()[0].name}",
        moreInfoChatUrl="/chat",
    )


@app.post("/chat", response_model=MoreInfoChatResponse)
def more_info_chat(request: MoreInfoChatRequest) -> MoreInfoChatResponse:
    try:
        #giving ollama all the field so it can understand the context
        answer = generate_more_info_chat_answer(
            alias=request.alias,
            disease=request.disease,
            confidence=request.confidence,
            location=request.location,
            analysis=request.analysis,
            solution=request.solution,
            prevention=request.prevention,
            question=request.question,
            history=request.history,
        )
    except OllamaUnavailableError as exc:
        logger.exception("Ollama chat failed for alias=%s", request.alias)
        #if ollama fails for whatever reasons, raise the error
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return MoreInfoChatResponse(
        #returns the answer for users, 
        # the provider who is ollama here and the ollama model , useful for debugging
        answer=answer,
        provider="ollama",
        model=OLLAMA_MODEL,
    )
