import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { env } from '@/lib/env';

let googleSigninConfigured = false;

export function initializeGoogleSignin() {
  if (googleSigninConfigured) return;

  GoogleSignin.configure({
    webClientId: env.GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: env.GOOGLE_IOS_CLIENT_ID || undefined,
    profileImageSize: 120,
  });

  googleSigninConfigured = true;
}
