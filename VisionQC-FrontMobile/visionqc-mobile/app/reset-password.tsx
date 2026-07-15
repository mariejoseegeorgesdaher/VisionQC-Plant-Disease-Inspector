import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { resetPassword } from '@/lib/auth';

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function readBrowserResetParams() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { email: '', token: '' };
  }

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#\/?/, '').replace(/^\?/, ''));

  return {
    email: search.get('email') || hash.get('email') || '',
    token:
      search.get('token') ||
      search.get('resetToken') ||
      search.get('code') ||
      hash.get('token') ||
      hash.get('resetToken') ||
      hash.get('code') ||
      '',
  };
}

export default function ResetPasswordScreen() {
  // The email and reset token are expected to come from the reset link query parameters.
  const params = useLocalSearchParams<{
    code?: string;
    email?: string;
    resetToken?: string;
    token?: string;
  }>();
  // Password state is kept local because this screen does not need to share draft values elsewhere.
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetComplete, setResetComplete] = useState(false);

  // Query values are narrowed to strings because router params may also arrive as arrays or undefined.
  const browserParams = readBrowserResetParams();
  const email = firstString(params.email) || browserParams.email;
  const token =
    firstString(params.token) ||
    firstString(params.resetToken) ||
    firstString(params.code) ||
    browserParams.token;
  const canSubmit = useMemo(
    // The button stays disabled until all required values exist and no request is in progress.
    () => !!email && !!token && !!newPassword && !!confirmPassword && !loading,
    [confirmPassword, email, loading, newPassword, token]
  );

  const handleResetPassword = useCallback(async () => {
    // This early return keeps the handler safe even if it is triggered unexpectedly.
    if (!canSubmit) return;

    // Light frontend validation improves UX before the backend performs the real security checks.
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');
      // The backend verifies the reset token and updates the stored password.
      const res = await resetPassword({ email, token, newPassword });
      setMessage(res.message || 'Password reset successful.');
      setResetComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }, [canSubmit, confirmPassword, email, newPassword, token]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {resetComplete ? (
          <>
            <Text style={styles.title}>Password Changed</Text>
            <Text style={styles.successCopy}>
              Your password was changed successfully. Go back to the app and sign in with your new password.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Reset Password</Text>
        {/* Showing the email helps the user confirm which account is being updated. */}
            <Text style={styles.subtitle}>Choose a new password for {email || 'your account'}.</Text>

            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="New password"
              placeholderTextColor="#7a7d86"
            />
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Confirm new password"
              placeholderTextColor="#7a7d86"
            />

            {!!error ? <Text style={styles.error}>{error}</Text> : null}
            {!!message ? <Text style={styles.message}>{message}</Text> : null}
        {/* Missing email or token usually means the reset link was opened incorrectly or expired. */}
            {!email || !token ? <Text style={styles.error}>Reset link is missing required details.</Text> : null}

            <Pressable
          // The button remains disabled until the route data and both password fields are ready.
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={!canSubmit}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
            </Pressable>

        {/* This provides an escape hatch back to the login screen without relying on browser history. */}
            <Pressable onPress={() => router.replace('/')}>
              <Text style={styles.link}>Back to Sign in</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f5f1',
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
  },
  subtitle: {
    color: '#2a2d35',
    opacity: 0.75,
    fontSize: 13,
    marginBottom: 4,
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
  successCopy: {
    color: '#2a2d35',
    fontSize: 14,
    lineHeight: 21,
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
});
