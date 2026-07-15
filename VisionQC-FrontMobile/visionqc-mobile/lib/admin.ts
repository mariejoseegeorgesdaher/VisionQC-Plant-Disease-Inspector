import { apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';

// Admin API layer. The mobile admin experience is intentionally read-only.
export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  scanCount: number;
};

export type DiseaseCount = {
  disease: string;
  count: number;
};

export type AdminStatsOverview = {
  totalUsers: number;
  activeUsers: number;
  totalScans: number;
  scansLast7Days: number;
  topDiseases: DiseaseCount[];
};

export type LocationDiseaseStats = {
  location: string;
  diseases: DiseaseCount[];
};

function requireToken(): string {
  // Admin screens are protected, so API helpers fail early when no session exists.
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}

function withQuery(path: string, params: Record<string, string | undefined>) {
  // Optional filters are only added when the screen passes real values.
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

export async function getAdminUsers(params?: {
  role?: string;
  isActive?: 'true' | 'false';
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedResult<AdminUser>> {
  const token = requireToken();
  // The screen filters server-side by role/status/search rather than loading every user.
  const path = withQuery('/api/v1/admin/users', {
    role: params?.role,
    isActive: params?.isActive,
    search: params?.search,
    page: params?.page ? String(params.page) : undefined,
    pageSize: params?.pageSize ? String(params.pageSize) : undefined,
  });

  return apiRequest(path, {}, token);
}

export async function getStatsOverview(top = 5): Promise<AdminStatsOverview> {
  const token = requireToken();
  // Overview powers the admin statistics cards and top disease chart.
  return apiRequest(`/api/v1/admin/stats/overview?top=${top}`, {}, token);
}

export async function getDiseasesByLocation(): Promise<LocationDiseaseStats[]> {
  const token = requireToken();
  // Location stats feed the scan oversight view.
  return apiRequest('/api/v1/admin/stats/diseases-by-location', {}, token);
}
