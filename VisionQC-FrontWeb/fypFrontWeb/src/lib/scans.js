import { apiRequest } from "./api";
import { getCachedOrLoad, invalidateCachePrefix } from "./cache";
import { normalizeDiagnosisResult } from "./ai";

const scansEndpoint = import.meta.env.VITE_SCANS_ENDPOINT || "/api/v1/users/me/scans";
const adminScansEndpoint = import.meta.env.VITE_ADMIN_SCANS_ENDPOINT || "/api/v1/admin/scans";

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

function normalizeErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to save the scan.";
}

export async function createScan({ imageFile, alias, location }) {
  if (!isImageFile(imageFile)) {
    throw new Error("Please upload a plant image.");
  }

  const normalizedAlias = (alias || "").trim();
  if (!normalizedAlias) {
    throw new Error("Please choose or enter a plant alias.");
  }

  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("alias", normalizedAlias);

  const normalizedLocation = (location || "").trim();
  if (normalizedLocation) {
    formData.append("location", normalizedLocation);
  }

  try {
    const result = await apiRequest(scansEndpoint, {
      method: "POST",
      body: formData,
    });
    invalidateCachePrefix("scans:");
    return normalizeDiagnosisResult(result);
  } catch (error) {
    throw new Error(normalizeErrorMessage(error));
  }
}

function normalizeScan(scan, index = 0) {
  const normalizedDiagnosis = normalizeDiagnosisResult(scan, {
    id: `scan-${index}`,
  });

  return {
    ...normalizedDiagnosis,
    id: normalizedDiagnosis.id || `scan-${index}`,
    alias: scan?.plantAlias || scan?.alias || "Unknown Alias",
    location: scan?.location || "",
    scannedAt: scan?.scannedAt || scan?.date || "",
  };
}

export async function fetchScanHistory({ alias } = {}) {
  const normalizedAlias = (alias || "").trim();
  const query = normalizedAlias ? `?alias=${encodeURIComponent(normalizedAlias)}` : "";
  const cacheKey = `scans:history:${query || "all"}`;

  return getCachedOrLoad(cacheKey, async () => {
    const payload = await apiRequest(`${scansEndpoint}${query}`, {
      method: "GET",
    });

    const rawScans = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.scans)
          ? payload.scans
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

    return rawScans.map((scan, index) => normalizeScan(scan, index));
  });
}

export async function fetchAdminScans() {
  return getCachedOrLoad("scans:admin", async () => {
    const payload = await apiRequest(adminScansEndpoint, {
      method: "GET",
    });

    const rawScans = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.scans)
          ? payload.scans
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

    return rawScans.map((scan, index) => normalizeScan(scan, index));
  });
}
