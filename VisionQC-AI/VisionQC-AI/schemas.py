from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, Field


"""
Shared response/data formats.

These schemas are the contract between backend files and the frontend.
They keep returned data consistent when it moves through:

    photo_quality.py -> main.py -> FastAPI JSON response -> frontend

They also help catch mistakes like wrong field names or wrong value types.
"""

#called in photo_quality.py
class PhotoQualityMetrics(BaseModel):
    blur: float
    brightness: float
    contrast: float
    width: int
    height: int

# called in photo_quality.py
class PhotoQualityReport(BaseModel):
    qualityScore: int = Field(ge=0, le=100)
    canDiagnose: bool
    issues: List[str] = Field(default_factory=list)
    metrics: PhotoQualityMetrics
    retakeAdvice: str

#called in plan_presence.py
class PlantPresenceReport(BaseModel):
    isPlantLike: bool
    confidence: float = Field(ge=0, le=1)
    plantColorRatio: float = Field(ge=0, le=1)
    greenRatio: float = Field(ge=0, le=1)
    documentLikeRatio: float = Field(ge=0, le=1)
    reason: str

#called in main.py
class PastScanSummary(BaseModel):
    scannedAt: str = ""
    disease: str = ""
    confidence: float | None = None
    analysis: str = ""
    solution: str = ""
    prevention: str = ""

#called in ollama_client.py
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)

#called in main.py
class MoreInfoChatRequest(BaseModel):
    alias: str = ""
    disease: str = ""
    confidence: float | None = None
    location: str | None = None
    analysis: str = ""
    solution: str = ""
    prevention: str = ""
    question: str = Field(min_length=1, max_length=1000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=12)

#called in main.py
class MoreInfoChatResponse(BaseModel):
    answer: str
    provider: str = "ollama"
    model: str | None = None

#called in /diagnose of the main.py
class DiagnoseResponse(BaseModel):
    # defining variables
    disease: str
    confidence: float
    analysis: str
    photoQuality: PhotoQualityReport
    provider: str = "local-model"

    # Backward-compatible fields for the current frontend
    solution: str = ""
    prevention: str = ""
    recommendedProducts: List[str] = Field(default_factory=list)
    careSteps: List[str] = Field(default_factory=list)
    rescanRecommended: bool = False
    rescanDays: int = 0
    rescanReason: str = ""
    model: str | None = None
    moreInfoChatUrl: str = "/chat"
