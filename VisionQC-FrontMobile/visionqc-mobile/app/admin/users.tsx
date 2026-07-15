import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getAdminUsers, type AdminUser } from '@/lib/admin';

export default function AdminUsersScreen() {
  // Mobile admin user management is intentionally read-only: list, search, and filter only.
  const [items, setItems] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'All' | 'Regular' | 'Admin'>('All');
  const [status, setStatus] = useState<'All' | 'true' | 'false'>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Filters are sent to the backend so the mobile screen does not need to load all users.
      const res = await getAdminUsers({
        search: search.trim() || undefined,
        role: role === 'All' ? undefined : role,
        isActive: status === 'All' ? undefined : status,
        page: 1,
        pageSize: 40,
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [role, search, status]);

  useFocusEffect(
    useCallback(() => {
      void loadUsers();
    }, [loadUsers])
  );

  const renderItem = useCallback(
    ({ item: u }: { item: AdminUser }) => {
      return (
        <View style={styles.userCard}>
          <Text style={styles.userName}>{u.fullName}</Text>
          <Text style={styles.meta}>{u.email}</Text>
          <Text style={styles.meta}>Role: {u.role} | {u.isActive ? 'Active' : 'Inactive'} | Scans: {u.scanCount}</Text>
        </View>
      );
    },
    []
  );

  const listHeader = (
    <>
      <Text style={styles.title}>Manage Users</Text>

      <View style={styles.filtersCard}>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email"
          placeholderTextColor="#7a7d86"
        />

        <View style={styles.chipsRow}>
          {(['All', 'Regular', 'Admin'] as const).map((r) => (
            <Pressable
              key={r}
              style={[styles.chip, role === r && styles.chipActive]}
              onPress={() => setRole(r)}>
              <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.chipsRow}>
          {(['All', 'true', 'false'] as const).map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, status === s && styles.chipActive]}
              onPress={() => setStatus(s)}>
              <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
                {s === 'All' ? 'All Status' : s === 'true' ? 'Active' : 'Inactive'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.refreshButton} onPress={loadUsers}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </Pressable>
      </View>

      {!!error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#0d4d3d" /> : null}
    </>
  );

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f6f5f1',
    gap: 10,
  },
  title: {
    fontSize: 24,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  filtersCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 12,
    gap: 8,
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#e7efec',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#0d4d3d',
  },
  chipText: {
    color: '#0d4d3d',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  refreshButton: {
    backgroundColor: '#0d4d3d',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 12,
    gap: 4,
  },
  userName: {
    fontSize: 16,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    color: '#2a2d35',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
});
