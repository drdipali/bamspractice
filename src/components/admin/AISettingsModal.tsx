import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Sparkles,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  X,
  Check,
  Cpu,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import {
  GeminiService,
  SUPPORTED_GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
} from '../../services/gemini';
import { Portal } from '../common/Portal';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_GEMINI_MODEL);
  const [savedKey, setSavedKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const storedKey = await GeminiService.getApiKey();
      const storedModel = await GeminiService.getModel();
      setApiKey(storedKey);
      setSavedKey(storedKey);
      setSelectedModel(storedModel || DEFAULT_GEMINI_MODEL);
      setTestResult(null);
      setSaveSuccess(false);
    } catch (e) {
      console.warn('Failed to load Gemini settings:', e);
    }
  };

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await GeminiService.testConnection(apiKey, selectedModel);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Error connecting to Gemini API',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await GeminiService.setApiKey(apiKey);
      await GeminiService.setModel(selectedModel);
      setSavedKey(apiKey.trim());
      setSaveSuccess(true);
      if (onKeySaved) onKeySaved();
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 900);
    } catch (e) {
      console.warn('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to remove the stored Gemini API key?')) {
      await GeminiService.setApiKey('');
      setApiKey('');
      setSavedKey('');
      setTestResult(null);
      if (onKeySaved) onKeySaved();
    }
  };

  const openAIStudio = () => {
    const url = 'https://aistudio.google.com/app/apikey';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <Portal>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalDialog}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBox}>
              <Sparkles size={18} color="#FFF" />
            </View>
            <View>
              <Text style={styles.modalTitle}>Gemini AI Configuration</Text>
              <Text style={styles.modalSubtitle}>
                AI-assisted question rephrasing, formatting &amp; Sanskrit term polishing
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={18} color={THEME.colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 16 }}>
          {/* Key Status Pill */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Storage Status:</Text>
            {savedKey ? (
              <View style={styles.statusActive}>
                <CheckCircle2 size={13} color="#15803D" />
                <Text style={styles.statusActiveText}>
                  Active in Browser ({savedKey.slice(0, 7)}...{savedKey.slice(-4)})
                </Text>
              </View>
            ) : (
              <View style={styles.statusInactive}>
                <AlertCircle size={13} color="#B45309" />
                <Text style={styles.statusInactiveText}>Not Configured</Text>
              </View>
            )}
          </View>

          {/* API Key Input */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Google Gemini API Key</Text>
              <TouchableOpacity
                style={styles.linkRow}
                onPress={openAIStudio}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>Get Free Key from Google AI Studio</Text>
                <ExternalLink size={12} color={THEME.colors.brand} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Key size={16} color={THEME.colors.muted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInput}
                value={apiKey}
                onChangeText={(val) => {
                  setApiKey(val);
                  setTestResult(null);
                }}
                placeholder="Paste AIzaSy... API key here"
                placeholderTextColor={THEME.colors.muted}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowKey(!showKey)}
                activeOpacity={0.7}
              >
                {showKey ? (
                  <EyeOff size={16} color={THEME.colors.muted} />
                ) : (
                  <Eye size={16} color={THEME.colors.muted} />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.hintText}>
              Your API key is saved locally in your browser's private localStorage. It is never
              stored on external servers or checked into git.
            </Text>
          </View>

          {/* Model Selector */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Selected Gemini Model</Text>
              <View style={styles.aiBadge}>
                <Cpu size={12} color="#1F5A4D" />
                <Text style={styles.aiBadgeText}>Flash Engine</Text>
              </View>
            </View>

            <View style={styles.modelsContainer}>
              {SUPPORTED_GEMINI_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.modelCard,
                      isSelected && styles.modelCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedModel(m.id);
                      setTestResult(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modelRadioOuter}>
                      {isSelected && <View style={styles.modelRadioInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.modelName,
                          isSelected && styles.modelNameSelected,
                        ]}
                      >
                        {m.label}
                      </Text>
                      <Text style={styles.modelCode}>{m.id}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Test Connection Result Alert */}
          {testResult && (
            <View
              style={[
                styles.testResultBox,
                testResult.success
                  ? styles.testResultSuccess
                  : styles.testResultError,
              ]}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} color="#15803D" style={{ marginTop: 2 }} />
              ) : (
                <AlertCircle size={16} color="#DC2626" style={{ marginTop: 2 }} />
              )}
              <Text
                style={[
                  styles.testResultText,
                  testResult.success
                    ? styles.testResultTextSuccess
                    : styles.testResultTextError,
                ]}
              >
                {testResult.message}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.modalFooter}>
          <View style={styles.footerLeft}>
            {savedKey ? (
              <TouchableOpacity
                style={styles.btnClear}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <Trash2 size={13} color="#DC2626" />
                <Text style={styles.btnClearText}>Clear Key</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.footerRight}>
            <TouchableOpacity
              style={styles.btnTest}
              onPress={handleTestConnection}
              disabled={testing || !apiKey.trim()}
              activeOpacity={0.7}
            >
              {testing ? (
                <ActivityIndicator size="small" color={THEME.colors.brand} />
              ) : (
                <>
                  <Sparkles size={14} color={THEME.colors.brand} />
                  <Text style={styles.btnTestText}>Test Connection</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnSave, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : saveSuccess ? (
                <>
                  <Check size={14} color="#FFF" />
                  <Text style={styles.btnSaveText}>Saved!</Text>
                </>
              ) : (
                <Text style={styles.btnSaveText}>Save Settings</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  </Portal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw' as any,
    height: '100vh' as any,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 99999,
    display: 'flex' as any,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh' as any,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    display: 'flex' as any,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
    backgroundColor: '#FAFAFA',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  modalSubtitle: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    maxHeight: '70vh' as any,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  statusActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  statusActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  statusInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusInactiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.brand,
    textDecorationLine: 'underline',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.ink,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
  },
  hintText: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginTop: 6,
    lineHeight: 15,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1F5A4D',
  },
  modelsContainer: {
    gap: 8,
    marginTop: 4,
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    backgroundColor: '#FAFAFA',
    gap: 10,
  },
  modelCardSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: '#F0FDF4',
  },
  modelRadioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: THEME.colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.brand,
  },
  modelName: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.ink,
  },
  modelNameSelected: {
    color: THEME.colors.brand,
    fontWeight: '700',
  },
  modelCode: {
    fontSize: 10,
    color: THEME.colors.muted,
    marginTop: 1,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  testResultSuccess: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  testResultError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  testResultText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  testResultTextSuccess: {
    color: '#15803D',
    fontWeight: '600',
  },
  testResultTextError: {
    color: '#B91C1C',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    backgroundColor: '#F8FAFC',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  btnClearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  btnTest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    backgroundColor: '#FFF',
  },
  btnTestText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.brand,
  },
  btnSave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  btnSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
});
