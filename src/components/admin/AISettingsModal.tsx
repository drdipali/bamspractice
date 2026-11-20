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
  Zap,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import {
  GeminiService,
  AIProvider,
  SUPPORTED_AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  SUPPORTED_GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  SUPPORTED_GROQ_MODELS,
  DEFAULT_GROQ_MODEL,
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
  const [activeProvider, setActiveProvider] = useState<AIProvider>(DEFAULT_AI_PROVIDER);

  // Gemini state
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [savedGeminiKey, setSavedGeminiKey] = useState('');
  const [selectedGeminiModel, setSelectedGeminiModel] = useState(DEFAULT_GEMINI_MODEL);

  // Groq state
  const [groqApiKey, setGroqApiKey] = useState('');
  const [savedGroqKey, setSavedGroqKey] = useState('');
  const [selectedGroqModel, setSelectedGroqModel] = useState(DEFAULT_GROQ_MODEL);

  // Shared UI state
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    modelUsed?: string;
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
      const provider = await GeminiService.getProvider();
      const gKey = await GeminiService.getGeminiApiKey();
      const gModel = await GeminiService.getGeminiModel();
      const qKey = await GeminiService.getGroqApiKey();
      const qModel = await GeminiService.getGroqModel();

      setActiveProvider(provider || DEFAULT_AI_PROVIDER);
      setGeminiApiKey(gKey);
      setSavedGeminiKey(gKey);
      setSelectedGeminiModel(gModel || DEFAULT_GEMINI_MODEL);

      setGroqApiKey(qKey);
      setSavedGroqKey(qKey);
      setSelectedGroqModel(qModel || DEFAULT_GROQ_MODEL);

      setTestResult(null);
      setSaveSuccess(false);
    } catch (e) {
      console.warn('Failed to load AI settings:', e);
    }
  };

  if (!isOpen) return null;

  const currentKey = activeProvider === 'groq' ? groqApiKey : geminiApiKey;
  const currentSavedKey = activeProvider === 'groq' ? savedGroqKey : savedGeminiKey;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const keyToTest = activeProvider === 'groq' ? groqApiKey : geminiApiKey;
      const modelToTest = activeProvider === 'groq' ? selectedGroqModel : selectedGeminiModel;
      const res = await GeminiService.testConnection(activeProvider, keyToTest, modelToTest);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message:
          e.message ||
          `Error connecting to ${activeProvider === 'groq' ? 'Groq' : 'Gemini'} API`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await GeminiService.setProvider(activeProvider);
      await GeminiService.setGeminiApiKey(geminiApiKey);
      await GeminiService.setGeminiModel(selectedGeminiModel);
      await GeminiService.setGroqApiKey(groqApiKey);
      await GeminiService.setGroqModel(selectedGroqModel);

      setSavedGeminiKey(geminiApiKey.trim());
      setSavedGroqKey(groqApiKey.trim());
      setSaveSuccess(true);
      if (onKeySaved) onKeySaved();
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 900);
    } catch (e) {
      console.warn('Failed to save AI settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    const providerName = activeProvider === 'groq' ? 'Groq' : 'Google Gemini';
    if (confirm(`Are you sure you want to remove the stored ${providerName} API key?`)) {
      if (activeProvider === 'groq') {
        await GeminiService.setGroqApiKey('');
        setGroqApiKey('');
        setSavedGroqKey('');
      } else {
        await GeminiService.setGeminiApiKey('');
        setGeminiApiKey('');
        setSavedGeminiKey('');
      }
      setTestResult(null);
      if (onKeySaved) onKeySaved();
    }
  };

  const openKeyPortal = () => {
    const url =
      activeProvider === 'groq'
        ? 'https://console.groq.com/keys'
        : 'https://aistudio.google.com/app/apikey';
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
                <Text style={styles.modalTitle}>AI Engine Settings</Text>
                <Text style={styles.modalSubtitle}>
                  Choose your AI Provider for rephrasing, formatting &amp; Sanskrit term polishing
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color={THEME.colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Provider Selector Tabs */}
            <View style={styles.providerSection}>
              <Text style={styles.sectionTitle}>Select AI Provider</Text>
              <View style={styles.providerGrid}>
                {/* Google Gemini Card */}
                <TouchableOpacity
                  style={[
                    styles.providerCard,
                    activeProvider === 'gemini' && styles.providerCardActive,
                  ]}
                  onPress={() => {
                    setActiveProvider('gemini');
                    setTestResult(null);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.providerCardTop}>
                    <View style={styles.providerIconGemini}>
                      <Sparkles size={16} color="#047857" />
                    </View>
                    <View style={styles.badgeDefault}>
                      <Text style={styles.badgeDefaultText}>Default</Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.providerName,
                      activeProvider === 'gemini' && styles.providerNameActive,
                    ]}
                  >
                    Google Gemini
                  </Text>
                  <Text style={styles.providerDesc}>gemini-2.5-flash &amp; 3.8-flash</Text>
                  <View style={styles.providerRadioRow}>
                    <View
                      style={[
                        styles.radioOuter,
                        activeProvider === 'gemini' && styles.radioOuterActive,
                      ]}
                    >
                      {activeProvider === 'gemini' && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.radioStatusText,
                        activeProvider === 'gemini' && styles.radioStatusTextActive,
                      ]}
                    >
                      {activeProvider === 'gemini' ? 'Active Provider' : 'Click to Select'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Groq Card */}
                <TouchableOpacity
                  style={[
                    styles.providerCard,
                    activeProvider === 'groq' && styles.providerCardActive,
                  ]}
                  onPress={() => {
                    setActiveProvider('groq');
                    setTestResult(null);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.providerCardTop}>
                    <View style={styles.providerIconGroq}>
                      <Zap size={16} color="#EA580C" />
                    </View>
                    <View style={styles.badgeFree}>
                      <Text style={styles.badgeFreeText}>Free &amp; Fast</Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.providerName,
                      activeProvider === 'groq' && styles.providerNameActive,
                    ]}
                  >
                    Groq LPU Engine
                  </Text>
                  <Text style={styles.providerDesc}>gpt-oss-120b &amp; qwen-3.8-27b</Text>
                  <View style={styles.providerRadioRow}>
                    <View
                      style={[
                        styles.radioOuter,
                        activeProvider === 'groq' && styles.radioOuterActive,
                      ]}
                    >
                      {activeProvider === 'groq' && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.radioStatusText,
                        activeProvider === 'groq' && styles.radioStatusTextActive,
                      ]}
                    >
                      {activeProvider === 'groq' ? 'Active Provider' : 'Click to Select'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Key Status Pill */}
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>
                {activeProvider === 'groq' ? 'Groq' : 'Gemini'} Key Status:
              </Text>
              {currentSavedKey ? (
                <View style={styles.statusActive}>
                  <CheckCircle2 size={13} color="#15803D" />
                  <Text style={styles.statusActiveText}>
                    Active in Browser ({currentSavedKey.slice(0, 6)}...
                    {currentSavedKey.slice(-4)})
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
                <Text style={styles.fieldLabel}>
                  {activeProvider === 'groq' ? 'Groq API Key' : 'Google Gemini API Key'}
                </Text>
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={openKeyPortal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkText}>
                    {activeProvider === 'groq'
                      ? 'Get Free Key from Groq Console'
                      : 'Get Free Key from Google AI Studio'}
                  </Text>
                  <ExternalLink size={12} color={THEME.colors.brand} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrapper}>
                <Key size={16} color={THEME.colors.muted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  value={activeProvider === 'groq' ? groqApiKey : geminiApiKey}
                  onChangeText={(val) => {
                    if (activeProvider === 'groq') {
                      setGroqApiKey(val);
                    } else {
                      setGeminiApiKey(val);
                    }
                    setTestResult(null);
                  }}
                  placeholder={
                    activeProvider === 'groq'
                      ? 'Paste gsk_... API key here'
                      : 'Paste AIzaSy... API key here'
                  }
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
                {activeProvider === 'groq'
                  ? 'Your Groq API key is stored locally in your browser. Groq provides generous free tier LPU inference for fast question conversions.'
                  : "Your Gemini API key is stored locally in your browser's private storage. It is never checked into git or sent to third-party servers."}
              </Text>
            </View>

            {/* Model Selector */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>
                  {activeProvider === 'groq' ? 'Selected Groq Model' : 'Selected Gemini Model'}
                </Text>
                <View style={styles.aiBadge}>
                  <Cpu size={12} color="#1F5A4D" />
                  <Text style={styles.aiBadgeText}>
                    {activeProvider === 'groq' ? 'Ultra-Fast LPU' : 'Flash Engine'}
                  </Text>
                </View>
              </View>

              <View style={styles.modelsContainer}>
                {activeProvider === 'groq'
                  ? SUPPORTED_GROQ_MODELS.map((m) => {
                      const isSelected = selectedGroqModel === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.modelCard, isSelected && styles.modelCardSelected]}
                          onPress={() => {
                            setSelectedGroqModel(m.id);
                            setTestResult(null);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.modelRadioOuter}>
                            {isSelected && <View style={styles.modelRadioInner} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.modelName, isSelected && styles.modelNameSelected]}
                            >
                              {m.label}
                            </Text>
                            <Text style={styles.modelCode}>{m.id}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  : SUPPORTED_GEMINI_MODELS.map((m) => {
                      const isSelected = selectedGeminiModel === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.modelCard, isSelected && styles.modelCardSelected]}
                          onPress={() => {
                            setSelectedGeminiModel(m.id);
                            setTestResult(null);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.modelRadioOuter}>
                            {isSelected && <View style={styles.modelRadioInner} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.modelName, isSelected && styles.modelNameSelected]}
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
                  testResult.success ? styles.testResultSuccess : styles.testResultError,
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
              {currentSavedKey ? (
                <TouchableOpacity style={styles.btnClear} onPress={handleClear} activeOpacity={0.7}>
                  <Trash2 size={13} color="#DC2626" />
                  <Text style={styles.btnClearText}>
                    Clear {activeProvider === 'groq' ? 'Groq' : 'Gemini'} Key
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.footerRight}>
              <TouchableOpacity
                style={styles.btnTest}
                onPress={handleTestConnection}
                disabled={testing || !currentKey.trim()}
                activeOpacity={0.7}
              >
                {testing ? (
                  <ActivityIndicator size="small" color={THEME.colors.brand} />
                ) : (
                  <>
                    <Sparkles size={14} color={THEME.colors.brand} />
                    <Text style={styles.btnTestText}>
                      Test {activeProvider === 'groq' ? 'Groq' : 'Gemini'}
                    </Text>
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
    maxWidth: 580,
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
    paddingTop: 16,
  },
  providerSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  providerGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  providerCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  providerCardActive: {
    borderColor: '#047857',
    backgroundColor: '#F0FDF4',
  },
  providerCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  providerIconGemini: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerIconGroq: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDefault: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeDefaultText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  badgeFree: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeFreeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C2410C',
  },
  providerName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 2,
  },
  providerNameActive: {
    color: '#047857',
  },
  providerDesc: {
    fontSize: 10,
    color: THEME.colors.muted,
    marginBottom: 10,
  },
  providerRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radioOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#047857',
  },
  radioInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#047857',
  },
  radioStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  radioStatusTextActive: {
    color: '#047857',
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  statusActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusActiveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
  },
  statusInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusInactiveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
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
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: 8,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    height: 42,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.ink,
    paddingVertical: 8,
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
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1F5A4D',
  },
  modelsContainer: {
    gap: 6,
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
  },
  modelCardSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: '#F0FDF4',
  },
  modelRadioOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelRadioInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
  },
  testResultSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  testResultError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  testResultText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  testResultTextSuccess: {
    color: '#15803D',
    fontWeight: '600',
  },
  testResultTextError: {
    color: '#DC2626',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    backgroundColor: '#FAFAFA',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  btnClearText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  btnTest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: THEME.colors.brand,
  },
  btnSaveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
});
