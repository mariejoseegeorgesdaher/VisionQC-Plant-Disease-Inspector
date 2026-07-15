import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import {
  AliasSelectorCard,
  ImagePickerCard,
  LocationField,
  QualityAssistantCard,
  ScanResultCard,
} from '@/components/screens/scan-screen-sections';
import { assessPickedImageQuality, getFollowUpMessage, getRecommendedRescanInDays, getResultHighlights } from '@/lib/scan-insights';
import {
  getCachedScanFormData,
  setCachedScanFormData,
  updateCachedScanFormData,
} from '@/lib/scan-form-cache';
import { scheduleRescanReminder } from '@/lib/rescan-reminders';
import {
  createMyPlantAlias,
  createMyScan,
  getMyAliases,
  getMyPlantAliases,
  type ScanDetails,
} from '@/lib/user-features';

type PickedImage = {
  uri: string;
  mimeType?: string;
  fileName?: string;
  width?: number;
  height?: number;
  fileSize?: number;
};

const INVALID_IMAGE_MESSAGE = 'Please choose a valid plant photo from your camera or gallery.';

function isValidImageMimeType(mimeType?: string) {
  return !!mimeType && /^image\/(png|jpe?g|webp|heic|heif)$/i.test(mimeType);
}

function buildSavedLocations(items: Awaited<ReturnType<typeof getMyPlantAliases>>) {
  // Locations are derived from saved plant aliases so the scan form can suggest previous places.
  return Array.from(
    new Set(
      items
        .map((item) => (item.location || '').trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export default function UserScanScreen() {
  // This screen collects image + alias/location, sends the scan, then renders the diagnosis result.
  const [aliases, setAliases] = useState<string[]>([]);
  const [savedLocations, setSavedLocations] = useState<string[]>([]);
  const [selectedAlias, setSelectedAlias] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [location, setLocation] = useState('');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showAliasMenu, setShowAliasMenu] = useState(false);
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [result, setResult] = useState<ScanDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingAlias, setSavingAlias] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState('');
  const [notificationNote, setNotificationNote] = useState('');

  const loadAliases = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setBooting(true);
      }

      const [items, plantItems] = await Promise.all([getMyAliases(), getMyPlantAliases()]);
      const nextLocations = buildSavedLocations(plantItems);

      setAliases(items);
      setSavedLocations(nextLocations);
      setCachedScanFormData({
        aliases: items,
        savedLocations: nextLocations,
      });

      if (items.length > 0) {
        setSelectedAlias((current) => current || items[0]);
      }
    } catch {
      // Scanning can still continue even if alias suggestions are temporarily unavailable.
    } finally {
      if (!options?.silent) {
        setBooting(false);
      }
    }
  }, []);

  useEffect(() => {
    // Cached form data makes returning to Scan Plant feel instant while a fresh fetch runs quietly.
    const cached = getCachedScanFormData();

    if (cached) {
      setAliases(cached.aliases);
      setSavedLocations(cached.savedLocations);
      setBooting(false);

      if (cached.aliases.length > 0) {
        setSelectedAlias((current) => current || cached.aliases[0]);
      }

      void loadAliases({ silent: true });
      return;
    }

    void loadAliases();
  }, [loadAliases]);

  const canSubmit = useMemo(() => {
    const aliasValue = selectedAlias === '__other__' ? customAlias.trim() : selectedAlias.trim();
    return !!aliasValue && !!picked && !loading;
  }, [customAlias, loading, picked, selectedAlias]);

  const canSaveAlias = useMemo(
    () => selectedAlias === '__other__' && !!customAlias.trim() && !savingAlias,
    [customAlias, savingAlias, selectedAlias]
  );

  const qualityChecks = useMemo(() => assessPickedImageQuality(picked), [picked]);
  const qualityHasWarning = useMemo(
    () => qualityChecks.some((check) => check.state === 'warning'),
    [qualityChecks]
  );
  const resultHighlights = useMemo(() => (result ? getResultHighlights(result) : []), [result]);
  const followUpMessage = useMemo(() => (result ? getFollowUpMessage(result) : null), [result]);

  const setPickedFromAsset = useCallback((asset: ImagePicker.ImagePickerAsset) => {
    // ImagePicker returns local file metadata; we validate it before building FormData later.
    const mimeType = asset.mimeType || 'image/jpeg';
    if (!isValidImageMimeType(mimeType)) {
      setPicked(null);
      setResult(null);
      setError(INVALID_IMAGE_MESSAGE);
      setNotificationNote('');
      return;
    }

    setPicked({
      uri: asset.uri,
      fileName: asset.fileName || `scan-${Date.now()}.jpg`,
      mimeType,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
    });
    setError('');
    setNotificationNote('');
  }, []);

  const uploadFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Please allow gallery access to choose a plant image.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (res.canceled || !res.assets.length) return;
    setPickedFromAsset(res.assets[0]);
  }, [setPickedFromAsset]);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Please allow camera access to take a plant photo.');
      return;
    }

    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.back,
    });

    if (res.canceled || !res.assets.length) return;
    setPickedFromAsset(res.assets[0]);
  }, [setPickedFromAsset]);

  const openImageActionMenu = useCallback(() => {
    Alert.alert('Add plant image', 'Choose how you want to add the scan image.', [
      { text: 'Take Photo', onPress: () => void takePhoto() },
      { text: 'Choose Photo', onPress: () => void uploadFromGallery() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [takePhoto, uploadFromGallery]);

  const submitScan = useCallback(async () => {
    if (!canSubmit || !picked) return;

    if (!isValidImageMimeType(picked.mimeType)) {
      setError(INVALID_IMAGE_MESSAGE);
      return;
    }

    const aliasValue = selectedAlias === '__other__' ? customAlias.trim() : selectedAlias.trim();
    const trimmedLocation = location.trim();

    try {
      setLoading(true);
      setError('');
      setNotificationNote('');

      const created = await createMyScan({
        alias: aliasValue,
        location: trimmedLocation,
        imageUri: picked.uri,
        fileName: picked.fileName,
        mimeType: picked.mimeType,
      });
      setResult(created);
      // Keep new aliases/locations available immediately for the next scan.
      updateCachedScanFormData({
        alias: aliasValue,
        location: trimmedLocation,
      });

      const reminderDays = getRecommendedRescanInDays(created);
      if (reminderDays) {
        // Diseased scan results can schedule a local reminder for the follow-up scan.
        const scheduled = await scheduleRescanReminder({
          alias: created.plantAlias || aliasValue,
          daysUntilReminder: reminderDays,
          disease: created.disease,
          location: created.location || trimmedLocation,
          reason: created.rescanReason || created.followUpMessage,
        });

        setNotificationNote(
          scheduled
            ? `Reminder scheduled for ${reminderDays} day${reminderDays === 1 ? '' : 's'} after treatment begins.`
            : 'Reminder was skipped because notification permission is not enabled.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload this scan right now.');
    } finally {
      setLoading(false);
    }
  }, [canSubmit, customAlias, location, picked, selectedAlias]);

  const handleSaveAlias = useCallback(async () => {
    // Optional shortcut: users can save a new plant alias before uploading a scan.
    const aliasValue = customAlias.trim();
    const trimmedLocation = location.trim();
    if (!aliasValue) {
      setError('Please type a new alias before saving it.');
      return;
    }

    try {
      setSavingAlias(true);
      setError('');
      setNotificationNote('');

      await createMyPlantAlias({
        alias: aliasValue,
        location: trimmedLocation,
      });

      setAliases((currentAliases) =>
        Array.from(new Set([...currentAliases, aliasValue])).sort((left, right) => left.localeCompare(right))
      );
      setSavedLocations((currentLocations) =>
        trimmedLocation
          ? Array.from(new Set([...currentLocations, trimmedLocation])).sort((left, right) =>
              left.localeCompare(right)
            )
          : currentLocations
      );
      updateCachedScanFormData({
        alias: aliasValue,
        location: trimmedLocation,
      });
      setSelectedAlias(aliasValue);
      setCustomAlias('');
      setShowAliasMenu(false);
      setNotificationNote(`Alias "${aliasValue}" saved and selected.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this alias right now.');
    } finally {
      setSavingAlias(false);
    }
  }, [customAlias, location]);

  const selectedAliasLabel = useMemo(() => {
    if (selectedAlias === '__other__') return customAlias.trim() || 'Other';
    return selectedAlias || 'Choose alias';
  }, [customAlias, selectedAlias]);

  const locationSuggestions = useMemo(() => {
    const query = location.trim().toLowerCase();
    const suggestions = query
      ? savedLocations.filter((item) => item.toLowerCase().includes(query))
      : savedLocations;

    return suggestions.slice(0, 6);
  }, [location, savedLocations]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Scan Plant</Text>

      <View style={styles.card}>
        <ImagePickerCard picked={picked} onPress={openImageActionMenu} />

        <AliasSelectorCard
          aliases={aliases.filter(Boolean)}
          selectedAlias={selectedAlias}
          selectedAliasLabel={selectedAliasLabel}
          showAliasMenu={showAliasMenu}
          customAlias={customAlias}
          canSaveAlias={canSaveAlias}
          savingAlias={savingAlias}
          onToggleMenu={() => setShowAliasMenu((prev) => !prev)}
          onSelectAlias={(item) => {
            setSelectedAlias(item);
            if (item !== '__other__') {
              setCustomAlias('');
            }
            setShowAliasMenu(false);
          }}
          onChangeCustomAlias={setCustomAlias}
          onSaveAlias={() => void handleSaveAlias()}
        />

        <LocationField
          aliasesCount={aliases.length}
          location={location}
          locationSuggestions={locationSuggestions}
          showLocationSuggestions={showLocationSuggestions}
          onChangeLocation={(value) => {
            setLocation(value);
            setShowLocationSuggestions(true);
          }}
          onFocusLocation={() => setShowLocationSuggestions(true)}
          onSelectLocation={(value) => {
            setLocation(value);
            setShowLocationSuggestions(false);
          }}
        />

        <QualityAssistantCard qualityChecks={qualityChecks} qualityHasWarning={qualityHasWarning} />

        <Pressable
          disabled={!canSubmit}
          style={[styles.primaryButton, !canSubmit && styles.disabledButton]}
          onPress={submitScan}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Upload & Analyze</Text>}
        </Pressable>

        {booting ? <Text style={styles.hint}>Loading aliases...</Text> : null}
        {!!error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {result ? (
        <ScanResultCard
          result={result}
          resultHighlights={resultHighlights}
          followUpMessage={followUpMessage}
          notificationNote={notificationNote}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
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
  title: {
    fontSize: 24,
    color: '#0d4d3d',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 14,
    gap: 8,
  },
  hint: {
    color: '#2a2d35',
    opacity: 0.7,
    fontSize: 12,
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
});
