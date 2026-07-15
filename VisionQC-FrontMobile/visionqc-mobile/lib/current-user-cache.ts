import type { MeResponse } from '@/lib/user';

// This small in-memory cache avoids refetching /users/me on every screen change.
let currentUserCache: MeResponse | null = null;
// We also store the in-flight promise so concurrent callers can share one request.
let currentUserRequest: Promise<MeResponse> | null = null;
let currentUserFetchedAt = 0;

export function getCachedCurrentUser(): MeResponse | null {
  return currentUserCache;
}

export function setCachedCurrentUser(user: MeResponse | null): void {
  currentUserCache = user;
  currentUserFetchedAt = user ? Date.now() : 0;
}

export function getCurrentUserRequest(): Promise<MeResponse> | null {
  return currentUserRequest;
}

export function setCurrentUserRequest(request: Promise<MeResponse> | null): void {
  currentUserRequest = request;
}

export function clearCachedCurrentUser(): void {
  currentUserCache = null;
  currentUserRequest = null;
  currentUserFetchedAt = 0;
}

export function isCachedCurrentUserFresh(maxAgeMs: number): boolean {
  if (!currentUserCache || !currentUserFetchedAt) return false;
  return Date.now() - currentUserFetchedAt <= maxAgeMs;
}
