# VisionQC-AI

Local AI backend for VisionQC plant diagnosis.

## What This Service Does

This service receives a plant image from the frontend, checks whether it looks like a plant, checks photo quality, runs the local trained model, asks Ollama for beginner-friendly explanations, and returns a JSON response that the frontend can display directly.

The backend is responsible for:

1. Photo quality analysis
2. Plant-image validation
3. Local model prediction
4. Ollama-generated explanation
5. More Info chat answers through Ollama

## Backend Flow

The backend flow is:

```text
frontend uploads image
  -> main.py validates the request
  -> plant_presence.py checks whether the image looks like a plant leaf
  -> photo_quality.py checks whether the image is good enough
  -> local_inference.py runs the trained model
  -> ollama_client.py generates readable guidance
  -> main.py returns final JSON to the frontend
```

## Responsibility Split

### `main.py`

This is the API/controller layer.

It:
- exposes `/health`
- exposes `/diagnose`
- exposes `/chat`
- validates uploaded image requests
- calls the inference layer
- calls Ollama for diagnosis explanations and More Info chat answers
- returns the final JSON response

It does not:
- run the model directly
- write the readable diagnosis text itself

### `local_inference.py`

This is the local model inference layer.

It:
- loads the checkpoint
- preprocesses the image
- runs the model
- returns label + confidence

### `photo_quality.py`

This checks:
- blur
- brightness
- contrast
- image resolution

It returns:
- quality score
- whether diagnosis should continue
- retake advice

### `plant_presence.py`

This checks whether the uploaded image looks plant-like before diagnosis continues.

### `ollama_client.py`

This asks a local Ollama model to generate:
- what it is
- causes
- what to do
- when to worry
- recommended products
- More Info chat replies

If Ollama is not reachable, returns bad JSON, times out, or returns an empty chat answer, the backend returns an error instead of using a generic fallback.

## Response Shape

The service returns JSON like this:

```json
{
  "disease": "Corn leaf blight",
  "analysis": "Corn leaf blight is a leaf disease that often spreads more easily in wet or humid conditions. It usually shows as long tan marks that expand across the leaf.",
  "solution": "Remove the worst affected leaves if possible. Use a matching plant treatment if the problem is spreading.",
  "confidence": 0.91,
  "recommendedProducts": ["Product containing copper hydroxide", "Product containing sulfur"],
  "careSteps": ["Remove the worst affected leaves if the plant can tolerate it", "Use a treatment that matches the diagnosis if needed"],
  "prevention": "Watch it closely over the next 7 days. Worry sooner if the spots spread fast or more leaves are affected.",
  "photoQuality": {
    "qualityScore": 88,
    "canDiagnose": true,
    "issues": [],
    "metrics": {
      "blur": 145.2,
      "brightness": 118.3,
      "contrast": 44.1,
      "width": 1024,
      "height": 768
    },
    "retakeAdvice": "The photo quality looks good enough for diagnosis."
  },
  "rescanRecommended": true,
  "rescanDays": 7,
  "rescanReason": "A follow-up scan helps confirm whether the problem is slowing.",
  "provider": "local-model",
  "model": "resnet18:dataset1_resnet18_best.pt",
  "moreInfoChatUrl": "/chat"
}
```

## Endpoints

### `GET /health`

Used by the frontend admin page to check whether the local AI service is running and which checkpoint is active.

### `POST /diagnose`

Accepts:
- `image` as multipart file
- `alias` as string
- `location` as optional string

Returns:
- model prediction
- confidence
- readable diagnosis guidance
- follow-up reminder details
- photo quality report
- More Info chat endpoint URL

If the local model confidence is below `0.5`, the request is rejected as not confident enough.

If Ollama cannot generate a valid explanation, the request returns `503 Service Unavailable`.

### `POST /chat`

Accepts JSON scan context and a follow-up question.

Returns:
- `answer`
- `provider`, currently `ollama`
- `model`, currently `llama3`

Simple greetings such as `hello` are answered locally without calling Ollama. Real follow-up questions are sent to Ollama.

## Environment Variables

To use the local Ollama explanation layer, make sure Ollama is running locally on:

```text
http://localhost:11434
```

The default Ollama model is:

```text
llama3
```

## Works On Us

Automated tests were removed. Validation is handled by the project team through manual checks, local API runs, Ollama checks, and compile/build commands.

## Summary

This service does not return raw model output alone.

It does this instead:

```text
image -> quality analysis -> model prediction -> readable explanation -> final JSON
```

That means the JSON is:
- structured for the frontend
- readable for the user
