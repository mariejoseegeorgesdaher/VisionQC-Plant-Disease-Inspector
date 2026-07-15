import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { changeMyPassword, refreshMe, updateMyProfile } from '@/lib/user-features';

export default function UserProfileScreen() {
  // User profile lets normal users edit their display name and optionally change password.
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const me = await refreshMe();
      setFullName(me.fullName || '');
      setEmail(me.email || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
    void loadProfile();
    }, [loadProfile])
  );

  const onSaveForm = useCallback(async () => {
    // Password change is optional, but both old and new password are required when used.
    const wantsPasswordUpdate = !!oldPassword || !!newPassword;
    if (wantsPasswordUpdate && (!oldPassword || !newPassword)) {
      setError('To change password, fill both old and new password.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const profileRes = await updateMyProfile(fullName);

      if (wantsPasswordUpdate) {
        const passwordRes = await changeMyPassword(oldPassword, newPassword);
        setMessage(passwordRes.message || 'Profile and password updated successfully');
        setOldPassword('');
        setNewPassword('');
      } else {
        setMessage(profileRes.message || 'Profile updated successfully');
      }

      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update form');
    } finally {
      setSaving(false);
    }
  }, [fullName, loadProfile, newPassword, oldPassword]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Change Info</Text>

      {loading ? <ActivityIndicator color="#0d4d3d" /> : null}
      {!!error ? <Text style={styles.error}>{error}</Text> : null}
      {!!message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile Info</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor="#7a7d86"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={email}
          editable={false}
          selectTextOnFocus={false}
          placeholder="Email"
          placeholderTextColor="#7a7d86"
        />
        <Text style={styles.readOnlyHint}>Email cannot be edited.</Text>

        <Text style={styles.sectionTitle}>Change Password (Optional)</Text>
        <View style={styles.passwordField}>
          <TextInput
            style={styles.passwordInput}
            value={oldPassword}
            onChangeText={setOldPassword}
            placeholder="Old password"
            secureTextEntry={!showOldPassword}
            placeholderTextColor="#7a7d86"
          />
          <Pressable style={styles.eyeButton} onPress={() => setShowOldPassword((prev) => !prev)}>
            <Ionicons name={showOldPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#0d4d3d" />
          </Pressable>
        </View>
        <View style={styles.passwordField}>
          <TextInput
            style={styles.passwordInput}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            secureTextEntry={!showNewPassword}
            placeholderTextColor="#7a7d86"
          />
          <Pressable style={styles.eyeButton} onPress={() => setShowNewPassword((prev) => !prev)}>
            <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#0d4d3d" />
          </Pressable>
        </View>

        <Pressable
          style={[styles.primaryButton, saving && styles.disabledButton]}
          disabled={saving}
          onPress={onSaveForm}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Changes</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f6f5f1',
    gap: 12,
  },
  title: {
    fontSize: 24,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  label: {
    color: '#0d4d3d',
    fontWeight: '600',
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  passwordField: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#0f172a',
  },
  eyeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyInput: {
    color: '#4b5563',
    backgroundColor: '#eef2f7',
  },
  readOnlyHint: {
    marginTop: -2,
    fontSize: 12,
    color: '#4b5563',
  },
  primaryButton: {
    backgroundColor: '#0d4d3d',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
  message: {
    color: '#0f7a4b',
    fontSize: 13,
  },
});
