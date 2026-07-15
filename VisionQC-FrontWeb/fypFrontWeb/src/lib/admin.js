import { apiRequest } from "./api";
import { getCachedOrLoad, invalidateCachePrefix } from "./cache";

const adminStatsOverviewEndpoint =
  import.meta.env.VITE_ADMIN_STATS_OVERVIEW_ENDPOINT || "/api/v1/admin/stats/overview";
const adminDiseasesByLocationEndpoint =
  import.meta.env.VITE_ADMIN_DISEASES_BY_LOCATION_ENDPOINT || "/api/v1/admin/stats/diseases-by-location";

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeDiseaseCount(item, index = 0) {
  return {
    disease: item?.disease || item?.name || `Disease ${index + 1}`,
    count: toNumber(item?.count),
  };
}

function normalizeLocationDiseaseStats(item, index = 0) {
  return {
    location: item?.location || item?.name || `Location ${index + 1}`,
    diseases: Array.isArray(item?.diseases)
      ? item.diseases.map((disease, diseaseIndex) => normalizeDiseaseCount(disease, diseaseIndex))
      : [],
  };
}

export async function fetchAdminStatsOverview(top = 5) {
  return getCachedOrLoad(`admin:overview:${top}`, async () => {
    const payload = await apiRequest(`${adminStatsOverviewEndpoint}?top=${encodeURIComponent(top)}`, {
      method: "GET",
    });

    return {
      totalUsers: toNumber(payload?.totalUsers),
      activeUsers: toNumber(payload?.activeUsers),
      totalScans: toNumber(payload?.totalScans),
      scansLast7Days: toNumber(payload?.scansLast7Days),
      topDiseases: Array.isArray(payload?.topDiseases)
        ? payload.topDiseases.map((item, index) => normalizeDiseaseCount(item, index))
        : [],
    };
  });
}

export async function fetchAdminDiseasesByLocation() {
  return getCachedOrLoad("admin:diseases-by-location", async () => {
    const payload = await apiRequest(adminDiseasesByLocationEndpoint, {
      method: "GET",
    });

    const rawItems = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    return rawItems.map((item, index) => normalizeLocationDiseaseStats(item, index));
  });
}

export function invalidateAdminCache() {
  invalidateCachePrefix("admin:");
}
