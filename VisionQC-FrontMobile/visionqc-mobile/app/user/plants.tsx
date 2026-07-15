import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getFollowUpDateLabel, getFollowUpMessage, getResultHighlights } from '@/lib/scan-insights';
import {
  createMyPlantAlias,
  deleteMyPlantAlias,
  getMyPlantAliases,
  updateMyPlantAlias,
  type PlantAliasItem,
  type ScanDetails,
} from '@/lib/user-features';

function buildSavedLocations(items: PlantAliasItem[]) {
  // Location suggestions come from the user's existing plant aliases.
  return Array.from(
    new Set(
      items
        .map((item) => (item.location || '').trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export default function UserPlantsScreen() {
  // Plants screen manages saved aliases and shows each alias's latest scan details.
  const [cards, setCards] = useState<PlantAliasItem[]>([]);
  const [savedLocations, setSavedLocations] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingPlantId, setEditingPlantId] = useState<string | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPlants = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const items = await getMyPlantAliases();
      setCards(items);
      setSavedLocations(buildSavedLocations(items));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your plant aliases right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPlants();
    }, [loadPlants])
  );

  const resetForm = useCallback(() => {
    setFormMode(null);
    setEditingPlantId(null);
    setAliasInput('');
    setLocationInput('');
    setShowLocationSuggestions(false);
  }, []);

  const toggleCard = useCallback((plantId: string) => {
    setExpandedId((current) => (current === plantId ? null : plantId));
  }, []);

  const startCreate = useCallback(() => {
    setMessage('');
    setError('');
    setExpandedId(null);
    setFormMode('create');
    setEditingPlantId(null);
    setAliasInput('');
    setLocationInput('');
    setShowLocationSuggestions(false);
  }, []);

  const startEdit = useCallback((item: PlantAliasItem) => {
    setMessage('');
    setError('');
    setExpandedId(item.id);
    setFormMode('edit');
    setEditingPlantId(item.id);
    setAliasInput(item.alias);
    setLocationInput(item.location || '');
    setShowLocationSuggestions(false);
  }, []);

  const submitForm = useCallback(async () => {
    // One form handles both create and edit so the UI stays compact on mobile.
    const alias = aliasInput.trim();
    const location = locationInput.trim();

    if (!alias) {
      setError('Alias is required.');
      return;
    }

    try {
      setBusyId(editingPlantId || 'create');
      setError('');
      setMessage('');

      if (formMode === 'edit' && editingPlantId) {
        const res = await updateMyPlantAlias(editingPlantId, { alias, location });
        setMessage('message' in res ? res.message : 'Plant alias updated.');
        setExpandedId(editingPlantId);
      } else {
        const res = await createMyPlantAlias({ alias, location });
        setMessage('message' in res ? res.message : 'Plant alias added.');
      }

      resetForm();
      await loadPlants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this plant alias.');
    } finally {
      setBusyId('');
    }
  }, [aliasInput, editingPlantId, formMode, loadPlants, locationInput, resetForm]);

  const confirmDelete = useCallback((item: PlantAliasItem) => {
    // Deleting is confirmed with a native alert before calling the API.
    Alert.alert(
      'Delete plant alias',
      `Delete "${item.alias}" from your plant aliases?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setBusyId(item.id);
                setError('');
                setMessage('');
                const res = await deleteMyPlantAlias(item.id);
                setMessage(res.message || 'Plant alias deleted.');
                if (expandedId === item.id) setExpandedId(null);
                if (editingPlantId === item.id) resetForm();
                await loadPlants();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete this plant alias.');
              } finally {
                setBusyId('');
              }
            })();
          },
        },
      ]
    );
  }, [editingPlantId, expandedId, loadPlants, resetForm]);

  const emptyText = useMemo(() => {
    if (loading) return '';
    if (locationFilter.trim()) return 'No plant aliases for this location.';
    return 'No plant aliases found yet. Add one from Scan Plant.';
  }, [loading, locationFilter]);

  const filteredCards = useMemo(() => {
    // Location filtering is local because all aliases are already loaded for this screen.
    const query = locationFilter.trim().toLowerCase();
    if (!query) return cards;

    return cards.filter((item) => (item.location || '').trim().toLowerCase().includes(query));
  }, [cards, locationFilter]);

  const locationSuggestions = useMemo(() => {
    const query = locationInput.trim().toLowerCase();
    const suggestions = query
      ? savedLocations.filter((item) => item.toLowerCase().includes(query))
      : savedLocations;

    return suggestions.slice(0, 6);
  }, [locationInput, savedLocations]);

  const renderCard = useCallback(
    ({ item }: { item: PlantAliasItem }) => {
      const isExpanded = expandedId === item.id;
      const isEditing = formMode === 'edit' && editingPlantId === item.id;
      const isBusy = busyId === item.id;
      // Plant alias endpoint includes latest scan fields, so we adapt them into ScanDetails for shared helpers.
      const latestScan: ScanDetails | null = item.lastScannedAt
        ? {
            id: item.latestScanId || item.id,
            plantAlias: item.alias,
            location: item.location,
            scannedAt: item.lastScannedAt,
            disease: item.latestDisease,
            confidence: item.latestConfidence,
            analysis: item.latestAnalysis,
            solution: item.latestSolution,
            severityLevel: item.latestSeverityLevel,
            urgencyLevel: item.latestUrgencyLevel,
            recommendedProducts: item.latestRecommendedProducts,
            careSteps: item.latestCareSteps,
            prevention: item.latestPrevention,
            rescanRecommended: item.latestRescanRecommended,
            rescanDays: item.latestRescanDays,
            rescanReason: item.latestRescanReason,
            imageUrl: item.latestImageUrl || '',
          }
        : null;
      const highlights = latestScan ? getResultHighlights(latestScan) : [];
      const followUpDate = latestScan ? getFollowUpDateLabel(latestScan) : null;
      const followUpMessage = latestScan ? getFollowUpMessage(latestScan) : null;

      return (
        <Pressable style={styles.card} onPress={() => toggleCard(item.id)}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.alias}>{item.alias}</Text>
              <Text style={styles.meta}>
                {item.scanCount} scan{item.scanCount === 1 ? '' : 's'}
                {item.lastScannedAt ? ` | Last updated ${new Date(item.lastScannedAt).toLocaleDateString()}` : ''}
              </Text>
            </View>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#0d4d3d" />
          </View>

          {isExpanded ? (
            <View style={styles.detailsWrap}>
              <Text style={styles.detailText}>Location: {item.location || 'Not set'}</Text>
              {latestScan ? (
                <>
                  <Text style={styles.detailText}>Disease: {latestScan.disease || 'Unknown'}</Text>
                  {highlights.map((highlight) => (
                    <Text key={highlight.label} style={styles.detailText}>
                      {highlight.label}: {highlight.value}
                    </Text>
                  ))}
                  {followUpDate ? <Text style={styles.detailText}>Next re-scan: {followUpDate}</Text> : null}
                  {followUpMessage ? <Text style={styles.followUp}>{followUpMessage}</Text> : null}
                  {latestScan.analysis ? <Text style={styles.detailText}>Analysis: {latestScan.analysis}</Text> : null}
                  {latestScan.solution ? <Text style={styles.detailText}>Solution: {latestScan.solution}</Text> : null}
                  {latestScan.recommendedProducts?.length ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailTitle}>Recommended Products</Text>
                      {latestScan.recommendedProducts.map((product, index) => (
                        <Text key={`${item.id}-product-${index}`} style={styles.detailText}>- {product}</Text>
                      ))}
                    </View>
                  ) : null}
                  {latestScan.prevention ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailTitle}>Prevention</Text>
                      <Text style={styles.detailText}>{latestScan.prevention}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.detailText}>No scan details yet for this alias.</Text>
              )}

              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.secondaryButton, isBusy && styles.disabledButton]}
                  disabled={isBusy}
                  onPress={() => startEdit(item)}>
                  <Text style={styles.secondaryButtonText}>{isEditing ? 'Editing' : 'Edit'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.dangerButton, isBusy && styles.disabledButton]}
                  disabled={isBusy}
                  onPress={() => confirmDelete(item)}>
                  <Text style={styles.dangerButtonText}>{isBusy ? 'Deleting...' : 'Delete'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </Pressable>
      );
    },
    [busyId, confirmDelete, editingPlantId, expandedId, formMode, startEdit, toggleCard]
  );

  const showForm = formMode !== null;
  const formBusy = busyId === (editingPlantId || 'create');

  const listHeader = useMemo(
    () => (
      <View style={styles.header}>
        <Text style={styles.title}>My Plant Aliases</Text>
        <Text style={styles.subtitle}>Tap any alias to open its latest saved details and manage your list.</Text>
        <TextInput
          style={styles.input}
          value={locationFilter}
          onChangeText={setLocationFilter}
          placeholder="Filter by location"
          placeholderTextColor="#7a7d86"
        />
        <Pressable style={styles.primaryButton} onPress={startCreate}>
          <Text style={styles.primaryButtonText}>Add Plant Alias</Text>
        </Pressable>
        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{formMode === 'edit' ? 'Edit Plant Alias' : 'Add Plant Alias'}</Text>
            <TextInput
              style={styles.input}
              value={aliasInput}
              onChangeText={setAliasInput}
              placeholder="Plant alias"
              placeholderTextColor="#7a7d86"
            />
            <TextInput
              style={styles.input}
              value={locationInput}
              onChangeText={(value) => {
                setLocationInput(value);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              placeholder="Location (optional)"
              placeholderTextColor="#7a7d86"
            />
            {showLocationSuggestions && locationSuggestions.length ? (
              <View style={styles.locationSuggestionsCard}>
                {locationSuggestions.map((item) => (
                  <Pressable
                    key={item}
                    style={styles.locationSuggestionOption}
                    onPress={() => {
                      setLocationInput(item);
                      setShowLocationSuggestions(false);
                    }}>
                    <Text style={styles.locationSuggestionText}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.formActions}>
              <Pressable
                style={[styles.primaryButton, formBusy && styles.disabledButton]}
                disabled={formBusy}
                onPress={submitForm}>
                <Text style={styles.primaryButtonText}>
                  {formBusy ? 'Saving...' : formMode === 'edit' ? 'Save Changes' : 'Create Alias'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                disabled={formBusy}
                onPress={resetForm}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {loading ? <ActivityIndicator color="#0d4d3d" /> : null}
        {!!message ? <Text style={styles.message}>{message}</Text> : null}
        {!!error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    ),
    [
      aliasInput,
      error,
      formBusy,
      formMode,
      loading,
      locationFilter,
      locationInput,
      locationSuggestions,
      message,
      resetForm,
      showForm,
      showLocationSuggestions,
      startCreate,
      submitForm,
    ]
  );

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.container}
      data={filteredCards}
      renderItem={renderCard}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>{emptyText}</Text> : null}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      extraData={{ expandedId, busyId, editingPlantId, formMode }}
      removeClippedSubviews
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
    gap: 12,
    flexGrow: 1,
  },
  header: {
    gap: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0d4d3d',
  },
  subtitle: {
    color: '#4b5563',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#0d4d3d',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 14,
    gap: 10,
  },
  formTitle: {
    color: '#0d4d3d',
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  locationSuggestionsCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  locationSuggestionOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f0',
  },
  locationSuggestionText: {
    color: '#0d4d3d',
    fontSize: 13,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
    gap: 4,
  },
  alias: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0d4d3d',
  },
  meta: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailsWrap: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  detailBlock: {
    marginTop: 6,
    gap: 4,
  },
  detailTitle: {
    color: '#0d4d3d',
    fontSize: 13,
    fontWeight: '700',
  },
  detailText: {
    color: '#1f2937',
    fontSize: 13,
    lineHeight: 20,
  },
  followUp: {
    color: '#0d4d3d',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#e7efec',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#0d4d3d',
    fontWeight: '700',
    fontSize: 12,
  },
  dangerButton: {
    flex: 1,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dangerButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  message: {
    color: '#0f7a4b',
    fontSize: 13,
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
  empty: {
    color: '#6b7280',
    fontSize: 13,
  },
});
