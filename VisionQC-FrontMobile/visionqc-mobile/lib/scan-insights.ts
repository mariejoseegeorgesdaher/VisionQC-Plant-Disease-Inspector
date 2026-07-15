export type ScanLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export type QualityCheck = {
  key: 'blur' | 'lighting' | 'distance';
  label: string;
  state: 'good' | 'warning';
  summary: string;
  hint: string;
};

export type PickedImageMeta = {
  width?: number;
  height?: number;
  fileSize?: number;
};

export type ScanInsightFields = {
  disease?: string | null;
  scannedAt?: string;
  confidence?: number | null;
  confidenceLevel?: string | null;
  severityLevel?: string | null;
  urgencyLevel?: string | null;
  recommendedRescanInDays?: number | null;
  rescanRecommended?: boolean;
  rescanDays?: number | null;
  rescanReason?: string | null;
  followUpMessage?: string | null;
};

const DEFAULT_DISEASE_RESCAN_DAYS = 7;

// Treat common "healthy/no disease" backend labels as healthy, while rejecting invalid "no plant" results.
export function isHealthyDiagnosis(disease?: string | null): boolean {
  const value = (disease || '').trim().toLowerCase();

  if (!value || value.includes('no plant')) {
    return false;
  }

  return (
    value === 'healthy' ||
    value === 'healthy plant' ||
    value === 'no disease' ||
    value === 'none' ||
    value.includes('healthy') ||
    value.includes('no disease detected') ||
    value.includes('no obvious disease detected')
  );
}

function normalizeLevel(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatConfidence(value?: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return `${Math.round(value * 100)}%`;
}

function formatDayCount(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`;
}

// Default follow-up copy used when the backend gives days but no custom reason/message.
export function buildFollowUpMessage(days: number): string {
  return `After you start treatment, re-scan this plant in ${formatDayCount(days)}. We'll remind you when it's time.`;
}

// Pick the best re-scan window from backend fields, then fall back to a default for diseased scans.
export function getRecommendedRescanInDays(scan: ScanInsightFields): number | null {
  if (isHealthyDiagnosis(scan.disease)) {
    return null;
  }

  if (scan.rescanRecommended === false) {
    return null;
  }

  if (typeof scan.rescanDays === 'number' && Number.isFinite(scan.rescanDays)) {
    return Math.max(1, Math.round(scan.rescanDays));
  }

  if (typeof scan.recommendedRescanInDays === 'number' && Number.isFinite(scan.recommendedRescanInDays)) {
    return Math.max(1, Math.round(scan.recommendedRescanInDays));
  }

  return scan.disease ? DEFAULT_DISEASE_RESCAN_DAYS : null;
}

// Prefer backend-written follow-up text, otherwise generate a safe default message from the re-scan window.
export function getFollowUpMessage(scan: ScanInsightFields): string | null {
  const rescanReason = scan.rescanReason?.trim();
  if (rescanReason) return rescanReason;

  const explicitMessage = scan.followUpMessage?.trim();
  if (explicitMessage) return explicitMessage;

  const days = getRecommendedRescanInDays(scan);
  return days ? buildFollowUpMessage(days) : null;
}

// Convert scan date + recommended re-scan days into a display label for cards/details.
export function getFollowUpDateLabel(scan: ScanInsightFields): string | null {
  const days = getRecommendedRescanInDays(scan);
  if (!days || !scan.scannedAt) return null;

  const scannedAt = new Date(scan.scannedAt);
  if (Number.isNaN(scannedAt.getTime())) return null;

  const dueDate = new Date(scannedAt);
  dueDate.setDate(dueDate.getDate() + days);

  return dueDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Build the compact facts shown in scan result cards, skipping fields the backend did not provide.
export function getResultHighlights(scan: ScanInsightFields) {
  return [
    { label: 'Confidence', value: formatConfidence(scan.confidence) || normalizeLevel(scan.confidenceLevel) },
    { label: 'Severity', value: normalizeLevel(scan.severityLevel) },
    { label: 'Urgency', value: normalizeLevel(scan.urgencyLevel) },
  ].filter((item): item is { label: string; value: string } => !!item.value);
}

// Estimate basic photo quality from local image metadata before sending it to the backend.
export function assessPickedImageQuality(image?: PickedImageMeta | null): QualityCheck[] {
  if (!image) return [];

  const width = image.width ?? 0;
  const height = image.height ?? 0;
  const shortestSide = width && height ? Math.min(width, height) : 0;
  const pixels = width * height;
  const bytesPerPixel =
    image.fileSize && pixels ? image.fileSize / pixels : null;

  // These are lightweight hints, not real computer vision checks; the backend remains the source of truth.
  const blurWarning = shortestSide > 0 && (shortestSide < 900 || (bytesPerPixel !== null && bytesPerPixel < 0.09));
  const lightingWarning = bytesPerPixel !== null && bytesPerPixel < 0.055;
  const distanceWarning = shortestSide > 0 && shortestSide < 1100;

  return [
    {
      key: 'blur',
      label: 'Blur',
      state: blurWarning ? 'warning' : 'good',
      summary: blurWarning ? 'Needs a sharper photo' : 'Looks detailed enough',
      hint: blurWarning ? 'Hold steady and keep the leaf in clear focus.' : 'Leaf details should be visible for analysis.',
    },
    {
      key: 'lighting',
      label: 'Lighting',
      state: lightingWarning ? 'warning' : 'good',
      summary: lightingWarning ? 'May be too dark' : 'Lighting looks usable',
      hint: lightingWarning ? 'Use brighter, even light and avoid deep shadows.' : 'Good light should help detection stay reliable.',
    },
    {
      key: 'distance',
      label: 'Distance',
      state: distanceWarning ? 'warning' : 'good',
      summary: distanceWarning ? 'Move closer to the plant' : 'Subject looks close enough',
      hint: distanceWarning ? 'Fill more of the frame with the affected area.' : 'The plant should be large enough in the frame.',
    },
  ];
}
