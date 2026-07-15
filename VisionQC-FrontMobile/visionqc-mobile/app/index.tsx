import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useGoogleAuth } from '@/hooks/use-google-auth';
import { loginUser, loginWithGoogleIdToken } from '@/lib/auth';
import { getCurrentUser, getRoleHomeRoute } from '@/lib/user';

function isValidEmail(value: string) {
  // A lightweight email pattern is enough here because final validation still belongs to the backend.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginScreen() {
  // Local component state keeps the form responsive without needing any global store.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  // The custom hook hides Google SDK setup details and exposes a simple sign-in API to the screen.
  const { googleReady, signInWithGoogle } = useGoogleAuth();

  const handleLogin = useCallback(async () => {
    // Prevent duplicate submissions while the current login request is still running.
    if (loading) return;

    const nextEmail = email.trim();
    const nextPassword = password;
    // Saving the trimmed email back into state keeps the visible input normalized after submission.
    setEmail(nextEmail);

    // Basic client-side validation gives immediate feedback before hitting the backend.
    if (!nextEmail || !nextPassword) {
      setError('Email and password are required.');
      return;
    }

    if (!isValidEmail(nextEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      // First we ask the backend for a token, then we fetch the user's profile and role.
      await loginUser({ email: nextEmail, password: nextPassword });
      const me = await getCurrentUser();
      // Navigation depends on role so admins and normal users land on different dashboards.
      router.replace(getRoleHomeRoute(me.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }, [email, loading, password]);

  const togglePasswordVisibility = useCallback(() => {
    // Password visibility is a pure UI concern, so it stays as a tiny local toggle.
    setShowPassword((prev) => !prev);
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setGoogleLoading(true);
      setError('');
      // Google returns an ID token, and our own backend exchanges that token for the app auth token.
      const idToken = await signInWithGoogle();
      await loginWithGoogleIdToken(idToken);
      const me = await getCurrentUser();
      router.replace(getRoleHomeRoute(me.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      // The loading flag is always reset, even if the Google flow thro
      // ws or is cancelled.
      setGoogleLoading(false);
    }
  }, [signInWithGoogle]);

  return (
    <View style={styles.container}>
      {/* These decorative circles give the login screen a softer branded background without extra assets. */}
      <View style={styles.bgCircleOne} />
      <View style={styles.bgCircleTwo} />

      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Image
            source={require('@/assets/images/android-icon-foreground.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.brand}>Vision QC</Text>
        <Text style={styles.subtitle}>Plant Disease Inspector</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Sign In</Text>

        <TextInput
          // Autofill hints improve usability on real devices and save typing during demos.
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          importantForAutofill="yes"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#7a7d86"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
        />

        <View style={styles.passwordField}>
          <TextInput
            // The field switches between masked and visible modes using the local showPassword state.
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            importantForAutofill="yes"
            placeholder="Password"
            placeholderTextColor="#7a7d86"
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          {/* The eye icon only changes presentation; it does not affect stored auth data. */}
          <Pressable style={styles.eyeButton} onPress={togglePasswordVisibility}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#0d4d3d" />
          </Pressable>
        </View>

        <View style={styles.linksColumn}>
          <Pressable onPress={() => router.push('/forgot-password')}>
            <Text style={styles.linkText}>Forgot password?</Text>
          </Pressable>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          // Disabling while loading prevents rapid double taps from sending duplicate login requests.
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </Pressable>
      </View>

      <View style={styles.socialSection}>
        {/* The OR row visually separates traditional login from federated login. */}
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>

        <Pressable
          // Google sign-in stays disabled until the hook confirms the required client ID is configured.
          style={[styles.socialButton, (!googleReady || googleLoading) && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={!googleReady || googleLoading || loading}>
          {googleLoading ? <ActivityIndicator color="#0d4d3d" /> : <Text style={styles.socialButtonText}>Sign in with Google</Text>}
        </Pressable>

        <Pressable style={styles.bottomRegisterLine} onPress={() => router.push('/register')}>
          <Text style={styles.registerLineText}>Do not have an account? Register now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f2',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  bgCircleOne: {
    position: 'absolute',
    top: -70,
    right: -55,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#dbe9e1',
  },
  bgCircleTwo: {
    position: 'absolute',
    bottom: 120,
    left: -85,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#e3efe8',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logoWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e3e7e5',
    backgroundColor: '#ffffff',
    shadowColor: '#0d4d3d',
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    marginBottom: 10,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brand: {
    color: '#0d4d3d',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#2a2d35',
    opacity: 0.7,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#d9e0db',
    shadowColor: '#0d4d3d',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  title: {
    color: '#0d4d3d',
    fontSize: 22,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  passwordField: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
  },
  eyeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linksColumn: {
    gap: 6,
    alignItems: 'center',
  },
  linkText: {
    color: '#0d4d3d',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomRegisterLine: {
    marginTop: 4,
    width: '100%',
  },
  registerLineText: {
    color: '#0d4d3d',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
  button: {
    marginTop: 6,
    backgroundColor: '#0d4d3d',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  socialSection: {
    marginTop: 14,
    gap: 10,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#c8d2ce',
  },
  orText: {
    color: '#5c6a65',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  socialButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  socialButtonText: {
    color: '#0d4d3d',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
