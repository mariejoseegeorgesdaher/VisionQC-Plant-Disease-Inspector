const aiBaseUrl = (import.meta.env.VITE_AI_API_BASE_URL || "").replace(/\/$/, "");
const diagnoseEndpoint = import.meta.env.VITE_AI_DIAGNOSE_ENDPOINT || "/diagnose";
const healthEndpoint = import.meta.env.VITE_AI_HEALTH_ENDPOINT || "/health";

function isFileLike(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (typeof File !== "undefined" && value instanceof File) {
    return true;
  }

  return (
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    typeof value.type === "string" &&
    typeof value.arrayBuffer === "function"
  );
}

function isImageFile(value) {
  return isFileLike(value) && typeof value.type === "string" && value.type.startsWith("image/");
}

function resolveAiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

function toNullableNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function toTreatmentSellerArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const area = typeof entry.area === "string" ? entry.area.trim() : "";

      if (!name) {
        return null;
      }

      return {
        name,
        area,
      };
    })
    .filter(Boolean);
}

function toPhotoQualityReport(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const metrics = value.metrics && typeof value.metrics === "object" ? value.metrics : {};

  return {
    qualityScore: toNullableNumber(value.qualityScore),
    canDiagnose: Boolean(value.canDiagnose),
    issues: toStringArray(value.issues),
    metrics: {
      blur: toNullableNumber(metrics.blur),
      brightness: toNullableNumber(metrics.brightness),
      contrast: toNullableNumber(metrics.contrast),
      width: toNullableNumber(metrics.width),
      height: toNullableNumber(metrics.height),
    },
    retakeAdvice: typeof value.retakeAdvice === "string" ? value.retakeAdvice : "",
  };
}

export function normalizeDiagnosisResult(payload, fallback = {}) {
  if (!payload || typeof payload !== "object") {
    return {
      id: fallback.id || "",
      disease: "Unknown",
      confidence: null,
      analysis: "",
      solution: "",
      severityLevel: "",
      recommendedProducts: [],
      careSteps: [],
      prevention: "",
      rescanRecommended: false,
      rescanDays: 0,
      rescanReason: "",
      imageUrl: "",
      provider: "",
      model: "",
      treatmentSellers: [],
      photoQuality: null,
      moreInfoChatUrl: "",
    };
  }

  const confidence =
    toNullableNumber(payload.confidence) ??
    toNullableNumber(payload.confidenceScore) ??
    toNullableNumber(payload.score);

  const rescanDays = Number(payload.rescanDays ?? payload.recommendedRescanInDays);

  return {
    id: payload.id || payload.scanId || fallback.id || "",
    disease: payload.disease || payload.predictedClass || "Unknown",
    confidence,
    analysis: payload.analysis || payload.summary || "",
    solution: payload.solution || payload.recommendedAction || "",
    severityLevel: payload.severityLevel || payload.severity || "",
    recommendedProducts: toStringArray(payload.recommendedProducts),
    careSteps: toStringArray(payload.careSteps),
    prevention: payload.prevention || "",
    rescanRecommended: Boolean(
      payload.rescanRecommended ??
      payload.followUpRecommended ??
      payload.recommendedRescanInDays
    ),
    rescanDays: Number.isFinite(rescanDays) ? rescanDays : 0,
    rescanReason: payload.rescanReason || payload.followUpReason || "",
    imageUrl: payload.imageUrl || payload.image || fallback.imageUrl || "",
    provider: payload.provider || fallback.provider || "",
    model: payload.model || fallback.model || "",
    treatmentSellers: toTreatmentSellerArray(payload.treatmentSellers),
    photoQuality: toPhotoQualityReport(payload.photoQuality),
    moreInfoChatUrl: typeof payload.moreInfoChatUrl === "string" ? payload.moreInfoChatUrl : "",
  };
}

export async function fetchAiServiceHealth() {
  const urlPath = resolveAiUrl(healthEndpoint);
  const url = aiBaseUrl ? `${aiBaseUrl}${urlPath}` : urlPath;

  const response = await fetch(url, {
    method: "GET",
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload?.detail?.message ||
          payload?.detail ||
          payload?.message ||
          "AI service health check failed.";

    throw new Error(typeof message === "string" ? message : "AI service health check failed.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("AI service returned an unexpected health payload.");
  }

  return {
    status: typeof payload.status === "string" ? payload.status : "unknown",
    provider: typeof payload.provider === "string" ? payload.provider : "",
    model: typeof payload.model === "string" ? payload.model : "",
    cwd: typeof payload.cwd === "string" ? payload.cwd : "",
    envExists: Boolean(payload.env_exists),
    apiKeyLoaded: Boolean(payload.api_key_loaded),
    localModelCheckpoint: typeof payload.local_model_checkpoint === "string" ? payload.local_model_checkpoint : "",
    localModelCheckpointExists: Boolean(payload.local_model_checkpoint_exists),
    localModelLabels: typeof payload.local_model_labels === "string" ? payload.local_model_labels : "",
    localModelLabelsExists: Boolean(payload.local_model_labels_exists),
  };
}

export async function diagnosePlant({ imageFile, alias, location }) {
  if (!isImageFile(imageFile)) {
    throw new Error("Please upload a plant image.");
  }

  const normalizedAlias = (alias || "").trim();
  if (!normalizedAlias) {
    throw new Error("Please choose a plant alias.");
  }

  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("alias", normalizedAlias);

  const normalizedLocation = (location || "").trim();
  if (normalizedLocation) {
    formData.append("location", normalizedLocation);
  }

  const urlPath = resolveAiUrl(diagnoseEndpoint);
  const url = aiBaseUrl ? `${aiBaseUrl}${urlPath}` : urlPath;

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload?.detail?.message ||
          payload?.detail ||
          payload?.message ||
          "Plant diagnosis failed.";

    throw new Error(typeof message === "string" ? message : "Plant diagnosis failed.");
  }

  return normalizeDiagnosisResult(payload);
}
