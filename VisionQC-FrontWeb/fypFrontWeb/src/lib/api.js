const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function tryParseJsonString(value) {
  if (typeof value !== "string") return value;

  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith("{") && !trimmedValue.startsWith("[")) {
    return value;
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return value;
  }
}

function humanizeFieldName(fieldName) {
  if (!fieldName || typeof fieldName !== "string") return "This field";

  const normalizedFieldName = fieldName
    .replace(/\[\d+\]/g, "")
    .split(".")
    .pop()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  return normalizedFieldName
    ? normalizedFieldName.charAt(0).toUpperCase() + normalizedFieldName.slice(1).toLowerCase()
    : "This field";
}

function humanizeValidationMessage(message, fieldName) {
  if (typeof message !== "string") return null;

  const cleanedMessage = message.trim();
  const humanFieldName = humanizeFieldName(fieldName);

  const directReplacements = [
    {
      pattern: /The field Password must be a string or array type with a minimum length of '4'\./i,
      message: "Password must have at least 4 characters.",
    },
    {
      pattern: /^The\s+(.+?)\s+field is required\.$/i,
      message: `${humanFieldName} is required.`,
    },
    {
      pattern: /^The field\s+(.+?)\s+is required\.$/i,
      message: `${humanFieldName} is required.`,
    },
    {
      pattern: /^The Email field is not a valid e-mail address\.$/i,
      message: "Please enter a valid email address.",
    },
  ];

  for (const replacement of directReplacements) {
    if (replacement.pattern.test(cleanedMessage)) {
      return replacement.message;
    }
  }

  const minLengthMatch = cleanedMessage.match(/minimum length of '(\d+)'/i);
  if (minLengthMatch) {
    return `${humanFieldName} must have at least ${minLengthMatch[1]} characters.`;
  }

  const maxLengthMatch = cleanedMessage.match(/maximum length of '(\d+)'/i);
  if (maxLengthMatch) {
    return `${humanFieldName} must be at most ${maxLengthMatch[1]} characters.`;
  }

  return cleanedMessage.replace(/^The field\s+/i, "").replace(/\.$/, ".") || null;
}

function formatValidationError(body) {
  const validationErrors = body?.errors;
  if (!validationErrors || typeof validationErrors !== "object") {
    return null;
  }

  const messages = Object.entries(validationErrors)
    .flatMap(([fieldName, value]) =>
      (Array.isArray(value) ? value : [value]).map((entry) =>
        humanizeValidationMessage(entry, fieldName)
      )
    )
    .filter((value) => typeof value === "string" && value.trim().length > 0);

  return messages[0] || null;
}

function extractErrorMessage(body) {
  if (typeof body === "string") {
    const parsedBody = tryParseJsonString(body);
    if (parsedBody !== body) {
      return extractErrorMessage(parsedBody);
    }
    return body;
  }

  if (!body || typeof body !== "object") {
    return "Request failed";
  }

  return (
    formatValidationError(body) ||
    body?.message ||
    body?.error ||
    body?.detail ||
    body?.title ||
    "Request failed"
  );
}

function resolveUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("visionqc_token");
  const skipAuth = options.skipAuth === true;
  const urlPath = resolveUrl(path);
  const url = baseUrl ? `${baseUrl}${urlPath}` : urlPath;
  const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = {
    ...(options.headers || {}),
  };

  if (!isFormDataBody && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  if (!skipAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const { skipAuth: _skipAuth, ...fetchOptions } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const rawBody = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  const body = tryParseJsonString(rawBody);

  if (!response.ok) {
    throw new Error(extractErrorMessage(body));
  }

  return body;
}
