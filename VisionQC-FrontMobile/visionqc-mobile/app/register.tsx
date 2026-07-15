import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useGoogleAuth } from '@/hooks/use-google-auth';
import { registerUser, registerWithGoogleIdToken } from '@/lib/auth';
import { getCurrentUser, getRoleHomeRoute } from '@/lib/user';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { googleReady, signInWithGoogle } = useGoogleAuth();

  const canSubmit = useMemo(() => {
    return !!fullName.trim() && !!email.trim() && !!password && !!confirmPassword && !loading;
  }, [confirmPassword, email, fullName, loading, password]);

  const handleRegister = useCallback(async () => {
    if (!canSubmit) return;

    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');
      const res = await registerUser({ fullName, email, password });
      setMessage(res.message || 'Registration successful. You can now sign in.');
      setTimeout(() => router.replace('/'), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }, [canSubmit, confirmPassword, email, fullName, password]);

  const handleGoogleRegister = useCallback(async () => {
    try {
      setGoogleLoading(true);
      setError('');
      setMessage('');
      const idToken = await signInWithGoogle();
      await registerWithGoogleIdToken(idToken);
      const me = await getCurrentUser();
      router.replace(getRoleHomeRoute(me.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google registration is unavailable right now.');
    } finally {
      setGoogleLoading(false);
    }
  }, [signInWithGoogle]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create Account</Text>

        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor="#7a7d86"
        />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#7a7d86"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor="#7a7d86"
        />
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Confirm password"
          placeholderTextColor="#7a7d86"
        />

        {!!error ? <Text style={styles.error}>{error}</Text> : null}
        {!!message ? <Text style={styles.message}>{message}</Text> : null}

        <Pressable style={[styles.button, !canSubmit && styles.buttonDisabled]} onPress={handleRegister} disabled={!canSubmit}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>

        <Pressable
          style={[styles.googleButton, (!googleReady || googleLoading) && styles.buttonDisabled]}
          onPress={handleGoogleRegister}
          disabled={!googleReady || googleLoading || loading}>
          {googleLoading ? (
            <ActivityIndicator color="#0d4d3d" />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color="#0d4d3d" />
              <Text style={styles.googleButtonText}>Register with Google</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace('/')}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f2',
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 20,
    gap: 10,
    shadowColor: '#0d4d3d',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0d4d3d',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
  message: {
    color: '#0f7a4b',
    fontSize: 13,
  },
  button: {
    marginTop: 4,
    backgroundColor: '#0d4d3d',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  link: {
    color: '#0d4d3d',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 8,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
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
  googleButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  googleButtonText: {
    color: '#0d4d3d',
    fontWeight: '700',
    fontSize: 15,
  },
});
