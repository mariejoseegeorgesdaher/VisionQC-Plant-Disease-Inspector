type ScanFormCache = {
  aliases: string[];
  savedLocations: string[];
  fetchedAt: number;
};

const DEFAULT_SCAN_FORM_MAX_AGE_MS = 60_000;

// In-memory cache only lives for the current app session; it makes scan form suggestions feel instant.
let scanFormCache: ScanFormCache | null = null;

export function getCachedScanFormData(maxAgeMs = DEFAULT_SCAN_FORM_MAX_AGE_MS): ScanFormCache | null {
  if (!scanFormCache) return null;
  if (Date.now() - scanFormCache.fetchedAt > maxAgeMs) return null;
  return scanFormCache;
}

export function setCachedScanFormData(data: Omit<ScanFormCache, 'fetchedAt'>): void {
  scanFormCache = {
    ...data,
    fetchedAt: Date.now(),
  };
}

export function updateCachedScanFormData(input: {
  alias?: string;
  location?: string;
}): void {
  if (!scanFormCache) return;

  // Newly used aliases/locations are inserted locally so the scan form updates before the next API fetch.
  const nextAliases = input.alias?.trim()
    ? Array.from(new Set([...scanFormCache.aliases, input.alias.trim()])).sort((left, right) =>
        left.localeCompare(right)
      )
    : scanFormCache.aliases;

  const nextLocations = input.location?.trim()
    ? Array.from(new Set([...scanFormCache.savedLocations, input.location.trim()])).sort((left, right) =>
        left.localeCompare(right)
      )
    : scanFormCache.savedLocations;

  scanFormCache = {
    aliases: nextAliases,
    savedLocations: nextLocations,
    fetchedAt: Date.now(),
  };
}

export function clearCachedScanFormData(): void {
  scanFormCache = null;
}
