from __future__ import annotations

import json
from typing import Iterable

import requests

from schemas import ChatMessage, PastScanSummary, PhotoQualityReport


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3"
OLLAMA_REQUEST_TIMEOUT_SECONDS = 300


class OllamaUnavailableError(RuntimeError):
    pass

#converts a value to a non-negative integer when possible; invalid values return the default 0
def to_non_negative_int(value: object, default: int = 0) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default

#removes empty strings and duplicates
def clean_product_suggestions(suggestions: object) -> list[str]:
    cleaned: list[str] = []

    if isinstance(suggestions, list):
        for item in suggestions:
            product = str(item).strip()
            if not product:
                continue

            if product.lower() in {entry.lower() for entry in cleaned}:
                continue

            cleaned.append(product)

    return cleaned[:4]

# build the prompt that will be sent to ollama to generate a human readable explination
def build_prompt(
    label: str,
    confidence: float,
    quality_report: PhotoQualityReport,
    location: str | None,
    past_scans: Iterable[PastScanSummary] = (),
) -> str:
    #This loops through each past scan and converts it from a Pydantic model into a normal Python dictionary
    past_scan_context = [
        scan.model_dump(exclude_none=True)
        for scan in past_scans
    ]

    return f"""
You are a plant disease assistant.

Base everything ONLY on the provided inputs.
Do not claim you directly saw the image.
Do not invent symptoms or causes beyond the inputs.
Use beginner-friendly language.

Inputs:
- disease label: {label}
- confidence: {confidence:.4f}
- location: {location or "Unknown"}
- quality report: {quality_report.model_dump_json()}
- past scans for the same plant alias: {json.dumps(past_scan_context, ensure_ascii=False)}

Tasks:
1. Explain what the disease is in simple terms.
2. Explain common causes in simple terms.
3. Explain what to do next.
4. Explain when to worry.
5. Mention confidence ONLY if confidence is below 0.8.
6. Mention retake advice ONLY if photo quality is poor.
7. Suggest 2 to 4 practical product recommendations for the detected issue.
   - Each recommendation must include the useful active ingredient or product type, for example "contains copper hydroxide", "contains sulfur", "contains azoxystrobin", "contains mancozeb", "contains neem oil", or "insecticidal soap".
   - If you know a branded product that is commonly sold in Lebanon, you may include the brand name followed by the active ingredient in parentheses.
   - If you are not sure a brand is available in Lebanon, do not invent a brand. Give the active ingredient or product type only.
   - Do not use vague items like "plant treatment", "treatment", "spray", "medicine", "fungicide", or "pesticide" by themselves.
   - For healthy plants, suggest maintenance items only.
8. If past scans are provided, compare them with the current result for follow-up context only. Do not change the image diagnosis.

Return ONLY valid JSON in this exact format:
{{
  "what_it_is": "string",
  "causes": "string",
  "what_to_do": ["string", "string"],
  "when_to_worry": ["string", "string"],
  "product_suggestions": ["string", "string"],
  "should_rescan": true,
  "rescan_days": 7,
  "rescan_reason": "string"
}}
""".strip()
# dump() convert into a json and ensure_ascii=False means don’t escape non-English/special characters into Unicode codes

#Extract the jsonObject 
def extract_json_object(text: str) -> dict:
    #this make sure that the json is {} and not the wrong format
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No valid JSON object found in Ollama response.")
    #This takes only the JSON part from the text 
    #ya3ne it removes the prompt text like Sure, here is the JSON
    return json.loads(text[start : end + 1])


#this is the returned ui explination a polished (trimmed as text not content) version of ollama one
def generate_ai_explanation(
    label: str,
    confidence: float,
    quality_report: PhotoQualityReport,
    location: str | None,
    past_scans: Iterable[PastScanSummary] = (),
) -> dict:
    prompt = build_prompt(label, confidence, quality_report, location, past_scans)

    #this send the prompt to ollama and save the returned json
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "format": "json",
                "options": {
                    "num_predict": 500,
                    "temperature": 0.2,
                },
                # wait for the full answer instead of streaming chunks
                "stream": False,
            },
            # JSON-mode generation can be slow on the first local Ollama run.
            timeout=OLLAMA_REQUEST_TIMEOUT_SECONDS,
        )
        #Checks if the HTTP request succeeded 
        #if 404,500 error -> raises an exception
        response.raise_for_status()
        #if not convert the response from JSON into a Python dictionary , containing each line as key/value
        payload = response.json()
        # Gets the generated text from the "response" field, empty string as default
        raw_text = payload.get("response", "")
        #removes any extra text around the JSON 
        explanation = extract_json_object(raw_text)
    except Exception as exc:
        # Fail clearly instead of returning a generic fallback explanation.
        raise OllamaUnavailableError(
            "Ollama could not generate a valid diagnosis explanation. Make sure Ollama is running and try again."
        ) from exc

    #return ui fields
    return {
        "what_it_is": str(explanation.get("what_it_is", "")).strip(),
        "causes": str(explanation.get("causes", "")).strip(),
        "what_to_do": [
            str(item).strip()
            for item in explanation.get("what_to_do", [])
            if str(item).strip()
        ],
        "when_to_worry": [
            str(item).strip()
            for item in explanation.get("when_to_worry", [])
            if str(item).strip()
        ],
        "product_suggestions": clean_product_suggestions(explanation.get("product_suggestions", [])),
        "should_rescan": bool(explanation.get("should_rescan", False)),
        "rescan_days": to_non_negative_int(explanation.get("rescan_days", 0)),
        "rescan_reason": str(explanation.get("rescan_reason", "")).strip(),
    }

#built the more info prompt to gie to ollama
def build_more_info_chat_prompt(
    *,
    alias: str,
    disease: str,
    confidence: float | None,
    location: str | None,
    analysis: str,
    solution: str,
    prevention: str,
    question: str,
    history: Iterable[ChatMessage] = (),
) -> str:
    #convert all previous chats into one text block
    conversation = "\n".join(
        f"{message.role}: {message.content.strip()}"
        for message in history
        if message.content.strip()
    )
    #turns confidence into a percentage
    confidence_text = f"{confidence:.0%}" if isinstance(confidence, float) else "Unknown"
    #return prompt
    return f"""
You are VisionQC's plant care chatbot.

Sound friendly, calm, and conversational.
Answer the user's question using the scan context.
If the user is only greeting you or saying thanks, respond briefly and invite a plant-care question. Do not summarize the scan in that case.
Do not claim you directly saw the image.
Do not diagnose a new disease beyond the provided scan result.
Use simple, practical language for beginners.
If the detected issue is healthy, do not recommend removing leaves, fungicide, treatment, or disease control. Only suggest normal monitoring and good care.
If the user asks for unsafe chemical dosing, tell them to follow the product label.
If the plant seems to be rapidly worsening, recommend consulting a local plant expert.

Scan context:
- plant alias: {alias or "Unknown"}
- detected issue: {disease or "Unknown"}
- confidence: {confidence_text}
- location: {location or "Not provided"}
- analysis: {analysis or "Not provided"}
- suggested solution: {solution or "Not provided"}
- prevention/follow-up: {prevention or "Not provided"}

Recent chat:
{conversation or "No previous chat."}

User question:
{question}

Answer naturally in your own words.
""".strip()

#This function specify greeting word, so when the user say hello 
# it returns a generic sentence that say you can ask me about this and that , instead of calling ollama
def is_simple_chat_greeting(question: str) -> bool:
    normalized = question.strip().lower()
    normalized = normalized.strip("!.?,;: ")
    greetings = {
        "hi",
        "hello",
        "hey",
        "helo",
        "hllo",
        "yo",
        "good morning",
        "good afternoon",
        "good evening",
        "thanks",
        "thank you",
        "thx",
    }
    return normalized in greetings

#This request ollama answer
def generate_more_info_chat_answer(
    *,
    alias: str,
    disease: str,
    confidence: float | None,
    location: str | None,
    analysis: str,
    solution: str,
    prevention: str,
    question: str,
    history: Iterable[ChatMessage] = (),
) -> str:
    #function that specifies greeting words , to not call ollama for them, instead return a generic text
    if is_simple_chat_greeting(question):
        plant_text = f" about {alias}" if alias else ""
        disease_name = disease.strip() if disease else ""
        if disease_name and disease_name.lower() in {"healthy", "healthy plant"}:
            result_text = " and the healthy scan result"
        elif disease_name:
            result_text = f" and the {disease_name} result"
        else:
            result_text = ""
        return f"Hi! I can help with this scan{plant_text}{result_text}. You can ask me what it means, what to do next, or what signs you should keep an eye on."
    #if not hello , call ollama
    prompt = build_more_info_chat_prompt(
        alias=alias,
        disease=disease,
        confidence=confidence,
        location=location,
        analysis=analysis,
        solution=solution,
        prevention=prevention,
        question=question,
        history=history,
    )

    try:
        #send ollama a post request with our prompt
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                # wait for the full answer instead of streaming chunks
                "stream": False,
            },
            timeout=OLLAMA_REQUEST_TIMEOUT_SECONDS,
        )
        #checks the http status, if 200 continue, if not raise an error
        response.raise_for_status()
        #This converts the returned JSON response body from Ollama into a Python dictionary
        payload = response.json()
        # This extracts the "response" field from that dictionary
        answer = str(payload.get("response", "")).strip()
        if answer:
            #return the answer
            return answer
    except Exception as exc:
        raise OllamaUnavailableError(
            "Ollama is not reachable. Start Ollama and make sure the llama3 model is installed."
        ) from exc

    raise OllamaUnavailableError("Ollama returned an empty answer. Try again or restart Ollama.")
