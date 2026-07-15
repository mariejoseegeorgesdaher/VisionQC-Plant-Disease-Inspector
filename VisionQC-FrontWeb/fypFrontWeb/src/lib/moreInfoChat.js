const aiBaseUrl = (import.meta.env.VITE_AI_API_BASE_URL || "").replace(/\/$/, "");
const chatEndpoint = import.meta.env.VITE_AI_CHAT_ENDPOINT || "/chat";

function resolveAiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

function shouldUseDevProxy(urlPath) {
  if (!urlPath.startsWith("/") || !aiBaseUrl || typeof window === "undefined") {
    return false;
  }

  try {
    const url = new URL(aiBaseUrl);
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function buildMoreInfoScanContext(scan, fallback = {}) {
  return {
    alias: scan?.alias || scan?.plantAlias || fallback.alias || "Unknown",
    disease: scan?.disease || "Unknown",
    confidence: typeof scan?.confidence === "number" ? scan.confidence : null,
    location: scan?.location || fallback.location || "",
    analysis: scan?.analysis || "",
    solution: scan?.solution || "",
    prevention: scan?.prevention || "",
  };
}

export async function askMoreInfoQuestion({ context, question, history = [], chatUrl }) {
  const urlPath = resolveAiUrl(chatUrl || chatEndpoint);
  const url = shouldUseDevProxy(urlPath) || !aiBaseUrl ? urlPath : `${aiBaseUrl}${urlPath}`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        ...context,
        question,
        history,
      }),
    });
  } catch {
    throw new Error("The plant assistant is not reachable right now. Make sure the AI service is running, then try again.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || "Could not ask the plant assistant.");
  }

  return typeof payload?.answer === "string" ? payload.answer : "";
}
