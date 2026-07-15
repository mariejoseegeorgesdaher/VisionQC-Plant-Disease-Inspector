import { apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import {
  clearCachedCurrentUser,
  getCachedCurrentUser,
  getCurrentUserRequest,
  isCachedCurrentUserFresh,
  setCachedCurrentUser,
  setCurrentUserRequest,
} from '@/lib/current-user-cache';

export type MeResponse = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
};

type GetCurrentUserOptions = {
  force?: boolean;
  maxAgeMs?: number;
};

const DEFAULT_CURRENT_USER_MAX_AGE_MS = 30_000;

export function isAdminRole(role: string | undefined | null): boolean {
  // Backend role labels are normalized so routing does not depend on exact casing.
  if (!role) return false;
  const value = role.trim().toLowerCase();
  return value === 'admin' || value === 'administrator';
}

export function getRoleHomeRoute(role: string | undefined | null): '/admin/dashboard' | '/user/dashboard' {
  return isAdminRole(role) ? '/admin/dashboard' : '/user/dashboard';
}

export async function getCurrentUser(options: GetCurrentUserOptions = {}): Promise<MeResponse> {
  // This is the shared /me loader used by login, dashboards, and profile screens.
  const token = getAuthToken();
  if (!token) {
    clearCachedCurrentUser();
    throw new Error('Not authenticated');
  }

  const cachedUser = getCachedCurrentUser();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_CURRENT_USER_MAX_AGE_MS;

  if (!options.force && cachedUser && isCachedCurrentUserFresh(maxAgeMs)) {
    // Reuse a fresh cached profile to avoid duplicate /me requests during quick screen hops.
    return cachedUser;
  }

  const pendingRequest = getCurrentUserRequest();
  if (!options.force && pendingRequest) {
    // If another screen already asked for the current user, we await that same promise.
    return pendingRequest;
  }

  const request = apiRequest<MeResponse>('/api/v1/users/me', {}, token)
    .then((user) => {
      // Successful responses refresh the cache used by the rest of the app.
      setCachedCurrentUser(user);
      return user;
    })
    .catch((error) => {
      setCachedCurrentUser(null);
      throw error;
    })
    .finally(() => {
      setCurrentUserRequest(null);
    });

  setCurrentUserRequest(request);
  return request;
}
