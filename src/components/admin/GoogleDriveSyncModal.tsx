import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import {
  FolderSync,
  Folder,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  Layers,
  Check,
  LogOut,
  User,
  Settings,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Question } from '../../types';
import { Portal } from '../common/Portal';
import {
  GoogleDriveService,
  GoogleUserInfo,
  DriveFolderScanSummary,
} from '../../services/googleDriveService';
import { normalizeQuestionStem } from '../../utils/spreadsheetHelper';
import { backend } from '../../services/backend';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (result: {
    addedCount: number;
    updatedCount: number;
    skippedCount: number;
    affectedIds: string[];
  }) => void;
  existingQuestions: Question[];
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingQuestions,
}) => {
  // OAuth & User State
  const [clientId, setClientId] = useState<string>('');
  const [showOAuthSettings, setShowOAuthSettings] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<GoogleUserInfo | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  // Folder & Scan State
  const [folderUrl, setFolderUrl] = useState<string>('');
  const [saveAsDefaultFolder, setSaveAsDefaultFolder] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgressMessage, setScanProgressMessage] = useState<string>('');
  const [scanResult, setScanResult] = useState<DriveFolderScanSummary | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'overwrite'>('skip');
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

  // Import State
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setStatusNotification(null);
      setScanProgressMessage('');

      const storedClientId = GoogleDriveService.getClientId();
      setClientId(storedClientId);

      const activeToken = GoogleDriveService.getActiveToken();
      const storedUser = GoogleDriveService.getStoredUserInfo();

      if (activeToken && storedUser) {
        setIsConnected(true);
        setUserInfo(storedUser);
      } else {
        setIsConnected(false);
        setUserInfo(null);
        if (!storedClientId) {
          setShowOAuthSettings(true);
        }
      }

      const lastFolder = GoogleDriveService.getLastFolderUrl();
      if (lastFolder) {
        setFolderUrl(lastFolder);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Connect Google Drive
  const handleConnect = async (prompt: 'select_account' | 'consent' | '' = 'select_account') => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      if (clientId.trim()) {
        GoogleDriveService.setClientId(clientId.trim());
      }
      const res = await GoogleDriveService.requestAccessToken(prompt);
      setIsConnected(true);
      setUserInfo(res.userInfo);
      setStatusNotification(`Connected to Google Drive as ${res.userInfo.email}`);
    } catch (err: any) {
      console.warn('OAuth Connect Error:', err);
      setErrorMessage(err.message || 'Failed to authenticate with Google Identity Services.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Disconnect Google Drive
  const handleDisconnect = async () => {
    try {
      await GoogleDriveService.disconnect();
      setIsConnected(false);
      setUserInfo(null);
      setScanResult(null);
      setStatusNotification('Google Drive disconnected.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect.');
    }
  };

  // Save OAuth Client ID
  const handleSaveClientId = () => {
    GoogleDriveService.setClientId(clientId.trim());
    setStatusNotification('Google OAuth Client ID saved.');
    setShowOAuthSettings(false);
  };

  // Scan Folder
  const handleScanFolder = async () => {
    const trimmed = folderUrl.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a Google Drive Folder URL or Folder ID.');
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    setScanResult(null);
    setScanProgressMessage('Connecting to Google Drive...');

    try {
      const result = await GoogleDriveService.scanFolder(trimmed, (status) => {
        setScanProgressMessage(status.message);
      });

      setScanResult(result);
      if (saveAsDefaultFolder) {
        GoogleDriveService.setLastFolderUrl(trimmed);
      }
      setStatusNotification(`Scanned ${result.totalSheetsFound} spreadsheets and ${result.totalTabsScanned} tabs.`);
    } catch (err: any) {
      console.warn('Folder Scan Error:', err);
      setErrorMessage(err.message || 'Failed to scan Google Drive folder.');
    } finally {
      setIsScanning(false);
      setScanProgressMessage('');
    }
  };

  // Calculate statistics (new vs duplicates)
  const existingStemMap = new Set<string>();
  existingQuestions.forEach((q) => {
    const key = normalizeQuestionStem(q.stem);
    if (key) existingStemMap.add(key);
  });

  const allValidQuestions = scanResult?.allValidQuestions || [];
  let duplicateCount = 0;
  let newCount = 0;

  allValidQuestions.forEach((q) => {
    const key = normalizeQuestionStem(q.stem);
    if (key && existingStemMap.has(key)) {
      duplicateCount++;
    } else {
      newCount++;
    }
  });

  // Import to Cloud DB
  const handleConfirmImport = async () => {
    if (!scanResult || allValidQuestions.length === 0) return;

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const syncResult = await backend.syncGoogleSheetQuestions(allValidQuestions, duplicateMode);
      onImportSuccess({
        addedCount: syncResult.addedCount,
        updatedCount: syncResult.updatedCount,
        skippedCount: syncResult.skippedCount,
        affectedIds: syncResult.affectedIds,
      });
      onClose();
    } catch (err: any) {
      console.warn('Import error:', err);
      setErrorMessage(err.message || 'Failed to import questions to Cloud DB.');
    } finally {
      setIsImporting(false);
    }
  };

  const toggleFileAccordion = (fileId: string) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [fileId]: !prev[fileId],
    }));
  };

  return (
    <Portal>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalDialog}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIconWrap}>
                <FolderSync size={22} color="#047857" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.modalTitle}>Google Drive Sync</Text>
                  <View style={styles.badgeOnline}>
                    <Text style={styles.badgeOnlineText}>v1.3 Folder Sync</Text>
                  </View>
                </View>
                <Text style={styles.modalSubtitle}>
                  Direct Google Drive connect, folder scan &amp; multi-sheet auto import
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={THEME.colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
            {/* Account Status Card */}
            <View style={styles.accountCard}>
              {isConnected && userInfo ? (
                <View style={styles.accountConnectedRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={styles.avatarWrap}>
                      {userInfo.picture ? (
                        <Image source={{ uri: userInfo.picture }} style={styles.avatarImg} />
                      ) : (
                        <User size={18} color="#047857" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.connectedLabel}>Connected to Google Drive</Text>
                        <CheckCircle2 size={14} color="#047857" />
                      </View>
                      <Text style={styles.connectedEmail} numberOfLines={1}>
                        {userInfo.email}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.accountActionsRow}>
                    <TouchableOpacity
                      style={styles.btnSwitchAccount}
                      onPress={() => handleConnect('select_account')}
                      disabled={isAuthenticating}
                      activeOpacity={0.8}
                    >
                      <RefreshCw size={12} color="#047857" />
                      <Text style={styles.btnSwitchAccountText}>Switch Account</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnDisconnect}
                      onPress={handleDisconnect}
                      activeOpacity={0.8}
                    >
                      <LogOut size={12} color="#DC2626" />
                      <Text style={styles.btnDisconnectText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.accountDisconnectedCol}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.avatarWrap, { backgroundColor: '#F1F5F9' }]}>
                      <User size={18} color="#64748B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.disconnectedTitle}>Not Connected to Google Drive</Text>
                      <Text style={styles.disconnectedSub}>
                        Sign in with any Gmail account to browse &amp; sync your question folders directly.
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                    <TouchableOpacity
                      style={[styles.btnConnectGoogle, isAuthenticating && { opacity: 0.7 }]}
                      onPress={() => handleConnect('select_account')}
                      disabled={isAuthenticating}
                      activeOpacity={0.8}
                    >
                      {isAuthenticating ? (
                        <>
                          <ActivityIndicator size="small" color="#FFF" />
                          <Text style={styles.btnConnectGoogleText}>Connecting...</Text>
                        </>
                      ) : (
                        <>
                          <FolderSync size={15} color="#FFF" />
                          <Text style={styles.btnConnectGoogleText}>Connect Google Drive</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnSettingsToggle}
                      onPress={() => setShowOAuthSettings(!showOAuthSettings)}
                      activeOpacity={0.7}
                    >
                      <Settings size={14} color="#475569" />
                      <Text style={styles.btnSettingsToggleText}>OAuth Config</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* OAuth Settings Drawer (Configurable Client ID) */}
            {showOAuthSettings && (
              <View style={styles.oauthSettingsCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Settings size={14} color="#047857" />
                  <Text style={styles.oauthSettingsTitle}>Google OAuth 2.0 Client ID Configuration</Text>
                </View>
                <Text style={styles.oauthSettingsDesc}>
                  Enter your Web OAuth Client ID created in Google Cloud Console. Scopes requested: Drive (Read-only) and Sheets (Read-only).
                </Text>

                <TextInput
                  style={styles.clientIdInput}
                  value={clientId}
                  onChangeText={setClientId}
                  placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={styles.btnCancelSettings}
                    onPress={() => setShowOAuthSettings(false)}
                  >
                    <Text style={styles.btnCancelSettingsText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnSaveClientId} onPress={handleSaveClientId}>
                    <Check size={14} color="#FFF" />
                    <Text style={styles.btnSaveClientIdText}>Save Client ID</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Status notification toast inside modal */}
            {statusNotification && (
              <View style={styles.statusBox}>
                <CheckCircle2 size={14} color="#047857" />
                <Text style={styles.statusText}>{statusNotification}</Text>
                <TouchableOpacity onPress={() => setStatusNotification(null)}>
                  <X size={12} color="#047857" />
                </TouchableOpacity>
              </View>
            )}

            {/* Error Message Box */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <AlertCircle size={18} color="#DC2626" style={{ marginTop: 2, flexShrink: 0 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorTitle}>Error</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
                <TouchableOpacity onPress={() => setErrorMessage(null)}>
                  <X size={14} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}

            {/* Folder Selection & Scan Section */}
            {isConnected && (
              <View style={styles.folderSectionCard}>
                <Text style={styles.sectionHeading}>1. Select Google Drive Folder</Text>
                <Text style={styles.sectionSub}>
                  Paste the link or ID of any Google Drive folder containing your question spreadsheets:
                </Text>

                <View style={styles.folderInputRow}>
                  <View style={styles.folderIconWrap}>
                    <Folder size={16} color="#047857" />
                  </View>
                  <TextInput
                    style={styles.folderInput}
                    value={folderUrl}
                    onChangeText={(val) => {
                      setFolderUrl(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="https://drive.google.com/drive/folders/YOUR_FOLDER_ID..."
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={[styles.btnScan, isScanning && styles.btnScanDisabled]}
                    onPress={handleScanFolder}
                    disabled={isScanning}
                    activeOpacity={0.8}
                  >
                    {isScanning ? (
                      <>
                        <ActivityIndicator size="small" color="#FFF" />
                        <Text style={styles.btnScanText}>Scanning...</Text>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} color="#FFF" />
                        <Text style={styles.btnScanText}>Scan Folder</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Progress message during scan */}
                {isScanning && scanProgressMessage ? (
                  <View style={styles.scanProgressCard}>
                    <ActivityIndicator size="small" color="#047857" />
                    <Text style={styles.scanProgressText}>{scanProgressMessage}</Text>
                  </View>
                ) : null}

                {/* Checkbox: Save folder URL as default */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setSaveAsDefaultFolder(!saveAsDefaultFolder)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkboxBox, saveAsDefaultFolder && styles.checkboxBoxActive]}>
                    {saveAsDefaultFolder && <Check size={12} color="#FFF" strokeWidth={3} />}
                  </View>
                  <Text style={styles.checkboxLabel}>Save this Folder as default for future scans</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Scan Results & Preview Summary */}
            {scanResult && (
              <View style={styles.resultsCard}>
                <Text style={styles.sectionHeading}>
                  2. Scan Preview Summary — "{scanResult.folderName}"
                </Text>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNum}>{scanResult.totalSheetsFound}</Text>
                    <Text style={styles.statLabel}>Sheets Found</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statNum}>{scanResult.totalTabsScanned}</Text>
                    <Text style={styles.statLabel}>Tabs Scanned</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statNum}>{allValidQuestions.length}</Text>
                    <Text style={styles.statLabel}>Total Questions</Text>
                  </View>
                  <View style={[styles.statCard, { borderColor: '#86EFAC' }]}>
                    <Text style={[styles.statNum, { color: '#15803D' }]}>{newCount}</Text>
                    <Text style={styles.statLabel}>New to Insert</Text>
                  </View>
                  {duplicateCount > 0 && (
                    <View style={[styles.statCard, { borderColor: '#FDE047' }]}>
                      <Text style={[styles.statNum, { color: '#854D0E' }]}>{duplicateCount}</Text>
                      <Text style={styles.statLabel}>Duplicates</Text>
                    </View>
                  )}
                </View>

                {/* Duplicate Policy Selector */}
                {duplicateCount > 0 && (
                  <View style={styles.duplicateCard}>
                    <Text style={styles.duplicateTitle}>Duplicate Question Handling:</Text>
                    <View style={styles.radioOptionsRow}>
                      <TouchableOpacity
                        style={[styles.radioCard, duplicateMode === 'skip' && styles.radioCardActive]}
                        onPress={() => setDuplicateMode('skip')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.radioTop}>
                          <View style={[styles.radioCircle, duplicateMode === 'skip' && styles.radioCircleActive]}>
                            {duplicateMode === 'skip' && <View style={styles.radioDot} />}
                          </View>
                          <Text style={[styles.radioLabel, duplicateMode === 'skip' && styles.radioLabelActive]}>
                            Skip duplicates (Recommended)
                          </Text>
                        </View>
                        <Text style={styles.radioDesc}>
                          Inserts {newCount} new questions. Keeps all {duplicateCount} existing questions untouched.
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.radioCard, duplicateMode === 'overwrite' && styles.radioCardActive]}
                        onPress={() => setDuplicateMode('overwrite')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.radioTop}>
                          <View
                            style={[
                              styles.radioCircle,
                              duplicateMode === 'overwrite' && styles.radioCircleActive,
                            ]}
                          >
                            {duplicateMode === 'overwrite' && <View style={styles.radioDot} />}
                          </View>
                          <Text
                            style={[
                              styles.radioLabel,
                              duplicateMode === 'overwrite' && styles.radioLabelActive,
                            ]}
                          >
                            Overwrite existing
                          </Text>
                        </View>
                        <Text style={styles.radioDesc}>
                          Updates {duplicateCount} matching questions in the Cloud DB with latest sheet content.
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Sheets & Tabs Accordion */}
                <Text style={[styles.sectionSubHeading, { marginTop: 14 }]}>
                  Scanned Files &amp; Tabs Breakdown:
                </Text>
                {scanResult.sheets.map((sheet) => {
                  const isExpanded = expandedFiles[sheet.fileId] ?? true;
                  return (
                    <View key={sheet.fileId} style={styles.sheetCard}>
                      <TouchableOpacity
                        style={styles.sheetHeader}
                        onPress={() => toggleFileAccordion(sheet.fileId)}
                        activeOpacity={0.7}
                      >
                        <FileSpreadsheet size={16} color="#047857" />
                        <Text style={styles.sheetName} numberOfLines={1}>
                          {sheet.fileName}
                        </Text>
                        <View style={styles.sheetBadge}>
                          <Text style={styles.sheetBadgeText}>
                            {sheet.sheetValidQuestions.length} Questions
                          </Text>
                        </View>
                        {isExpanded ? (
                          <ChevronDown size={16} color="#64748B" />
                        ) : (
                          <ChevronRight size={16} color="#64748B" />
                        )}
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.tabsContainer}>
                          {sheet.tabs.map((tab, tIdx) => (
                            <View key={tIdx} style={styles.tabRow}>
                              <Layers size={13} color="#64748B" />
                              <Text style={styles.tabName}>{tab.tabName}</Text>
                              <Text style={styles.tabStats}>
                                {tab.validQuestions.length} valid / {tab.totalRows} rows
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btnConfirm,
                (!scanResult || allValidQuestions.length === 0 || isImporting) && styles.btnConfirmDisabled,
              ]}
              onPress={handleConfirmImport}
              disabled={!scanResult || allValidQuestions.length === 0 || isImporting}
              activeOpacity={0.8}
            >
              {isImporting ? (
                <>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.btnConfirmText}>Importing to Cloud DB...</Text>
                </>
              ) : (
                <>
                  <Check size={16} color="#FFF" />
                  <Text style={styles.btnConfirmText}>
                    Import {duplicateMode === 'skip' ? newCount : allValidQuestions.length} Questions to Cloud DB
                  </Text>
                </>
              )}
            </TouchableOpacity>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '92vh' as any,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 24,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
    backgroundColor: '#FAFAF9',
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  badgeOnline: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeOnlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  modalSubtitle: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  modalBody: {
    padding: 18,
    maxHeight: '74vh' as any,
  },
  accountCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  accountConnectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  avatarImg: {
    width: 36,
    height: 36,
  },
  connectedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  connectedEmail: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.ink,
    marginTop: 1,
  },
  accountActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnSwitchAccount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnSwitchAccountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  btnDisconnect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnDisconnectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  accountDisconnectedCol: {
    gap: 4,
  },
  disconnectedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  disconnectedSub: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  btnConnectGoogle: {
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnConnectGoogleText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnSettingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  btnSettingsToggleText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  oauthSettingsCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  oauthSettingsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  oauthSettingsDesc: {
    fontSize: 11,
    color: '#15803D',
    marginBottom: 8,
    lineHeight: 16,
  },
  clientIdInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: THEME.colors.ink,
  },
  btnCancelSettings: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnCancelSettingsText: {
    fontSize: 12,
    color: THEME.colors.muted,
  },
  btnSaveClientId: {
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnSaveClientIdText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  errorText: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16,
  },
  folderSectionCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginBottom: 10,
  },
  folderInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderIconWrap: {
    paddingLeft: 4,
  },
  folderInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: THEME.colors.ink,
  },
  btnScan: {
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnScanDisabled: {
    opacity: 0.6,
  },
  btnScanText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scanProgressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  scanProgressText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  checkboxBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkboxBoxActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  checkboxLabel: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
  resultsCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  statLabel: {
    fontSize: 10,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  duplicateCard: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  duplicateTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854D0E',
    marginBottom: 8,
  },
  radioOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  radioCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
  },
  radioCardActive: {
    borderColor: '#047857',
    backgroundColor: '#F0FDF4',
  },
  radioTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  radioCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#047857',
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#047857',
  },
  radioLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  radioLabelActive: {
    color: '#047857',
  },
  radioDesc: {
    fontSize: 10,
    color: THEME.colors.muted,
    lineHeight: 14,
  },
  sectionSubHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 6,
  },
  sheetCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
  },
  sheetName: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.ink,
    flex: 1,
  },
  sheetBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sheetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  tabsContainer: {
    backgroundColor: '#FFF',
    padding: 8,
    gap: 6,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 4,
  },
  tabName: {
    fontSize: 11,
    color: THEME.colors.ink,
    flex: 1,
    fontWeight: '500',
  },
  tabStats: {
    fontSize: 10,
    color: THEME.colors.muted,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    gap: 10,
    backgroundColor: '#F8FAFC',
  },
  btnCancel: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnCancelText: {
    fontSize: 13,
    color: THEME.colors.muted,
    fontWeight: '600',
  },
  btnConfirm: {
    backgroundColor: '#047857',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnConfirmDisabled: {
    opacity: 0.5,
  },
  btnConfirmText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
