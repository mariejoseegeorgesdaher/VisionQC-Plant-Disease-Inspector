import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { env } from '@/lib/env';
import { initializeGoogleSignin } from '@/lib/google-signin';

export function useGoogleAuth() {
  const hasClientId = useMemo(() => {
    // Android commonly uses the web client ID for the server-auth flow in this project.
    if (Platform.OS === 'android') return !!env.GOOGLE_WEB_CLIENT_ID;
    if (Platform.OS === 'ios') return !!env.GOOGLE_IOS_CLIENT_ID;
    return !!env.GOOGLE_WEB_CLIENT_ID;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!env.GOOGLE_AUTH_ENDPOINT) {
      throw new Error('Google sign-in endpoint is not configured.');
    }

    if (!hasClientId) {
      throw new Error('Add the Google web client ID in your environment before using Google sign-in.');
    }

    try {
      initializeGoogleSignin();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signOut().catch(() => undefined);
      const result = await GoogleSignin.signIn();

      if (isCancelledResponse(result)) {
        throw new Error('Google sign-in was cancelled.');
      }

      if (!isSuccessResponse(result)) {
        throw new Error('Google sign-in failed.');
      }

      const idToken = result.data?.idToken;
      if (!idToken) {
        throw new Error('Google sign-in did not return an ID token.');
      }

      // The hook only returns the Google ID token; backend login happens elsewhere.
      return idToken;
    } catch (error) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          throw new Error('Google Play Services are unavailable or need an update on this device.');
        }

        if (error.code === statusCodes.IN_PROGRESS) {
          throw new Error('Google sign-in is already in progress.');
        }
      }

      throw error instanceof Error ? error : new Error('Google sign-in failed.');
    }
  }, [hasClientId]);

  return {
    googleReady: hasClientId,
    signInWithGoogle,
  };
}
