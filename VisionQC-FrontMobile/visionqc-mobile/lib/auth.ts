//authentication helper file
//It contains the functions that handle login, token storage, logout, forgot password, reset password, and Google authentication.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiRequest } from '@/lib/api';
import { clearCachedCurrentUser } from '@/lib/current-user-cache';
import { clearCachedScanFormData } from '@/lib/scan-form-cache';
import { env } from '@/lib/env';

type AuthPayload = {
  token?: string;
  accessToken?: string;
  jwt?: string;
  data?: {
    token?: string;
  };
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
};

export type ResetPasswordInput = {
  email: string;
  token: string;
  newPassword: string;
};

const TOKEN_STORAGE_KEY = 'visionqc_token';
const PASSWORD_RESET_REQUEST_TIMEOUT_MS = 60000;

let authToken = '';

function extractToken(payload: unknown): string {
  // Different backend responses may place the token under different keys
  //extract the jwt or the auth token or the token ,depending on what the backend endpoint will return
  if (!payload || typeof payload !== 'object') return '';

  const auth = payload as AuthPayload;
  return auth.token || auth.accessToken || auth.jwt || auth.data?.token || '';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

//store the token is local variable authToken so its easier to restore teh login session 
//and returns it 
export async function hydrateAuthToken(): Promise<string> {
  try {
    // On app startup we restore the persisted token into memory.
    const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    authToken = stored || '';
    return authToken;
  } catch {
    authToken = '';
    return '';
  }
}

//here if the local variable is empty -> remove it
//else store it in AsyncStorage
export async function saveAuthToken(token: string): Promise<void> {
  authToken = token || '';
  // A new token may represent a different user session, so cached profile data is cleared.
  clearCachedCurrentUser();
  clearCachedScanFormData();

  if (!authToken) {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, authToken);
}

// Removes the token from AsyncStorage in logout
export async function clearAuthToken(): Promise<void> {
  authToken = '';
  clearCachedCurrentUser();
  clearCachedScanFormData();
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getAuthToken(): string {
  return authToken;
}

export function hasAuthToken(): boolean {
  return !!authToken;
}

//all the following method are just calling the api endpoint and expecting a response
export async function loginUser(input: LoginInput) {
  // The login endpoint returns a token that we save for later authenticated requests.
  const payload = await apiRequest(env.LOGIN_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      email: normalizeEmail(input.email),
      password: input.password,
    }),
  });

  const token = extractToken(payload);
  if (token) await saveAuthToken(token);

  return payload;
}

export async function registerUser(input: RegisterInput): Promise<{ message?: string }> {
  return apiRequest(env.REGISTER_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      fullName: input.fullName.trim(),
      email: normalizeEmail(input.email),
      password: input.password,
    }),
  });
}

//Sends a POST request to the forgot-password endpoint
// Sends the normalized email
// Returns the backend response
export async function forgotPassword(email: string): Promise<{
  message?: string;
  devResetLink?: string;
  devAppResetLink?: string;
}> {
  return apiRequest(env.FORGOT_PASSWORD_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      email: normalizeEmail(email),
    }),
  }, undefined, PASSWORD_RESET_REQUEST_TIMEOUT_MS);
}

export async function resetPassword(input: ResetPasswordInput): Promise<{ message?: string }> {
  // The reset screen passes email, reset token, and the newly chosen password here.
  return apiRequest('/api/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      email: normalizeEmail(input.email),
      token: input.token,
      newPassword: input.newPassword,
    }),
  });
}

export async function loginWithGoogleIdToken(idToken: string) {
  // Our backend validates the Google token and returns the app's own auth token.
  const payload = await apiRequest(env.GOOGLE_AUTH_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });

  const token = extractToken(payload);
  if (!token) {
    throw new Error('Google login succeeded but no auth token was returned by the backend.');
  }

  await saveAuthToken(token);

  return payload;
}

export async function registerWithGoogleIdToken(idToken: string) {
  const payload = await apiRequest(env.GOOGLE_REGISTER_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });

  const token = extractToken(payload);
  if (!token) {
    throw new Error('Google registration succeeded but no auth token was returned by the backend.');
  }

  await saveAuthToken(token);

  return payload;
}
