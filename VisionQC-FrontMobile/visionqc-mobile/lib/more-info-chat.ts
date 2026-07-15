import { env } from '@/lib/env';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ScanContext = {
  plantAlias?: string | null;
  disease?: string | null;
  confidence?: number | null;
  location?: string | null;
  analysis?: string | null;
  solution?: string | null;
  prevention?: string | null;
  moreInfoChatUrl?: string | null;
};

const CHAT_TIMEOUT_MS = 70000;

function normalizeBaseUrl(url: string): string {
  return (url || '').replace(/\/$/, '');
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

function createTimeoutController(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

function getChatErrorMessage(payload: unknown): string {
  // The AI service may return either detail or message; convert both into user-facing copy.
  if (payload && typeof payload === 'object') {
    const body = payload as { detail?: unknown; message?: unknown };
    const detail = typeof body.detail === 'string' ? body.detail : '';
    const message = typeof body.message === 'string' ? body.message : '';
    const text = detail || message;

    if (/ollama/i.test(text)) {
      return 'Plant assistant is warming up or temporarily unavailable. Try again in a moment.';
    }

    if (text) return text;
  }

  return 'Could not ask the plant assistant.';
}

export async function askMoreInfoQuestion(input: {
  scan: ScanContext;
  question: string;
  history?: ChatMessage[];
}): Promise<string> {
  // More Info chat sends scan context plus the user's question to the AI assistant endpoint.
  const baseUrl = normalizeBaseUrl(env.AI_BASE_URL || env.API_BASE_URL);
  const endpoint = resolveUrl(input.scan.moreInfoChatUrl || '/chat');
  const url = baseUrl ? `${baseUrl}${endpoint}` : endpoint;
  const { controller, timeoutId } = createTimeoutController(CHAT_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        // The backend/AI service uses this context to answer about the exact scan result.
        alias: input.scan.plantAlias || 'Unknown',
        disease: input.scan.disease || 'Unknown',
        confidence: typeof input.scan.confidence === 'number' ? input.scan.confidence : null,
        location: input.scan.location || '',
        analysis: input.scan.analysis || '',
        solution: input.scan.solution || '',
        prevention: input.scan.prevention || '',
        question: input.question,
        history: input.history || [],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Plant assistant took too long to answer. Try again in a moment.');
    }

    throw new Error(`Could not reach the plant assistant. Check AI service URL: ${url}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getChatErrorMessage(payload));
  }

  return typeof payload?.answer === 'string' ? payload.answer : '';
}
