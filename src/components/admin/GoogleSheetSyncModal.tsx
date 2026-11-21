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
} from 'react-native';
import {
  FileSpreadsheet,
  Link2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  Layers,
  Check,
  HelpCircle,
  Sparkles,
  Upload,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Question } from '../../types';
import { Portal } from '../common/Portal';
import {
  fetchGoogleSheetCsv,
  parseSpreadsheetBuffer,
  calculateGoogleSheetPreview,
  GoogleSheetPreviewStats,
} from '../../utils/spreadsheetHelper';
import { backend } from '../../services/backend';
import { CLASSICAL_SAMHITA_SCHEMA } from '../../utils/chapterMapper';

const DEFAULT_SHEET_URL_KEY = 'bams_default_google_sheet_url_v1';
const FALLBACK_DEFAULT_URL =
  'https://docs.google.com/spreadsheets/d/1-3E3lVtbN-rAQ69FRb8xric5KsV48TPVbctyxahSu5s/edit?usp=sharing';

interface GoogleSheetSyncModalProps {
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

export const GoogleSheetSyncModal: React.FC<GoogleSheetSyncModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingQuestions,
}) => {
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [saveAsDefault, setSaveAsDefault] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewStats, setPreviewStats] = useState<GoogleSheetPreviewStats | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'overwrite'>('skip');
  const [showErrorDetails, setShowErrorDetails] = useState<boolean>(false);
  const [sheetTargetSamhita, setSheetTargetSamhita] = useState<string>('Charaka Samhita');
  const [sheetTargetSthana, setSheetTargetSthana] = useState<string>('Sutrasthana');
  const [sheetTargetChapter, setSheetTargetChapter] = useState<string>('Chapter 1');
  const [sheetMarkVerified, setSheetMarkVerified] = useState<boolean>(true);

  // Load saved default Google Sheet URL on open
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setPreviewStats(null);
      setShowErrorDetails(false);

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(DEFAULT_SHEET_URL_KEY);
        setSheetUrl(saved || FALLBACK_DEFAULT_URL);
      } else {
        setSheetUrl(FALLBACK_DEFAULT_URL);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Fetch & Preview
  const handleFetchAndPreview = async () => {
    const trimmed = sheetUrl.trim().replace(/^["']|["']$/g, '');
    if (!trimmed) {
      setErrorMessage('Please paste your Google Sheet URL before clicking Fetch & Preview.');
      return;
    }

    setIsFetching(true);
    setErrorMessage(null);
    setPreviewStats(null);

    try {
      // 1. Live fetch CSV export from Google Sheets across candidate endpoints
      const csvText = await fetchGoogleSheetCsv(trimmed);

      // 2. Parse using strict UTF-8 decoder
      const parsed = parseSpreadsheetBuffer(csvText, { fileName: 'Google Sheet Sync' });

      if (parsed.validQuestions.length === 0) {
        throw new Error(
          'No valid questions could be extracted from this sheet. Please make sure the sheet contains columns for Question Text, Options A-D, Correct Answer, and Reference.'
        );
      }

      // 3. Duplicate matching & preview calculations
      const stats = calculateGoogleSheetPreview(parsed, existingQuestions);
      setPreviewStats(stats);

      // Persist as default URL if checked
      if (saveAsDefault && Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem(DEFAULT_SHEET_URL_KEY, trimmed);
      }
    } catch (err: any) {
      console.warn('Google Sheet Sync error:', err);
      setErrorMessage(err.message || 'Failed to fetch and parse Google Sheet.');
    } finally {
      setIsFetching(false);
    }
  };

  // Handle direct file picking as an instant fallback
  const handleLocalFilePicked = (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsFetching(true);
    setPreviewStats(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) {
        try {
          const parsed = parseSpreadsheetBuffer(buffer, { fileName: file.name });
          if (parsed.validQuestions.length === 0) {
            throw new Error(
              'No valid questions found in this file. Please verify it contains Question Text, Options A-D, and Correct Answer.'
            );
          }
          const stats = calculateGoogleSheetPreview(parsed, existingQuestions);
          setPreviewStats(stats);
        } catch (err: any) {
          setErrorMessage('Failed to parse file: ' + err.message);
        } finally {
          setIsFetching(false);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Confirm & Import to Cloud DB
  const handleConfirmImport = async () => {
    if (!previewStats || previewStats.validQuestions.length === 0) {
      alert('No valid questions available to import.');
      return;
    }

    setIsImporting(true);
    try {
      const targetTag = `${sheetTargetSamhita} > ${sheetTargetSthana} > ${sheetTargetChapter}`;
      const questionsToImport = previewStats.validQuestions.map((q) => ({
        ...q,
        ch: targetTag,
        chapterName: targetTag,
        is_chapter_verified: sheetMarkVerified,
        isChapterVerified: sheetMarkVerified,
      }));

      const result = await backend.syncGoogleSheetQuestions(
        questionsToImport,
        duplicateMode
      );

      // Persist default URL
      if (saveAsDefault && Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem(DEFAULT_SHEET_URL_KEY, sheetUrl.trim());
      }

      onImportSuccess(result);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to import questions to Cloud DB.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Portal>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalDialog}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIconWrap}>
                <FileSpreadsheet size={22} color="#047857" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.modalTitle}>Import from Google Sheet</Text>
                  <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#166534' }}>v1.2 Online</Text>
                  </View>
                </View>
                <Text style={styles.modalSubtitle}>
                  Direct Cloud DB sync with strict UTF-8 Hindi &amp; Sanskrit Devanagari preservation
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={THEME.colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Modal Scrollable Body */}
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
            {/* Step 1: Classical Chapter Mapping & Verification Selector */}
            <View style={styles.targetCard}>
              <Text style={styles.targetCardTitle}>1. Target Chapter Mapping &amp; Verification</Text>
              <Text style={styles.targetCardSub}>
                Assign all imported questions to a specific classical chapter and mark as Chapter-Verified for student practice:
              </Text>

              <View style={styles.selectorsRow}>
                {/* Samhita Selector */}
                <View style={styles.selectCol}>
                  <Text style={styles.selectLabel}>Samhita / Subject</Text>
                  <select
                    value={sheetTargetSamhita}
                    onChange={(e) => {
                      const sName = e.target.value;
                      setSheetTargetSamhita(sName);
                      const sthList = CLASSICAL_SAMHITA_SCHEMA[sName]?.sthanas || [];
                      if (sthList.length > 0) {
                        setSheetTargetSthana(sthList[0].name);
                        setSheetTargetChapter('Chapter 1');
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#0F172A',
                      width: '100%',
                    }}
                  >
                    {Object.keys(CLASSICAL_SAMHITA_SCHEMA).map((sName) => (
                      <option key={sName} value={sName}>
                        {sName}
                      </option>
                    ))}
                  </select>
                </View>

                {/* Sthana Selector */}
                <View style={styles.selectCol}>
                  <Text style={styles.selectLabel}>Sthana / Section</Text>
                  <select
                    value={sheetTargetSthana}
                    onChange={(e) => {
                      setSheetTargetSthana(e.target.value);
                      setSheetTargetChapter('Chapter 1');
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#0F172A',
                      width: '100%',
                    }}
                  >
                    {(CLASSICAL_SAMHITA_SCHEMA[sheetTargetSamhita]?.sthanas || []).map((sth) => (
                      <option key={sth.name} value={sth.name}>
                        {sth.name} ({sth.maxChapters} Chs)
                      </option>
                    ))}
                  </select>
                </View>

                {/* Chapter Selector */}
                <View style={styles.selectCol}>
                  <Text style={styles.selectLabel}>Chapter</Text>
                  <select
                    value={sheetTargetChapter}
                    onChange={(e) => setSheetTargetChapter(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#0F172A',
                      width: '100%',
                    }}
                  >
                    {Array.from(
                      {
                        length:
                          CLASSICAL_SAMHITA_SCHEMA[sheetTargetSamhita]?.sthanas.find(
                            (s) => s.name === sheetTargetSthana
                          )?.maxChapters || 30,
                      },
                      (_, i) => `Chapter ${i + 1}`
                    ).map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </View>
              </View>

              {/* Checked-by-default Toggle: Mark as Chapter-Verified */}
              <TouchableOpacity
                style={styles.verifyToggleRow}
                onPress={() => setSheetMarkVerified(!sheetMarkVerified)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    sheetMarkVerified && styles.checkboxBoxActive,
                  ]}
                >
                  {sheetMarkVerified && <Check size={12} color="#FFF" strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.verifyToggleText}>
                    ✅ Mark uploaded questions as Chapter-Verified
                  </Text>
                  <Text style={styles.verifyToggleSub}>
                    Enables these questions immediately in Student Chapter-Wise Practice Mode.
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.targetPreviewBadge}>
                <Text style={styles.targetPreviewBadgeLabel}>Target Mapping:</Text>
                <Text style={styles.targetPreviewBadgeTag}>
                  {sheetTargetSamhita} › {sheetTargetSthana} › {sheetTargetChapter}
                </Text>
                {sheetMarkVerified && (
                  <Text style={styles.targetPreviewBadgeVerified}>✓ Chapter-Verified</Text>
                )}
              </View>
            </View>

            {/* Step 2: URL Input Card */}
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>2. Google Sheet URL</Text>
              <View style={styles.urlInputRow}>
                <View style={styles.urlIconWrap}>
                  <Link2 size={16} color={THEME.colors.muted} />
                </View>
                <TextInput
                  style={styles.urlInput}
                  value={sheetUrl}
                  onChangeText={(text) => {
                    setSheetUrl(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="https://docs.google.com/spreadsheets/d/SHEET_ID/edit..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={[styles.btnFetch, isFetching && styles.btnFetchDisabled]}
                  onPress={handleFetchAndPreview}
                  disabled={isFetching}
                  activeOpacity={0.8}
                >
                  {isFetching ? (
                    <>
                      <ActivityIndicator size="small" color="#FFF" />
                      <Text style={styles.btnFetchText}>Fetching...</Text>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} color="#FFF" />
                      <Text style={styles.btnFetchText}>Fetch &amp; Preview</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Checkbox: Save as default */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setSaveAsDefault(!saveAsDefault)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkboxBox, saveAsDefault && styles.checkboxBoxActive]}>
                  {saveAsDefault && <Check size={12} color="#FFF" strokeWidth={3} />}
                </View>
                <Text style={styles.checkboxLabel}>Save this Sheet URL as default for future syncs</Text>
              </TouchableOpacity>

              {/* Direct File Fallback Option */}
              <View style={styles.fileFallbackDivider}>
                <View style={styles.fileFallbackLine} />
                <Text style={styles.fileFallbackDividerText}>OR CHOOSE FILE INSTEAD</Text>
                <View style={styles.fileFallbackLine} />
              </View>

              <View style={styles.fileFallbackBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Upload size={16} color="#047857" />
                  <Text style={styles.fileFallbackBoxTitle}>Upload Downloaded CSV or Excel File</Text>
                </View>
                <Text style={styles.fileFallbackBoxSub}>
                  If you have downloaded your Google Sheet (.csv or .xlsx), you can select it directly here:
                </Text>

                {Platform.OS === 'web' && (
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleLocalFilePicked}
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      width: '100%',
                      maxWidth: 320,
                    }}
                  />
                )}
              </View>
            </View>

            {/* Error Message Box with Troubleshooting Guide */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <AlertCircle size={20} color="#DC2626" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.errorTitle}>Failed to Access Google Sheet</Text>
                    <Text style={styles.errorText}>{errorMessage}</Text>

                    <View style={styles.errorTipsCard}>
                      <Text style={styles.errorTipsTitle}>How to fix access in 2 easy ways:</Text>
                      <Text style={styles.errorTipItem}>
                        <Text style={{ fontWeight: '700' }}>Option 1 (Share Link):</Text> In your Google Sheet, click <Text style={{ fontWeight: '700' }}>"Share"</Text> (top-right) → under General access select <Text style={{ fontWeight: '700' }}>"Anyone with the link"</Text> (Viewer).
                      </Text>
                      <Text style={styles.errorTipItem}>
                        <Text style={{ fontWeight: '700' }}>Option 2 (Publish to Web):</Text> Click <Text style={{ fontWeight: '700' }}>File → Share → Publish to web</Text>, select <Text style={{ fontWeight: '700' }}>Comma-separated values (.csv)</Text>, and paste that published link above.
                      </Text>
                      <Text style={styles.errorTipItem}>
                        <Text style={{ fontWeight: '700' }}>Option 3 (Direct File):</Text> Click <Text style={{ fontWeight: '700' }}>File → Download → Comma-separated values (.csv)</Text> in Google Sheets, then click the "Choose File" button above.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Step 2: Preview Summary & Duplicate Handling */}
            {previewStats && (
              <View style={styles.previewSection}>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNum}>{previewStats.totalRows}</Text>
                    <Text style={styles.statLabel}>Rows in Sheet</Text>
                  </View>
                  <View style={[styles.statCard, { borderColor: '#86EFAC' }]}>
                    <Text style={[styles.statNum, { color: '#15803D' }]}>{previewStats.validCount}</Text>
                    <Text style={styles.statLabel}>Valid Questions</Text>
                  </View>
                  <View style={[styles.statCard, { borderColor: '#93C5FD' }]}>
                    <Text style={[styles.statNum, { color: '#1D4ED8' }]}>{previewStats.newCount}</Text>
                    <Text style={styles.statLabel}>New to Insert</Text>
                  </View>
                  <View style={[styles.statCard, { borderColor: '#FDE047' }]}>
                    <Text style={[styles.statNum, { color: '#B45309' }]}>{previewStats.duplicateCount}</Text>
                    <Text style={styles.statLabel}>Duplicates in DB</Text>
                  </View>
                </View>

                {/* Duplicate Handling Mode Toggle */}
                <View style={styles.duplicateCard}>
                  <View style={styles.duplicateHeader}>
                    <Layers size={18} color="#047857" />
                    <Text style={styles.duplicateTitle}>Duplicate Handling Strategy</Text>
                  </View>
                  <Text style={styles.duplicateSubtitle}>
                    {previewStats.duplicateCount > 0
                      ? `Found ${previewStats.duplicateCount} question(s) already in Cloud DB (matched by Question Text / Stem).`
                      : 'No duplicates found — all rows in this sheet are brand new questions ready to import.'}
                  </Text>

                  <View style={styles.radioOptionsRow}>
                    {/* Option 1: Skip */}
                    <TouchableOpacity
                      style={[
                        styles.radioCard,
                        duplicateMode === 'skip' && styles.radioCardActive,
                      ]}
                      onPress={() => setDuplicateMode('skip')}
                      activeOpacity={0.8}
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
                        Only insert <Text style={{ fontWeight: '700' }}>{previewStats.newCount}</Text> new questions.
                        Leaves existing questions untouched.
                      </Text>
                    </TouchableOpacity>

                    {/* Option 2: Overwrite */}
                    <TouchableOpacity
                      style={[
                        styles.radioCard,
                        duplicateMode === 'overwrite' && styles.radioCardActive,
                      ]}
                      onPress={() => setDuplicateMode('overwrite')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.radioTop}>
                        <View
                          style={[styles.radioCircle, duplicateMode === 'overwrite' && styles.radioCircleActive]}
                        >
                          {duplicateMode === 'overwrite' && <View style={styles.radioDot} />}
                        </View>
                        <Text style={[styles.radioLabel, duplicateMode === 'overwrite' && styles.radioLabelActive]}>
                          Overwrite existing
                        </Text>
                      </View>
                      <Text style={styles.radioDesc}>
                        Update <Text style={{ fontWeight: '700' }}>{previewStats.duplicateCount}</Text> matching
                        records with new sheet data, plus insert {previewStats.newCount} new questions.
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Errors notification if any */}
                {previewStats.errorCount > 0 && (
                  <View style={styles.errorsNotificationCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={15} color="#B91C1C" />
                        <Text style={styles.errorsNotificationText}>
                          {previewStats.errorCount} row(s) had missing required fields and will be skipped.
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setShowErrorDetails(!showErrorDetails)}>
                        <Text style={styles.errorsToggleBtn}>
                          {showErrorDetails ? 'Hide Details' : 'View Errors'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {showErrorDetails && (
                      <View style={styles.errorsList}>
                        {previewStats.errors.slice(0, 8).map((err, idx) => (
                          <Text key={idx} style={styles.errorListItem}>
                            • Row {err.row}: {err.error} {err.rawSnippet ? `(${err.rawSnippet.slice(0, 35)}...)` : ''}
                          </Text>
                        ))}
                        {previewStats.errors.length > 8 && (
                          <Text style={styles.errorListItemMore}>
                            + {previewStats.errors.length - 8} more error rows
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Sample Questions Preview */}
                <View style={styles.samplePreviewContainer}>
                  <Text style={styles.samplePreviewHeading}>
                    Sample Parsed Questions (First 2 Rows):
                  </Text>
                  {previewStats.validQuestions.slice(0, 2).map((q, idx) => (
                    <View key={idx} style={styles.sampleCard}>
                      <View style={styles.sampleBadgesRow}>
                        <Text style={styles.sampleTypeBadge}>{q.questionType.toUpperCase()}</Text>
                        <Text style={styles.sampleChapterBadge}>{q.ch}</Text>
                        {q.r && <Text style={styles.sampleRefBadge}>{q.r}</Text>}
                      </View>
                      <Text style={styles.sampleStem} numberOfLines={2}>
                        {q.stem}
                      </Text>
                      <View style={styles.sampleOptionsRow}>
                        {q.o.map((opt, oIdx) => (
                          <Text
                            key={oIdx}
                            style={[
                              styles.sampleOptText,
                              oIdx === q.c && styles.sampleOptCorrect,
                            ]}
                            numberOfLines={1}
                          >
                            {String.fromCharCode(65 + oIdx)}. {opt}
                          </Text>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Modal Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={isImporting}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btnConfirm,
                (!previewStats || previewStats.validCount === 0 || isImporting) && styles.btnConfirmDisabled,
              ]}
              onPress={handleConfirmImport}
              disabled={!previewStats || previewStats.validCount === 0 || isImporting}
              activeOpacity={0.8}
            >
              {isImporting ? (
                <>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.btnConfirmText}>Importing to Cloud DB...</Text>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} color="#FFF" />
                  <Text style={styles.btnConfirmText}>
                    {previewStats
                      ? `Confirm & Import (${
                          duplicateMode === 'skip'
                            ? `${previewStats.newCount} New`
                            : `${previewStats.validCount} Total`
                        })`
                      : 'Confirm & Import to Cloud DB'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 99999,
    display: 'flex' as any,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '90vh' as any,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 16,
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
    flexShrink: 0,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
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
  modalSubtitle: {
    fontSize: 12,
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
    flex: 1,
    maxHeight: 'calc(90vh - 130px)' as any,
  },
  inputCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 8,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  urlIconWrap: {
    position: 'absolute',
    left: 10,
    zIndex: 2,
  },
  urlInput: {
    flex: 1,
    minWidth: 260,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingLeft: 34,
    paddingRight: 12,
    fontSize: 13,
    color: THEME.colors.ink,
  },
  btnFetch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#047857',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    height: 40,
  },
  btnFetchDisabled: {
    opacity: 0.6,
  },
  btnFetchText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  checkboxBox: {
    width: 18,
    height: 18,
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
    fontSize: 12,
    color: THEME.colors.muted,
  },
  fileFallbackDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  fileFallbackLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  fileFallbackDividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  fileFallbackBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  fileFallbackBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  fileFallbackBoxSub: {
    fontSize: 11,
    color: THEME.colors.muted,
    lineHeight: 16,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 18,
    marginBottom: 10,
  },
  errorTipsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
  },
  errorTipsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
  },
  errorTipItem: {
    fontSize: 11,
    color: '#7F1D1D',
    lineHeight: 16,
    marginBottom: 4,
  },
  previewSection: {
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  statLabel: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  duplicateCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 14,
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  duplicateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  duplicateSubtitle: {
    fontSize: 12,
    color: '#15803D',
    marginBottom: 12,
  },
  radioOptionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  radioCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  radioCardActive: {
    borderColor: '#047857',
    backgroundColor: '#ECFDF5',
  },
  radioTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#047857',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#047857',
  },
  radioLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  radioLabelActive: {
    color: '#047857',
  },
  radioDesc: {
    fontSize: 11,
    color: THEME.colors.muted,
    lineHeight: 16,
  },
  errorsNotificationCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
  },
  errorsNotificationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991B1B',
  },
  errorsToggleBtn: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    textDecorationLine: 'underline',
  },
  errorsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
  },
  errorListItem: {
    fontSize: 11,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  errorListItemMore: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
    marginTop: 4,
  },
  samplePreviewContainer: {
    marginTop: 4,
  },
  samplePreviewHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 8,
  },
  sampleCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  sampleBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  sampleTypeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sampleChapterBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sampleRefBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#854D0E',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sampleStem: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.ink,
    lineHeight: 17,
    marginBottom: 6,
  },
  sampleOptionsRow: {
    gap: 4,
  },
  sampleOptText: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
  sampleOptCorrect: {
    fontWeight: '700',
    color: '#15803D',
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
    flexShrink: 0,
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
  targetCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  targetCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  targetCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  selectorsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  selectCol: {
    flex: 1,
    minWidth: 140,
  },
  selectLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  verifyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  verifyToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  verifyToggleSub: {
    fontSize: 11,
    color: '#64748B',
  },
  targetPreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  targetPreviewBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  targetPreviewBadgeTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  targetPreviewBadgeVerified: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
});
