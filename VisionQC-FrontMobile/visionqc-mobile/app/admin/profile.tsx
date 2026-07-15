import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { changeMyPassword, refreshMe, updateMyProfile } from '@/lib/user-features';

export default function AdminProfileScreen() {
  // Admin profile reuses user profile API helpers but also displays the read-only role.
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const me = await refreshMe();
      setFullName(me.fullName || '');
      setEmail(me.email || '');
      setRole(me.role || '');
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

  const onSaveProfile = useCallback(async () => {
    try {
      setSavingProfile(true);
      setError('');
      setMessage('');
      const res = await updateMyProfile(fullName);
      setMessage(res.message || 'Profile updated successfully');
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }, [fullName, loadProfile]);

  const onChangePassword = useCallback(async () => {
    // Admin password changes are separate from profile edits to keep the action explicit.
    if (!oldPassword || !newPassword) {
      setError('Old and new password are required.');
      return;
    }

    try {
      setSavingPassword(true);
      setError('');
      setMessage('');
      const res = await changeMyPassword(oldPassword, newPassword);
      setMessage(res.message || 'Password updated successfully');
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  }, [newPassword, oldPassword]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Change Info</Text>

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

        <Text style={styles.label}>Role</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={role}
          editable={false}
          selectTextOnFocus={false}
          placeholder="Role"
          placeholderTextColor="#7a7d86"
        />

        <Pressable
          style={[styles.primaryButton, savingProfile && styles.disabledButton]}
          disabled={savingProfile}
          onPress={onSaveProfile}>
          {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Profile</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        <TextInput
          style={styles.input}
          value={oldPassword}
          onChangeText={setOldPassword}
          placeholder="Old password"
          secureTextEntry
          placeholderTextColor="#7a7d86"
        />
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New password"
          secureTextEntry
          placeholderTextColor="#7a7d86"
        />

        <Pressable
          style={[styles.primaryButton, savingPassword && styles.disabledButton]}
          disabled={savingPassword}
          onPress={onChangePassword}>
          {savingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Update Password</Text>}
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
