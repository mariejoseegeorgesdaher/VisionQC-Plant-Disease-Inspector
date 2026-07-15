function getSeverityStyles(level) {
  const normalizedLevel = String(level || "").trim().toLowerCase();

  if (normalizedLevel === "severe" || normalizedLevel === "high") {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (normalizedLevel === "moderate" || normalizedLevel === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (normalizedLevel === "mild") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

export function SeverityBadge({ level, className = "" }) {
  if (!level) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getSeverityStyles(level)} ${className}`.trim()}
    >
      {level}
    </span>
  );
}
