// This file turns raw backend/network errors into more human-readable messages before screens display them.
import { env } from '@/lib/env';

// Default timeout for normal API requests. Heavy operations can override it per call.
const REQUEST_TIMEOUT_MS = 12000;
const UNSUPPORTED_IMAGE_MESSAGE = 'Please choose a valid image file from your camera or gallery.';
const LOW_CONFIDENCE_IMAGE_MESSAGE = 'The AI was not confident enough to diagnose this photo. Try a clearer, closer leaf photo.';

type ApiErrorResponse = {
  detail?: string;
  error?: string;
  errors?: Record<string, string[] | string | undefined>;
  message?: string;
  title?: string;
};

// This helper normalizes backend and network messages into UI-friendly copy.
function toUserFriendlyMessage(message: string) {
  // We normalize common backend/network errors into messages that make sense in the UI.
  const normalized = message.trim();
  if (!normalized) return 'Something went wrong. Please try again.';

  if (/invalid token/i.test(normalized)) return 'Your session expired. Please sign in again.';
  if (/network error/i.test(normalized)) return 'Could not reach the server. Please check your connection and backend.';
  if (/request timed out/i.test(normalized)) return normalized;
  if (/not confident enough/i.test(normalized)) return LOW_CONFIDENCE_IMAGE_MESSAGE;
  if (/only image files allowed|invalid image/i.test(normalized)) return UNSUPPORTED_IMAGE_MESSAGE;
  if (/AI diagnosis failed|AI service could not analyze/i.test(normalized)) return normalized;
  if (/not authenticated/i.test(normalized)) return 'Please sign in first.';
  if (/one or more validation errors occurred/i.test(normalized)) return 'Please check the form and try again.';
  if (/duplicate.*email|email.*already exists|email.*already taken/i.test(normalized)) {
    return 'This email is already registered.';
  }
  if (/user.*not found|invalid email/i.test(normalized)) return 'No account was found for that email.';
  if (/invalid credentials|invalid login|wrong password|incorrect password/i.test(normalized)) {
    return 'Incorrect email or password.';
  }
  if (/passwords? do not match/i.test(normalized)) return 'Passwords do not match.';
  if (/minimum length of '4'|field password|password.*at least 4/i.test(normalized)) {
    return 'The password must be at least 4 characters';
  }

  return normalized;
}

// Validation error payloads can contain multiple field-specific messages.
function extractValidationMessage(errors: ApiErrorResponse['errors']): string {
  if (!errors) return '';

  const entries = Object.entries(errors);
  for (const [field, value] of entries) {
    const messages = Array.isArray(value) ? value : value ? [value] : [];
    const first = messages.find(Boolean)?.trim();
    if (!first) continue;

    if (/password/i.test(field) || /password/i.test(first)) {
      return toUserFriendlyMessage(first);
    }
    if (/email/i.test(field) || /email/i.test(first)) {
      return toUserFriendlyMessage(first);
    }

    return toUserFriendlyMessage(first);
  }

  return '';
}

// This chooses the best available error message from a backend response body.
function extractApiErrorMessage(body: unknown): string {
  if (typeof body === 'string') return toUserFriendlyMessage(body);

  if (!body || typeof body !== 'object') {
    return 'Something went wrong. Please try again.';
  }

  const errorBody = body as ApiErrorResponse;
  const validationMessage = extractValidationMessage(errorBody.errors);
  if (validationMessage) return validationMessage;

  const message =
    errorBody.message ||
    errorBody.detail ||
    errorBody.error ||
    errorBody.title ||
    'Request failed';

  return toUserFriendlyMessage(message);
}

// Removes a trailing slash from the base URL
function normalizeBaseUrl(url: string): string {
  return (url || '').replace(/\/$/, '');
}

// Makes sure the request path is valid
// If the path is already a full URL like http://..., it returns it as-is
// If the path does not start with /, it adds /
function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

// A timeout guard prevents fetch from hanging indefinitely on slow or stuck backends.
function createTimeoutController(timeoutMs: number) {
  // AbortController lets the app fail gracefully instead of hanging forever.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

// Fetch failures are converted into consistent Error instances for the rest of the app.
function buildNetworkError(url: string, error: unknown, timeoutMs: number) {
  if (error instanceof Error && error.name === 'AbortError') {
    if (url.includes('/api/v1/users/me/scans')) {
      return new Error('Scan analysis took too long. Try again in a moment after the AI service warms up.');
    }

    return new Error(`Request timed out after ${timeoutMs / 1000}s. Check backend and URL: ${url}`);
  }

  return new Error(`Network error. Check backend and URL: ${url}`);
}

function shouldUseJsonContentType(body: RequestInit['body']) {
  if (!body) return true;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false;
  return true;
}

// apiRequest is the shared network helper for authenticated and public backend requests.
// It centralizes URL resolution, headers, auth, timeouts, and error normalization.
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
  token?: string,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
  // Every feature builds on this helper so headers, auth, errors, and timeouts stay consistent.
  const baseUrl = normalizeBaseUrl(env.API_BASE_URL);
  const urlPath = resolveUrl(path);
  const url = baseUrl ? `${baseUrl}${urlPath}` : urlPath;

  const headers = new Headers(options.headers || undefined);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  if (shouldUseJsonContentType(options.body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) headers.set('Authorization', `Bearer ${token}`);

  const { controller, timeoutId } = createTimeoutController(timeoutMs);

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    throw buildNetworkError(url, error, timeoutMs);
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get('content-type') || '';
  const body: unknown = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    // Backend errors are converted into thrown Error objects so screens can show them uniformly.
    throw new Error(extractApiErrorMessage(body));
  }

  return body as T;
}
