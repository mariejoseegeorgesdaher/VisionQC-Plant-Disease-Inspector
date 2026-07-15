import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { forgotPassword } from '@/lib/auth';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const canSubmit = useMemo(() => !!email.trim() && !loading, [email, loading]);

  const handleSend = useCallback(async () => {
    if (!canSubmit) return;

    if (!isValidEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');
      const res = await forgotPassword(email);
      setMessage(res.message || 'If the email exists, a reset link was sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  }, [canSubmit, email]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>Enter your email and we will send a reset link.</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#7a7d86"
      />

      {!!error ? <Text style={styles.error}>{error}</Text> : null}
      {!!message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable style={[styles.button, !canSubmit && styles.buttonDisabled]} onPress={handleSend} disabled={!canSubmit}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
      </Pressable>

      <Pressable onPress={() => router.replace('/')}>
        <Text style={styles.link}>Back to Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f5f1',
    padding: 24,
    justifyContent: 'center',
    gap: 10,
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
