import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  getScheduledRescanReminders,
  type ScheduledRescanReminder,
} from '@/lib/rescan-reminders';

type ReminderStatus = 'Scheduled' | 'Due';

function normalizeText(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function formatDateTime(value: string) {
  if (!value) return 'Date unavailable';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getReminderStatus(reminder: ScheduledRescanReminder): ReminderStatus {
  // A reminder becomes "Due" once its scheduled date/time is in the past.
  const dueTime = new Date(reminder.dueAt).getTime();
  if (!Number.isNaN(dueTime) && dueTime <= Date.now()) return 'Due';
  return 'Scheduled';
}

export default function UserRemindersScreen() {
  // This screen reads locally scheduled Expo notifications; it does not call a backend reminders API.
  const [items, setItems] = useState<ScheduledRescanReminder[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ReminderStatus>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReminders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setItems(await getScheduledRescanReminders());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reminders right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReminders();
    }, [loadReminders])
  );

  const filteredItems = useMemo(() => {
    // Filtering is local because reminder metadata is already stored on the device.
    const query = normalizeText(searchFilter);

    return items.filter((item) => {
      const status = getReminderStatus(item);
      const matchesStatus = statusFilter === 'All' || statusFilter === status;
      const matchesSearch =
        !query ||
        normalizeText(item.alias).includes(query) ||
        normalizeText(item.disease).includes(query) ||
        normalizeText(item.location).includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [items, searchFilter, statusFilter]);

  const reminderStats = useMemo(
    () =>
      items.reduce(
        (stats, item) => {
          // Counts feed the small summary cards at the top of the screen.
          stats[getReminderStatus(item)] += 1;
          return stats;
        },
        { Scheduled: 0, Due: 0 } as Record<ReminderStatus, number>
      ),
    [items]
  );

  const emptyText = useMemo(() => {
    if (loading) return '';
    if (searchFilter.trim() || statusFilter !== 'All') return 'No reminders match these filters.';
    return 'No re-scan reminders yet. Create a scan with a follow-up recommendation first.';
  }, [loading, searchFilter, statusFilter]);

  const renderItem = useCallback(
    ({ item }: { item: ScheduledRescanReminder }) => {
      const status = getReminderStatus(item);
      const isExpanded = expandedId === item.notificationId;

      return (
        <Pressable
          style={[styles.card, status === 'Due' && styles.dueCard]}
          onPress={() => setExpandedId((current) => (current === item.notificationId ? null : item.notificationId))}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.cardTitle}>{item.alias || 'Unknown plant'}</Text>
              <Text style={styles.cardText}>{item.disease || 'Follow-up re-scan'}</Text>
            </View>
            <View style={[styles.statusPill, status === 'Due' && styles.duePill]}>
              <Text style={[styles.statusText, status === 'Due' && styles.duePillText]}>{status}</Text>
            </View>
          </View>

          <Text style={styles.cardText}>Due: {formatDateTime(item.dueAt)}</Text>
          {item.location ? <Text style={styles.cardText}>Location: {item.location}</Text> : null}

          {isExpanded ? (
            <View style={styles.inlineDetails}>
              <Text style={styles.detailText}>
                Window: {item.daysUntilReminder > 0 ? `${item.daysUntilReminder} day${item.daysUntilReminder === 1 ? '' : 's'}` : 'Not set'}
              </Text>
              <Text style={styles.detailText}>Scheduled: {formatDateTime(item.scheduledAt)}</Text>
              {item.reason ? <Text style={styles.followUp}>{item.reason}</Text> : null}
            </View>
          ) : null}
        </Pressable>
      );
    },
    [expandedId]
  );

  const listHeader = useMemo(
    () => (
      <>
        <Text style={styles.title}>Reminders</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{reminderStats.Scheduled}</Text>
            <Text style={styles.statLabel}>Scheduled</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.dueText]}>{reminderStats.Due}</Text>
            <Text style={styles.statLabel}>Due</Text>
          </View>
        </View>

        <View style={styles.filtersCard}>
          <Text style={styles.filtersLabel}>Find reminders by alias, disease, or location</Text>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#7f988f" />
            <TextInput
              style={styles.searchInput}
              value={searchFilter}
              onChangeText={setSearchFilter}
              placeholder="Search reminders"
              placeholderTextColor="#8b918d"
            />
          </View>

          <View style={styles.chipsRow}>
            {(['All', 'Scheduled', 'Due'] as const).map((option) => (
              <Pressable
                key={option}
                style={[styles.chip, statusFilter === option && styles.chipActive]}
                onPress={() => setStatusFilter(option)}>
                <Text style={[styles.chipText, statusFilter === option && styles.chipTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.refreshButton} onPress={loadReminders}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color="#0d4d3d" /> : null}
        {!!error ? <Text style={styles.error}>{error}</Text> : null}
      </>
    ),
    [error, loadReminders, loading, reminderStats, searchFilter, statusFilter]
  );

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.container}
      data={filteredItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.notificationId}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>{emptyText}</Text> : null}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      extraData={expandedId}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#f6f5f1',
  },
  container: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#f6f5f1',
    gap: 10,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 12,
  },
  statValue: {
    color: '#0d4d3d',
    fontSize: 24,
    fontWeight: '700',
  },
  dueText: {
    color: '#b42318',
  },
  statLabel: {
    color: '#2a2d35',
    fontSize: 13,
    opacity: 0.7,
  },
  filtersCard: {
    backgroundColor: '#ebe8de',
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  filtersLabel: {
    color: '#46544d',
    fontSize: 14,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f6f4ef',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: '#f7f5ef',
    borderWidth: 1,
    borderColor: '#d8d5c9',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#0d5a4a',
    borderColor: '#0d5a4a',
  },
  chipText: {
    color: '#0d5a4a',
    fontSize: 13,
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 12,
    gap: 6,
  },
  dueCard: {
    borderColor: '#f3b6a8',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitleGroup: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0d4d3d',
  },
  cardText: {
    fontSize: 13,
    color: '#2a2d35',
  },
  statusPill: {
    backgroundColor: '#e7efec',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  duePill: {
    backgroundColor: '#fee4df',
  },
  statusText: {
    color: '#0d4d3d',
    fontSize: 12,
    fontWeight: '700',
  },
  duePillText: {
    color: '#b42318',
  },
  inlineDetails: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 4,
  },
  detailText: {
    color: '#2a2d35',
    fontSize: 13,
  },
  followUp: {
    marginTop: 4,
    color: '#0d4d3d',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
  empty: {
    fontSize: 13,
    color: '#2a2d35',
    opacity: 0.75,
  },
});
