# Vision QC AI Integration Blueprint

## Goal

Move Vision QC to a backend-owned AI architecture:

`web/mobile app -> backend API -> vision inference service -> vector retrieval -> response builder -> JSON result`

The frontend should stay thin and should not talk to external chat products.

## Frontend Changes In This Repo

### Keep

- Image upload and preview in `src/components/pages/web/WebScan.jsx`
- Alias and location metadata fields
- Rendering of diagnosis data such as disease, confidence, analysis, solution, prevention, products, care steps, and follow-up reminders

### Keep Out Of The Client

- External AI chat URLs
- Copy-prompt flows
- Prompt-building logic in the client

### More Info Chat

The More Info chat should call the backend `/chat` endpoint with scan context and the user's question. The backend owns the response logic.

### Frontend Contract

The scan page should call one backend endpoint and render a stable diagnosis payload:

```json
{
  "id": "scan-123",
  "disease": "Powdery Mildew",
  "confidence": 0.91,
  "analysis": "The leaf shows white powder-like fungal growth consistent with powdery mildew.",
  "solution": "Remove infected leaves, improve airflow, and avoid overhead watering.",
  "severityLevel": "Moderate",
  "recommendedProducts": ["Sulfur fungicide"],
  "careSteps": ["Prune affected areas", "Separate infected plants"],
  "prevention": "Reduce humidity buildup and inspect leaves regularly.",
  "rescanRecommended": true,
  "rescanDays": 7,
  "rescanReason": "A follow-up scan is recommended after treatment."
}
```

## Backend Endpoints

### 1. Scan And Diagnose

Recommended endpoint:

`POST /api/v1/users/me/scans`

Request:

- `multipart/form-data`
- `image`: image file
- `alias`: string
- `location`: string optional

Behavior:

- Validate request
- Store uploaded image or image reference
- Call vision inference service
- Query vector knowledge layer
- Build final user-facing response
- Save scan record
- Return normalized diagnosis payload

### 2. Scan History

`GET /api/v1/users/me/scans`

Returns saved scan results using the same response shape where practical.

### 3. Optional Dedicated Inference Endpoint

If you want a split between diagnosis and persistence:

`POST /api/v1/ai/diagnose`

Use this only if needed for internal orchestration. The frontend should still prefer the main scan endpoint if the scan must be saved.

## Internal Backend Modules

### API Layer

- Accepts request
- Validates auth and multipart payload
- Calls orchestration service

### Scan Orchestrator

- Preprocess image
- Call vision service
- Query retrieval layer
- Build final response
- Save record

### Vision Inference Service

Input:

- image bytes or image URL

Output:

```json
{
  "predictedClass": "powdery_mildew",
  "confidence": 0.91,
  "topK": [
    { "label": "powdery_mildew", "confidence": 0.91 },
    { "label": "leaf_blight", "confidence": 0.06 }
  ]
}
```

### Vector Retrieval Service

Stores and retrieves disease knowledge:

- disease descriptions
- treatment steps
- prevention tips
- severity guidance
- plant-specific notes
- regional or environmental notes

### Response Builder

Takes:

- model prediction
- retrieved knowledge
- optional plant alias/location context

Builds:

- `analysis`
- `solution`
- `severityLevel`
- `recommendedProducts`
- `careSteps`
- `prevention`
- reminder guidance fields

Start with backend templates first. Add a local LLM later only if needed.

## Suggested Service Split

### Current Frontend Repo

- UI only
- Input capture
- Result rendering

### Existing Backend Repo

- Main API
- Auth
- Scan persistence
- Orchestration and response building

### Future Python Service

- Vision model inference
- Optional embedding generation utilities

## Example Backend Folder Structure

### .NET Backend

```text
src/
  Features/
    Scans/
      CreateScan/
      GetScanHistory/
    AI/
      Contracts/
      Orchestration/
      ResponseBuilder/
      Retrieval/
      Vision/
```

### Python Inference Service

```text
app/
  api/
    routes.py
  models/
    disease_classifier.py
  schemas/
    prediction.py
  services/
    inference.py
    preprocessing.py
  main.py
```

## Build Order

1. Keep current upload and diagnosis rendering flow
2. Standardize the diagnosis JSON contract
3. Remove client-side external chat flows
4. Implement backend template-based response builder
5. Plug in a mock vision service
6. Replace mock with trained model
7. Add vector retrieval
8. Fine-tune the model when dataset quality is good enough

## Notes For This Repo

- `src/lib/scans.js` should remain the main frontend entry point for saved scan submissions
- `src/lib/ai.js` can own AI payload normalization and any future dedicated AI-only calls
- `src/components/pages/web/WebScan.jsx` should assume the backend returns a full explanation already
