import { apiRequest } from "./api";
import { getCachedOrLoad, invalidateCachePrefix } from "./cache";

const plantAliasesEndpoint =
  import.meta.env.VITE_PLANT_ALIASES_ENDPOINT || "/api/v1/users/me/plants";
const plantAliasesCacheKey = "plants:aliases";

function normalizePlantAlias(alias, index = 0) {
  if (!alias || typeof alias !== "object") {
    return {
      id: `plant-alias-${index}`,
      alias: "Unnamed Alias",
      scanCount: 0,
      createdAt: "",
      updatedAt: "",
      location: "",
    };
  }

  const aliasName =
    alias.alias ||
    alias.name ||
    alias.aliasName ||
    alias.displayName ||
    "Unnamed Alias";

  return {
    id: alias.id || alias.aliasId || alias.plantAliasId || `plant-alias-${index}`,
    alias: aliasName,
    scanCount:
      alias.scanCount ??
      alias.totalScans ??
      alias.usageCount ??
      alias.linkedScans ??
      0,
    createdAt: alias.createdAt || alias.createdOn || "",
    updatedAt: alias.updatedAt || alias.modifiedAt || alias.lastUpdated || "",
    location: alias.location || alias.primaryLocation || "",
  };
}

export async function fetchPlantAliases() {
  return getCachedOrLoad(plantAliasesCacheKey, async () => {
    const payload = await apiRequest(plantAliasesEndpoint, {
      method: "GET",
    });

    const rawAliases = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.plantAliases)
          ? payload.plantAliases
          : Array.isArray(payload?.aliases)
            ? payload.aliases
            : Array.isArray(payload?.data)
              ? payload.data
              : [];

    return rawAliases.map((alias, index) => normalizePlantAlias(alias, index));
  });
}

export async function createPlantAlias({ alias, location }) {
  const normalizedAlias = (alias || "").trim();
  const normalizedLocation = (location || "").trim();

  if (!normalizedAlias) {
    throw new Error("Alias is required.");
  }

  const payload = await apiRequest(plantAliasesEndpoint, {
    method: "POST",
    body: JSON.stringify({
      alias: normalizedAlias,
      location: normalizedLocation || null,
    }),
  });

  invalidateCachePrefix("plants:");
  return normalizePlantAlias(payload);
}

export async function deletePlantAlias(id) {
  if (!id) {
    throw new Error("Plant alias id is required.");
  }

  const result = await apiRequest(`${plantAliasesEndpoint}/${id}`, {
    method: "DELETE",
  });
  invalidateCachePrefix("plants:");
  return result;
}

export async function updatePlantAlias({ id, alias, location }) {
  if (!id) {
    throw new Error("Plant alias id is required.");
  }

  const normalizedAlias = (alias || "").trim();
  const normalizedLocation = (location || "").trim();

  if (!normalizedAlias) {
    throw new Error("Alias is required.");
  }

  const payload = await apiRequest(`${plantAliasesEndpoint}/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      alias: normalizedAlias,
      location: normalizedLocation || null,
    }),
  });

  invalidateCachePrefix("plants:");
  return normalizePlantAlias(payload);
}
