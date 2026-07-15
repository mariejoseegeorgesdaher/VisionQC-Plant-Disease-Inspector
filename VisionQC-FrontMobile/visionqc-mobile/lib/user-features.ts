import { apiRequest } from '@/lib/api';
import { setCachedCurrentUser } from '@/lib/current-user-cache';
import { getAuthToken } from '@/lib/auth';
import { getCurrentUser, type MeResponse } from '@/lib/user';

// User feature API layer: screens call these functions instead of calling fetch directly.
const INVALID_IMAGE_MESSAGE = 'Please choose a valid plant photo from your camera or gallery.';
const SCAN_ANALYSIS_TIMEOUT_MS = 180000;

export type ScanListItem = {
  id: string;
  plantAlias: string;
  location?: string | null;
  scannedAt: string;
  disease?: string | null;
  confidence?: number | null;
  analysis?: string | null;
  solution?: string | null;
  severityLevel?: string | null;
  urgencyLevel?: string | null;
  recommendedProducts?: string[];
  careSteps?: string[];
  prevention?: string | null;
  rescanRecommended?: boolean;
  rescanDays?: number | null;
  rescanReason?: string | null;
  moreInfoChatUrl?: string | null;
  imageUrl: string;
};

export type ScanDetails = {
  id: string;
  plantAlias: string;
  location?: string | null;
  scannedAt: string;
  disease?: string | null;
  confidence?: number | null;
  severityLevel?: string | null;
  urgencyLevel?: string | null;
  recommendedRescanInDays?: number | null;
  rescanRecommended?: boolean;
  rescanDays?: number | null;
  rescanReason?: string | null;
  followUpMessage?: string | null;
  analysis?: string | null;
  solution?: string | null;
  recommendedProducts?: string[];
  careSteps?: string[];
  prevention?: string | null;
  moreInfoChatUrl?: string | null;
  imageUrl: string;
};

export type PlantAliasItem = {
  id: string;
  alias: string;
  location?: string | null;
  createdAt: string;
  updatedAt: string;
  lastScannedAt?: string | null;
  scanCount: number;
  latestScanId?: string | null;
  latestDisease?: string | null;
  latestConfidence?: number | null;
  latestAnalysis?: string | null;
  latestSolution?: string | null;
  latestSeverityLevel?: string | null;
  latestUrgencyLevel?: string | null;
  latestRecommendedProducts?: string[];
  latestCareSteps?: string[];
  latestPrevention?: string | null;
  latestRescanRecommended?: boolean;
  latestRescanDays?: number | null;
  latestRescanReason?: string | null;
  latestImageUrl?: string | null;
};

function toNullableNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

// Backend scan responses may use slightly different property names; normalize them into one app shape.
function normalizeScanPayload(scan: unknown, fallbackId = ''): ScanDetails {
  if (!scan || typeof scan !== 'object') {
    return {
      id: fallbackId,
      plantAlias: 'Unknown Alias',
      location: '',
      scannedAt: '',
      disease: 'Unknown',
      confidence: null,
      severityLevel: '',
      urgencyLevel: '',
      recommendedRescanInDays: null,
      rescanRecommended: false,
      rescanDays: 0,
      rescanReason: '',
      followUpMessage: '',
      analysis: '',
      solution: '',
      recommendedProducts: [],
      careSteps: [],
      prevention: '',
      moreInfoChatUrl: '',
      imageUrl: '',
    };
  }

  const payload = scan as Record<string, unknown>;
  const confidence =
    toNullableNumber(payload.confidence) ??
    toNullableNumber(payload.confidenceScore) ??
    toNullableNumber(payload.score);
  const rescanDays =
    toNullableNumber(payload.rescanDays) ??
    toNullableNumber(payload.recommendedRescanInDays);

  return {
    id: String(payload.id || payload.scanId || fallbackId || ''),
    plantAlias: String(payload.plantAlias || payload.alias || 'Unknown Alias'),
    location: typeof payload.location === 'string' ? payload.location : '',
    scannedAt: String(payload.scannedAt || payload.date || ''),
    disease: typeof payload.disease === 'string' ? payload.disease : typeof payload.predictedClass === 'string' ? payload.predictedClass : 'Unknown',
    confidence,
    severityLevel:
      typeof payload.severityLevel === 'string'
        ? payload.severityLevel
        : typeof payload.severity === 'string'
          ? payload.severity
          : '',
    urgencyLevel:
      typeof payload.urgencyLevel === 'string'
        ? payload.urgencyLevel
        : typeof payload.urgency === 'string'
          ? payload.urgency
          : '',
    recommendedRescanInDays: rescanDays,
    rescanRecommended: Boolean(
      payload.rescanRecommended ??
      payload.followUpRecommended ??
      payload.recommendedRescanInDays ??
      payload.rescanDays
    ),
    rescanDays,
    rescanReason:
      typeof payload.rescanReason === 'string'
        ? payload.rescanReason
        : typeof payload.followUpReason === 'string'
          ? payload.followUpReason
          : '',
    followUpMessage:
      typeof payload.followUpMessage === 'string'
        ? payload.followUpMessage
        : typeof payload.rescanReason === 'string'
          ? payload.rescanReason
          : '',
    analysis:
      typeof payload.analysis === 'string'
        ? payload.analysis
        : typeof payload.summary === 'string'
          ? payload.summary
          : '',
    solution:
      typeof payload.solution === 'string'
        ? payload.solution
        : typeof payload.recommendedAction === 'string'
          ? payload.recommendedAction
          : '',
    recommendedProducts: toStringArray(payload.recommendedProducts),
    careSteps: toStringArray(payload.careSteps),
    prevention: typeof payload.prevention === 'string' ? payload.prevention : '',
    moreInfoChatUrl: typeof payload.moreInfoChatUrl === 'string' ? payload.moreInfoChatUrl : '',
    imageUrl:
      typeof payload.imageUrl === 'string'
        ? payload.imageUrl
        : typeof payload.image === 'string'
          ? payload.image
          : '',
  };
}

// Plant alias responses also get normalized so the plants screen can render one stable type.
function normalizePlantAlias(payload: unknown, index = 0): PlantAliasItem {
  if (!payload || typeof payload !== 'object') {
    return {
      id: `plant-alias-${index}`,
      alias: 'Unnamed Alias',
      location: '',
      createdAt: '',
      updatedAt: '',
      lastScannedAt: '',
      scanCount: 0,
      latestScanId: '',
      latestDisease: '',
      latestConfidence: null,
      latestAnalysis: '',
      latestSolution: '',
      latestSeverityLevel: '',
      latestUrgencyLevel: '',
      latestRecommendedProducts: [],
      latestCareSteps: [],
      latestPrevention: '',
      latestRescanRecommended: false,
      latestRescanDays: 0,
      latestRescanReason: '',
      latestImageUrl: '',
    };
  }

  const alias = payload as Record<string, unknown>;
  return {
    id: String(alias.id || alias.aliasId || alias.plantAliasId || `plant-alias-${index}`),
    alias: String(alias.alias || alias.name || alias.aliasName || alias.displayName || 'Unnamed Alias'),
    location: typeof alias.location === 'string' ? alias.location : typeof alias.primaryLocation === 'string' ? alias.primaryLocation : '',
    createdAt: String(alias.createdAt || alias.createdOn || ''),
    updatedAt: String(alias.updatedAt || alias.modifiedAt || alias.lastUpdated || ''),
    lastScannedAt: typeof alias.lastScannedAt === 'string' ? alias.lastScannedAt : '',
    scanCount: Number(alias.scanCount ?? alias.totalScans ?? alias.usageCount ?? alias.linkedScans ?? 0) || 0,
    latestScanId: typeof alias.latestScanId === 'string' ? alias.latestScanId : '',
    latestDisease: typeof alias.latestDisease === 'string' ? alias.latestDisease : '',
    latestConfidence:
      toNullableNumber(alias.latestConfidence) ??
      toNullableNumber(alias.latestConfidenceScore),
    latestAnalysis: typeof alias.latestAnalysis === 'string' ? alias.latestAnalysis : '',
    latestSolution: typeof alias.latestSolution === 'string' ? alias.latestSolution : '',
    latestSeverityLevel:
      typeof alias.latestSeverityLevel === 'string'
        ? alias.latestSeverityLevel
        : '',
    latestUrgencyLevel:
      typeof alias.latestUrgencyLevel === 'string'
        ? alias.latestUrgencyLevel
        : '',
    latestRecommendedProducts: toStringArray(alias.latestRecommendedProducts),
    latestCareSteps: toStringArray(alias.latestCareSteps),
    latestPrevention: typeof alias.latestPrevention === 'string' ? alias.latestPrevention : '',
    latestRescanRecommended: Boolean(alias.latestRescanRecommended ?? alias.latestRescanDays),
    latestRescanDays: toNullableNumber(alias.latestRescanDays),
    latestRescanReason: typeof alias.latestRescanReason === 'string' ? alias.latestRescanReason : '',
    latestImageUrl: typeof alias.latestImageUrl === 'string' ? alias.latestImageUrl : '',
  };
}

function requireToken(): string {
  // Most user features are protected routes, so we fail early if no token exists.
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}

function isValidImageMimeType(mimeType?: string): boolean {
  return !!mimeType && /^image\/(png|jpe?g|webp|heic|heif)$/i.test(mimeType);
}

// Builds a URL with query parameters, used when filtering list endpoints.
function withQuery(path: string, params: Record<string, string | undefined>) {
  // This helper keeps list-filter query building neat and reusable.
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

// Profile update is a PATCH because only the changed account fields are sent.
export async function updateMyProfile(fullName: string): Promise<{ message: string }> {
  const token = requireToken();
  const response = await apiRequest<MeResponse & { message?: string }>('/api/v1/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ fullName: fullName.trim() }),
  }, token);
  // Update the in-memory profile cache so the UI reflects the edit immediately.
  setCachedCurrentUser(response);
  return { message: response.message || 'Profile updated successfully' };
}

export async function changeMyPassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
  const token = requireToken();
  return apiRequest('/api/v1/users/me/password', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword }),
  }, token);
}

export async function getMyAliases(): Promise<string[]> {
  const token = requireToken();
  return apiRequest('/api/v1/users/me/aliases', {}, token);
}

export async function getMyPlantAliases(): Promise<PlantAliasItem[]> {
  const token = requireToken();
  const payload = await apiRequest('/api/v1/users/me/plants', {}, token);
  // Accept several common list wrappers so frontend does not break if backend shape changes slightly.
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown[] })?.items)
      ? (payload as { items: unknown[] }).items
      : Array.isArray((payload as { plantAliases?: unknown[] })?.plantAliases)
        ? (payload as { plantAliases: unknown[] }).plantAliases
        : Array.isArray((payload as { aliases?: unknown[] })?.aliases)
          ? (payload as { aliases: unknown[] }).aliases
          : Array.isArray((payload as { data?: unknown[] })?.data)
            ? (payload as { data: unknown[] }).data
            : [];

  return items.map((item, index) => normalizePlantAlias(item, index));
}

export async function createMyPlantAlias(input: {
  alias: string;
  location?: string;
}): Promise<PlantAliasItem | { message: string }> {
  const token = requireToken();
  const payload = await apiRequest('/api/v1/users/me/plants', {
    method: 'POST',
    body: JSON.stringify({
      alias: input.alias.trim(),
      location: input.location?.trim() || undefined,
    }),
  }, token);

  return payload && typeof payload === 'object' && 'message' in (payload as Record<string, unknown>)
    ? payload as { message: string }
    : normalizePlantAlias(payload);
}

export async function updateMyPlantAlias(
  plantId: string,
  input: {
    alias: string;
    location?: string;
  }
): Promise<PlantAliasItem | { message: string }> {
  const token = requireToken();
  const payload = await apiRequest(`/api/v1/users/me/plants/${plantId}`, {
    method: 'PUT',
    body: JSON.stringify({
      alias: input.alias.trim(),
      location: input.location?.trim() || undefined,
    }),
  }, token);

  return payload && typeof payload === 'object' && 'message' in (payload as Record<string, unknown>)
    ? payload as { message: string }
    : normalizePlantAlias(payload);
}

export async function deleteMyPlantAlias(plantId: string): Promise<{ message: string }> {
  const token = requireToken();
  return apiRequest(`/api/v1/users/me/plants/${plantId}`, {
    method: 'DELETE',
  }, token);
}

export async function createMyScan(input: {
  alias: string;
  location?: string;
  imageUri: string;
  mimeType?: string;
  fileName?: string;
}): Promise<ScanDetails> {
  const token = requireToken();
  const mimeType = input.mimeType || 'image/jpeg';
  if (!isValidImageMimeType(mimeType)) {
    throw new Error(INVALID_IMAGE_MESSAGE);
  }

  // Multipart FormData is used because the request sends both text fields and an image file.
  const form = new FormData();

  form.append('alias', input.alias.trim());
  if (input.location?.trim()) {
    form.append('location', input.location.trim());
  }

  form.append('image', {
    uri: input.imageUri,
    type: mimeType,
    name: input.fileName || `scan-${Date.now()}.jpg`,
  } as unknown as Blob);

  // Scan analysis waits on image upload, local model inference, and Ollama explanation generation.
  const payload = await apiRequest('/api/v1/users/me/scans', {
    method: 'POST',
    body: form,
  }, token, SCAN_ANALYSIS_TIMEOUT_MS);
  return normalizeScanPayload(payload);
}

export async function getMyScans(filters?: {
  from?: string;
  to?: string;
  alias?: string;
  location?: string;
}): Promise<ScanListItem[]> {
  const token = requireToken();
  // History filtering is translated into query-string parameters only when values exist.
  const path = withQuery('/api/v1/users/me/scans', {
    from: filters?.from,
    to: filters?.to,
    alias: filters?.alias,
    location: filters?.location,
  });

  const payload = await apiRequest(path, {}, token);
  // History endpoint can return either a raw array or a wrapped collection.
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown[] })?.items)
      ? (payload as { items: unknown[] }).items
      : Array.isArray((payload as { scans?: unknown[] })?.scans)
        ? (payload as { scans: unknown[] }).scans
        : Array.isArray((payload as { data?: unknown[] })?.data)
          ? (payload as { data: unknown[] }).data
          : [];

  return items.map((item, index) => normalizeScanPayload(item, `scan-${index}`));
}

export async function getMyScanDetails(scanId: string): Promise<ScanDetails> {
  const token = requireToken();
  const payload = await apiRequest(`/api/v1/users/me/scans/${scanId}`, {}, token);
  return normalizeScanPayload(payload, scanId);
}

export async function refreshMe(): Promise<MeResponse> {
  requireToken();
  // Shared user loading already handles caching and request de-duplication.
  return getCurrentUser({ force: true });
}
