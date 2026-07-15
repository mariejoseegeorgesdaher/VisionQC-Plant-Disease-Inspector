import { memo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { askMoreInfoQuestion } from '@/lib/more-info-chat';
import type { ScanDetails, ScanListItem } from '@/lib/user-features';

type PickedImage = {
  uri: string;
};

type QualityCheck = {
  key: string;
  label: string;
  state: 'good' | 'warning';
  summary: string;
  hint: string;
};

type ResultHighlight = {
  label: string;
  value: string;
};

type ImagePickerCardProps = {
  picked: PickedImage | null;
  onPress: () => void;
};

// Reusable image chooser used by the scan screen; the parent owns camera/gallery behavior.
export const ImagePickerCard = memo(function ImagePickerCard({ picked, onPress }: ImagePickerCardProps) {
  return (
    <>
      <Text style={styles.label}>Plant Image</Text>
      <Pressable style={styles.imageChooser} onPress={onPress}>
        {picked ? (
          <View>
            <Image source={{ uri: picked.uri }} style={styles.imageChooserPreview} />
            <View style={styles.imageChooserOverlay}>
              <Ionicons name="camera-outline" size={18} color="#0d4d3d" />
              <Text style={styles.imageChooserOverlayText}>Change photo</Text>
            </View>
          </View>
        ) : (
          <View style={styles.imageChooserEmpty}>
            <View style={styles.imageChooserIcon}>
              <Ionicons name="camera-outline" size={28} color="#0d4d3d" />
            </View>
            <Text style={styles.imageChooserTitle}>Add a scan photo</Text>
            <Text style={styles.imageChooserHint}>Tap to take a photo or choose one from your gallery.</Text>
          </View>
        )}
      </Pressable>
    </>
  );
});

type AliasSelectorCardProps = {
  aliases: string[];
  selectedAlias: string;
  selectedAliasLabel: string;
  showAliasMenu: boolean;
  customAlias: string;
  canSaveAlias: boolean;
  savingAlias: boolean;
  onToggleMenu: () => void;
  onSelectAlias: (item: string) => void;
  onChangeCustomAlias: (value: string) => void;
  onSaveAlias: () => void;
};

export const AliasSelectorCard = memo(function AliasSelectorCard({
  aliases,
  selectedAlias,
  selectedAliasLabel,
  showAliasMenu,
  customAlias,
  canSaveAlias,
  savingAlias,
  onToggleMenu,
  onSelectAlias,
  onChangeCustomAlias,
  onSaveAlias,
}: AliasSelectorCardProps) {
  // "__other__" is a local sentinel option for entering a new alias.
  const aliasOptions = [...aliases, '__other__'];

  return (
    <>
      <Text style={styles.label}>Plant Alias</Text>
      <Pressable style={styles.dropdownField} onPress={onToggleMenu}>
        <Text style={styles.dropdownText}>{selectedAliasLabel}</Text>
        <Ionicons
          name={showAliasMenu ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={18}
          color="#0d4d3d"
        />
      </Pressable>

      {showAliasMenu ? (
        <View style={styles.aliasMenu}>
          {aliasOptions.map((item) => (
            <Pressable key={item} style={styles.aliasMenuOption} onPress={() => onSelectAlias(item)}>
              <Text style={styles.aliasMenuText}>{item === '__other__' ? 'Other' : item}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {selectedAlias === '__other__' ? (
        <View style={styles.customAliasWrap}>
          <TextInput
            style={[styles.input, styles.customAliasInput]}
            value={customAlias}
            onChangeText={onChangeCustomAlias}
            placeholder="Type a new alias"
            placeholderTextColor="#7a7d86"
          />
          <Pressable
            style={[styles.saveAliasButton, !canSaveAlias && styles.disabledButton]}
            disabled={!canSaveAlias}
            onPress={onSaveAlias}>
            {savingAlias ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveAliasButtonText}>Save</Text>}
          </Pressable>
        </View>
      ) : null}
    </>
  );
});

type LocationFieldProps = {
  aliasesCount: number;
  location: string;
  locationSuggestions: string[];
  showLocationSuggestions: boolean;
  onChangeLocation: (value: string) => void;
  onFocusLocation: () => void;
  onSelectLocation: (value: string) => void;
};

export const LocationField = memo(function LocationField({
  aliasesCount,
  location,
  locationSuggestions,
  showLocationSuggestions,
  onChangeLocation,
  onFocusLocation,
  onSelectLocation,
}: LocationFieldProps) {
  // Location is optional, but suggestions help users keep names consistent.
  return (
    <>
      {!!aliasesCount ? <Text style={styles.hint}>Saved aliases come from your plant list.</Text> : null}
      <Text style={styles.hint}>A new alias is saved automatically when you tap Upload & Analyze.</Text>

      <Text style={styles.label}>Location (Optional)</Text>
      <TextInput
        style={styles.input}
        value={location}
        onChangeText={onChangeLocation}
        onFocus={onFocusLocation}
        placeholder="e.g. Kitchen balcony"
        placeholderTextColor="#7a7d86"
      />
      {showLocationSuggestions && locationSuggestions.length ? (
        <View style={styles.locationSuggestionsCard}>
          {locationSuggestions.map((item) => (
            <Pressable key={item} style={styles.locationSuggestionOption} onPress={() => onSelectLocation(item)}>
              <Text style={styles.locationSuggestionText}>{item}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
});

type QualityAssistantCardProps = {
  qualityChecks: QualityCheck[];
  qualityHasWarning: boolean;
};

export const QualityAssistantCard = memo(function QualityAssistantCard({
  qualityChecks,
  qualityHasWarning,
}: QualityAssistantCardProps) {
  // Quality hints are local metadata checks shown before upload.
  if (!qualityChecks.length) return null;

  return (
    <View style={[styles.qualityCard, qualityHasWarning && styles.qualityCardWarning]}>
      <Text style={styles.qualityTitle}>Scan Quality Assistant</Text>
      {qualityChecks.map((check) => (
        <View key={check.key} style={styles.qualityRow}>
          <View style={[styles.qualityBadge, check.state === 'warning' ? styles.warningBadge : styles.goodBadge]}>
            <Text style={styles.qualityBadgeText}>{check.label}</Text>
          </View>
          {check.state === 'warning' ? (
            <View style={styles.qualityCopy}>
              <Text style={styles.qualitySummary}>{check.summary}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
});

type ScanResultCardProps = {
  result: ScanDetails;
  resultHighlights: ResultHighlight[];
  followUpMessage: string | null;
  notificationNote: string;
};

export const ScanResultCard = memo(function ScanResultCard({
  result,
  resultHighlights,
  followUpMessage,
  notificationNote,
}: ScanResultCardProps) {
  // Result card renders normalized scan data returned after createMyScan.
  return (
    <View style={styles.resultCard}>
      <Text style={styles.subtitle}>Scan Result</Text>
      <Text style={styles.value}>Alias: {result.plantAlias}</Text>
      <Text style={styles.value}>Disease: {result.disease || 'Unknown'}</Text>
      {resultHighlights.map((item) => (
        <Text key={item.label} style={styles.value}>{item.label}: {item.value}</Text>
      ))}
      <Text style={styles.value}>Analysis: {result.analysis || 'N/A'}</Text>
      <Text style={styles.value}>Solution: {result.solution || 'N/A'}</Text>
      {result.recommendedProducts?.length ? (
        <View style={styles.detailBlock}>
          <Text style={styles.detailTitle}>Recommended Products</Text>
          {result.recommendedProducts.map((product, index) => (
            <Text key={`${product}-${index}`} style={styles.bulletText}>- {product}</Text>
          ))}
        </View>
      ) : null}
      {result.prevention ? (
        <View style={styles.detailBlock}>
          <Text style={styles.detailTitle}>Prevention</Text>
          <Text style={styles.value}>{result.prevention}</Text>
        </View>
      ) : null}
      {followUpMessage ? <Text style={styles.followUp}>{followUpMessage}</Text> : null}
      <MoreInfoChatCard scan={result} />
      {!!notificationNote ? <Text style={styles.notificationNote}>{notificationNote}</Text> : null}
    </View>
  );
});

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const MoreInfoChatCard = memo(function MoreInfoChatCard({ scan }: { scan: ScanDetails | ScanListItem }) {
  // Embedded AI chat appears in scan result/history contexts and sends scan context with each question.
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  async function sendQuestion() {
    // Keep the last messages as short context so follow-up questions stay connected.
    const nextQuestion = question.trim();
    if (!nextQuestion || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: nextQuestion }];
    setMessages(nextMessages);
    setQuestion('');
    setError('');

    try {
      setIsSending(true);
      const answer = await askMoreInfoQuestion({
        scan,
        question: nextQuestion,
        history: messages.slice(-8),
      });
      setMessages([...nextMessages, { role: 'assistant', content: answer || 'I could not generate an answer.' }]);
    } catch (err) {
      setMessages(messages);
      setQuestion(nextQuestion);
      setError(err instanceof Error ? err.message : 'Could not ask the plant assistant.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <View style={styles.chatCard}>
      <Text style={styles.detailTitle}>Need More Info?</Text>
      <Pressable style={styles.chatToggleButton} onPress={() => setIsOpen((current) => !current)}>
        <Ionicons name="chatbubble-ellipses-outline" size={16} color="#0d4d3d" />
        <Text style={styles.chatToggleText}>{isOpen ? 'Close Chat' : 'More Info?'}</Text>
      </Pressable>

      {isOpen ? (
        <View style={styles.chatPanel}>
          {messages.length ? (
            messages.map((message, index) => (
              <View
                key={`${message.role}-${index}`}
                style={[
                  styles.chatBubble,
                  message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}>
                <Text style={message.role === 'user' ? styles.userBubbleText : styles.assistantBubbleText}>
                  {message.content}
                </Text>
              </View>
            ))
          ) : null}
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={question}
              onChangeText={setQuestion}
              placeholder="Ask a follow-up question"
              placeholderTextColor="#7a7d86"
              multiline
            />
            <Pressable
              style={[styles.sendButton, (!question.trim() || isSending) && styles.disabledButton]}
              disabled={!question.trim() || isSending}
              onPress={() => void sendQuestion()}>
              {isSending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
            </Pressable>
          </View>
          {!!error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
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
  customAliasWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customAliasInput: {
    flex: 1,
  },
  hint: {
    color: '#2a2d35',
    opacity: 0.7,
    fontSize: 12,
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
  imageChooser: {
    borderWidth: 1,
    borderColor: '#cfe0d8',
    borderRadius: 14,
    backgroundColor: '#f3f8f5',
    overflow: 'hidden',
    minHeight: 190,
  },
  imageChooserEmpty: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 8,
  },
  imageChooserIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#dfeee7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageChooserTitle: {
    color: '#0d4d3d',
    fontWeight: '700',
    fontSize: 16,
  },
  imageChooserHint: {
    color: '#496056',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  imageChooserPreview: {
    width: '100%',
    height: 220,
    backgroundColor: '#e5e7eb',
  },
  imageChooserOverlay: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  imageChooserOverlayText: {
    color: '#0d4d3d',
    fontWeight: '700',
    fontSize: 12,
  },
  dropdownField: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dropdownText: {
    color: '#0f172a',
    flex: 1,
  },
  aliasMenu: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginTop: 4,
  },
  aliasMenuOption: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  aliasMenuText: {
    color: '#0d4d3d',
  },
  qualityCard: {
    borderWidth: 1,
    borderColor: '#d9e0db',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: '#f8fcfa',
  },
  qualityCardWarning: {
    borderColor: '#e8b14a',
    backgroundColor: '#fffaf0',
  },
  qualityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0d4d3d',
  },
  qualityRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  qualityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goodBadge: {
    backgroundColor: '#dff4e8',
  },
  warningBadge: {
    backgroundColor: '#fde7bd',
  },
  qualityBadgeText: {
    color: '#0d4d3d',
    fontSize: 12,
    fontWeight: '700',
  },
  qualityCopy: {
    flex: 1,
    gap: 2,
  },
  qualitySummary: {
    color: '#163329',
    fontWeight: '600',
    fontSize: 13,
  },
  saveAliasButton: {
    backgroundColor: '#0d4d3d',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
  },
  saveAliasButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d9e0db',
    padding: 14,
    gap: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#0d4d3d',
    fontWeight: '700',
    marginBottom: 6,
  },
  value: {
    fontSize: 13,
    color: '#2a2d35',
  },
  followUp: {
    marginTop: 6,
    color: '#0d4d3d',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  notificationNote: {
    color: '#496056',
    fontSize: 12,
    lineHeight: 18,
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
  chatCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d7e7de',
    borderRadius: 12,
    backgroundColor: '#f8fcf9',
    padding: 12,
    gap: 8,
  },
  chatToggleButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#cfe0d8',
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chatToggleText: {
    color: '#0d4d3d',
    fontWeight: '700',
    fontSize: 13,
  },
  chatPanel: {
    gap: 8,
  },
  chatBubble: {
    maxWidth: '92%',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0d4d3d',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef8e7',
  },
  userBubbleText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 19,
  },
  assistantBubbleText: {
    color: '#0d4d3d',
    fontSize: 13,
    lineHeight: 19,
  },
  chatHint: {
    color: '#496056',
    fontSize: 12,
    lineHeight: 18,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    minHeight: 78,
    maxHeight: 128,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#fff',
    color: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d4d3d',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
  },
  bulletText: {
    fontSize: 13,
    color: '#2a2d35',
    lineHeight: 20,
  },
});
