import Constants from 'expo-constants';
import { Platform } from 'react-native';

function readExtra(name: string): string {
  // app.json extra values are available through Expo Constants at runtime.
  const expoConfig = Constants.expoConfig;
  const value = expoConfig?.extra?.[name];
  return typeof value === 'string' ? value : '';
}

function parseHost(value: string): string {
  const clean = (value || '').trim();
  if (!clean) return '';
  const withoutScheme = clean.replace(/^\w+:\/\//, '');
  const hostPort = withoutScheme.split('/')[0] || '';
  return hostPort.split(':')[0] || '';
}

function parsePort(value: string): string {
  const clean = (value || '').trim();
  if (!clean) return '';
  const withoutScheme = clean.replace(/^\w+:\/\//, '');
  const hostPort = withoutScheme.split('/')[0] || '';
  const parts = hostPort.split(':');
  return parts.length > 1 ? parts[parts.length - 1] || '' : '';
}

function resolveExpoHost(): string {
  // Expo can expose the current dev host through different fields depending on runtime.
  const fromHostUri = parseHost(Constants.expoConfig?.hostUri || '');
  if (fromHostUri) return fromHostUri;

  // Fallbacks across Expo runtime variants.
  const maybeAny = Constants as unknown as {
    manifest?: { debuggerHost?: string };
    expoGoConfig?: { debuggerHost?: string };
  };

  const fromManifest = parseHost(maybeAny.manifest?.debuggerHost || '');
  if (fromManifest) return fromManifest;

  const fromExpoGo = parseHost(maybeAny.expoGoConfig?.debuggerHost || '');
  if (fromExpoGo) return fromExpoGo;

  return '';
}

function isLikelyAndroidEmulator(): boolean {
  if (Platform.OS !== 'android') return false;

  const constants = (Platform.constants || {}) as Record<string, unknown>;
  const probe = [
    constants.Brand,
    constants.Manufacturer,
    constants.Model,
    constants.Product,
    constants.Device,
    constants.Fingerprint,
    constants.Hardware,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const emulatorHints = [
    'generic',
    'sdk',
    'emulator',
    'simulator',
    'android sdk built for x86',
    'ranchu',
    'goldfish',
    'vbox',
  ];

  return emulatorHints.some((hint) => probe.includes(hint));
}

function replaceLocalhostHost(value: string): string {
  // Physical devices and Android emulators cannot always reach the computer through "localhost".
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
      return trimmed;
    }

    let resolvedHost = resolveExpoHost();

    // The Android emulator reaches services running on the host machine through 10.0.2.2.
    if (isLikelyAndroidEmulator()) {
      resolvedHost = '10.0.2.2';
    } else if (Platform.OS === 'android') {
      resolvedHost = resolvedHost || '10.0.2.2';
    }

    if (!resolvedHost) return trimmed;

    url.hostname = resolvedHost;
    return url.toString().replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}

function resolveApiBaseUrl(): string {
  // "auto" mode lets the app adapt to emulator, LAN, or Expo host values during development.
  const configured = (process.env.EXPO_PUBLIC_API_BASE_URL || readExtra('apiBaseUrl') || '').trim();
  const useAuto = !configured || configured.toLowerCase() === 'auto';
  if (!useAuto) return replaceLocalhostHost(configured);

  let host = resolveExpoHost();
  const configuredPort = parsePort(configured) || '7125';
  // Android emulator reaches host machine through this alias.
  if (isLikelyAndroidEmulator()) {
    host = '10.0.2.2';
  } else if (Platform.OS === 'android' && ['localhost', '127.0.0.1'].includes(host)) {
    host = '10.0.2.2';
  }

  if (!host) return '';
  const scheme = isLikelyAndroidEmulator() ? 'http' : 'https';
  return `${scheme}://${host}:${configuredPort}`;
}

export const env = {
  // Centralized environment values keep the rest of the app simple.
  API_BASE_URL: resolveApiBaseUrl(),
  AI_BASE_URL: replaceLocalhostHost((process.env.EXPO_PUBLIC_AI_BASE_URL || readExtra('aiBaseUrl') || '').trim()),
  LOGIN_ENDPOINT: process.env.EXPO_PUBLIC_LOGIN_ENDPOINT || '/api/v1/auth/login',
  REGISTER_ENDPOINT: process.env.EXPO_PUBLIC_REGISTER_ENDPOINT || '/api/v1/auth/register',
  FORGOT_PASSWORD_ENDPOINT:
    process.env.EXPO_PUBLIC_FORGOT_PASSWORD_ENDPOINT || '/api/v1/auth/forgot-password',
  GOOGLE_AUTH_ENDPOINT:
    process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENDPOINT || '/api/v1/auth/google/login',
  GOOGLE_REGISTER_ENDPOINT:
    process.env.EXPO_PUBLIC_GOOGLE_REGISTER_ENDPOINT || '/api/v1/auth/google/register',
  GOOGLE_ANDROID_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
  GOOGLE_IOS_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
  GOOGLE_WEB_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
};
