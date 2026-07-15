import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getMyScans, type ScanListItem } from '@/lib/user-features';
import { getFollowUpDateLabel, getFollowUpMessage, getResultHighlights, isHealthyDiagnosis } from '@/lib/scan-insights';
import { MoreInfoChatCard } from '@/components/screens/scan-screen-sections';

type HealthFilter = 'All' | 'Healthy' | 'Diseased';
type DateFilter = 'All Dates' | 'This Month';

function normalizeText(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function isHealthyScan(item: ScanListItem) {
  return isHealthyDiagnosis(item.disease);
}

function isWithinThisMonth(scannedAt: string) {
  // Date filter uses the device's local month/year.
  const date = new Date(scannedAt);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export default function UserHistoryScreen() {
  // History screen loads saved scans and lets users filter/expand each diagnosis.
  const [items, setItems] = useState<ScanListItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('All Dates');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setItems(await getMyScans());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your scan history right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  const toggleDetails = useCallback((scanId: string) => {
    setExpandedId((current) => (current === scanId ? null : scanId));
  }, []);

  const filteredItems = useMemo(() => {
    // Filtering is local because history is already loaded from the user scan endpoint.
    const query = normalizeText(searchFilter);

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        normalizeText(item.plantAlias).includes(query) ||
        normalizeText(item.location).includes(query);

      const matchesHealth =
        healthFilter === 'All' ||
        (healthFilter === 'Healthy' ? isHealthyScan(item) : !isHealthyScan(item));

      const matchesDate =
        dateFilter === 'All Dates' || isWithinThisMonth(item.scannedAt);

      return matchesSearch && matchesHealth && matchesDate;
    });
  }, [dateFilter, healthFilter, items, searchFilter]);

  const emptyText = useMemo(() => {
    if (loading) return '';
    if (searchFilter.trim() || healthFilter !== 'All' || dateFilter !== 'All Dates') {
      return 'No scans match these filters.';
    }
    return 'No scans yet. Create one from Scan Plant.';
  }, [dateFilter, healthFilter, loading, searchFilter]);

  const renderItem = useCallback(
    ({ item }: { item: ScanListItem }) => {
      const itemHighlights = getResultHighlights(item);
      // Scan insight helpers keep card display logic consistent with scan and plant screens.
      const itemFollowUpDate = getFollowUpDateLabel(item);
      const itemFollowUpMessage = getFollowUpMessage(item);
      const isExpanded = expandedId === item.id;

      return (
        <Pressable style={styles.card} onPress={() => toggleDetails(item.id)}>
          <Text style={styles.cardTitle}>{item.plantAlias}</Text>
          <Text style={styles.cardText}>Disease: {item.disease || 'Unknown'}</Text>
          {itemHighlights.map((detail) => (
            <Text key={detail.label} style={styles.cardText}>{detail.label}: {detail.value}</Text>
          ))}
          {itemFollowUpDate ? (
            <Text style={styles.cardText}>Next re-scan: {itemFollowUpDate}</Text>
          ) : null}
          <Text style={styles.cardText}>{new Date(item.scannedAt).toLocaleString()}</Text>
          {isExpanded ? (
            <View style={styles.inlineDetails}>
              <Text style={styles.cardText}>Location: {item.location || 'Not set'}</Text>
              {item.analysis ? <Text style={styles.cardText}>Analysis: {item.analysis}</Text> : null}
              {item.solution ? <Text style={styles.cardText}>Solution: {item.solution}</Text> : null}
              {item.recommendedProducts?.length ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailTitle}>Recommended Products</Text>
                  {item.recommendedProducts.map((product, index) => (
                    <Text key={`${item.id}-product-${index}`} style={styles.cardText}>- {product}</Text>
                  ))}
                </View>
              ) : null}
              {item.prevention ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailTitle}>Prevention</Text>
                  <Text style={styles.cardText}>{item.prevention}</Text>
                </View>
              ) : null}
              {itemFollowUpMessage ? <Text style={styles.followUp}>{itemFollowUpMessage}</Text> : null}
              <MoreInfoChatCard scan={item} />
            </View>
          ) : null}
        </Pressable>
      );
    },
    [expandedId, toggleDetails]
  );

  const listHeader = useMemo(
    () => (
      <>
        <Text style={styles.title}>My History</Text>

        <View style={styles.filtersCard}>
          <Text style={styles.filtersLabel}>Filter by alias or location</Text>

          <View style={styles.searchBox}>
            <Ionicons name="location-outline" size={18} color="#7f988f" />
            <TextInput
              style={styles.searchInput}
              value={searchFilter}
              onChangeText={setSearchFilter}
              placeholder="Type alias or location"
              placeholderTextColor="#8b918d"
            />
          </View>

          <View style={styles.chipsRow}>
            {(['All', 'Healthy', 'Diseased'] as const).map((option) => (
              <Pressable
                key={option}
                style={[styles.chip, healthFilter === option && styles.chipActive]}
                onPress={() => setHealthFilter(option)}>
                <Text style={[styles.chipText, healthFilter === option && styles.chipTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chipsRow}>
            {(['All Dates', 'This Month'] as const).map((option) => (
              <Pressable
                key={option}
                style={[styles.chip, dateFilter === option && styles.chipActive]}
                onPress={() => setDateFilter(option)}>
                <Text style={[styles.chipText, dateFilter === option && styles.chipTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.refreshButton} onPress={loadHistory}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color="#0d4d3d" /> : null}
        {!!error ? <Text style={styles.error}>{error}</Text> : null}
      </>
    ),
    [dateFilter, error, healthFilter, loadHistory, loading, searchFilter]
  );

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.container}
      data={filteredItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
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
    gap: 3,
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
  inlineDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 4,
  },
  detailBlock: {
    marginTop: 6,
    gap: 4,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d4d3d',
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
  followUp: {
    marginTop: 4,
    color: '#0d4d3d',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
});
