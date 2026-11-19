import React, { useState, useEffect, useMemo } from 'react';
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
  Plus,
  Trash2,
  Upload,
  Download,
  Pencil,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  X,
  Layers,
  ArrowRight,
  RefreshCw,
  Check,
  Compass,
  Sparkles,
  RotateCcw,
  Send,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Question, QuestionType, MatchPair, Difficulty } from '../../types';
import { backend } from '../../services/backend';
import {
  parseSpreadsheetBuffer,
  downloadSampleTemplate,
  SpreadsheetParseResult,
} from '../../utils/spreadsheetHelper';
import { useApp } from '../../context/AppContext';
import { GeminiService } from '../../services/gemini';
import { AISettingsModal } from './AISettingsModal';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  standard: 'Standard MCQ',
  assertion_reason: 'Assertion / Reason',
  match_the_pair: 'Match the Pair',
  statement_type: 'Statement Type',
};

const AI_QUICK_CHIPS = [
  {
    label: 'Convert to Statement I & II',
    instruction:
      'Convert this question into NTA AIAPGET Statement I & Statement II format with bilingual English and Hindi/Sanskrit, standard options A-D, and correct answer index.',
    actionName: 'Statement I & II Conversion',
  },
  {
    label: 'Convert to Assertion–Reason',
    instruction:
      'Convert this question into NTA AIAPGET Assertion (A) and Reason (R) format with bilingual English and Hindi/Sanskrit, standard options A-D, and correct answer index.',
    actionName: 'Assertion–Reason Conversion',
  },
  {
    label: 'Convert to Direct MCQ',
    instruction:
      'Convert this question into a direct single-best-answer standard MCQ with 4 plausible choices A-D in English and Devanagari Hindi.',
    actionName: 'Direct MCQ Conversion',
  },
  {
    label: 'Fix Bilingual Hindi',
    instruction:
      'Fix and enhance the bilingual Sanskrit / Devanagari Hindi translation, correcting spelling of classical Ayurvedic terms and maintaining exam-grade precision.',
    actionName: 'Bilingual Hindi Polishing',
  },
];

const STANDARD_AR_OPTIONS = [
  'Both (A) and (R) are true and (R) is the correct explanation of (A) / (A) और (R) दोनों सही हैं और (R), (A) की सही व्याख्या है',
  'Both (A) and (R) are true but (R) is NOT the correct explanation of (A) / (A) और (R) दोनों सही हैं परंतु (R), (A) की सही व्याख्या नहीं है',
  '(A) is true but (R) is false / (A) सही है परंतु (R) सही नहीं है',
  '(A) is false but (R) is true / (A) सही नहीं है परंतु (R) सही है',
];

const STANDARD_STATEMENT_OPTIONS = [
  'Both Statement I and Statement II are correct / दोनों कथन I और II सही हैं',
  'Both Statement I and Statement II are incorrect / दोनों कथन I और II गलत हैं',
  'Statement I is correct but Statement II is incorrect / कथन I सही है परंतु कथन II गलत है',
  'Statement I is incorrect but Statement II is correct / कथन I गलत है परंतु कथन II सही है',
];

interface QuestionManagementProps {
  onOpenAISettings?: () => void;
}

export const QuestionManagement: React.FC<QuestionManagementProps> = ({ onOpenAISettings }) => {
  const { refreshQuestions } = useApp() as any;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(50);

  // Modals & form state
  const [isAddFormOpen, setIsAddFormOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // AI Interactive Assistant state
  const [isAiRephrasing, setIsAiRephrasing] = useState<boolean>(false);
  const [isAiRephrased, setIsAiRephrased] = useState<boolean>(false);
  const [aiCustomInstruction, setAiCustomInstruction] = useState<string>('');
  const [aiActionLabel, setAiActionLabel] = useState<string>('AI Rephrased');
  const [originalBeforeAI, setOriginalBeforeAI] = useState<{
    qType: QuestionType;
    stem: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    assertionText: string;
    reasonText: string;
    statement1: string;
    statement2: string;
  } | null>(null);
  const [internalAISettingsOpen, setInternalAISettingsOpen] = useState<boolean>(false);

  // Progress Tracking: Set of Question IDs edited
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set());

  // Quick Jump Input
  const [jumpNumber, setJumpNumber] = useState<string>('');

  // Form State (for Add or Edit)
  const [qType, setQType] = useState<QuestionType>('standard');
  const [chapterName, setChapterName] = useState<string>('Charaka Samhita > Sutrasthana > Chapter 1');
  const [refSource, setRefSource] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [stem, setStem] = useState<string>('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState<number>(0);
  const [explanation, setExplanation] = useState<string>('');

  // Conditional fields
  const [assertionText, setAssertionText] = useState<string>('');
  const [reasonText, setReasonText] = useState<string>('');
  const [statement1, setStatement1] = useState<string>('');
  const [statement2, setStatement2] = useState<string>('');
  const [matchPairs, setMatchPairs] = useState<MatchPair[]>([
    { left: 'A. Item 1', right: 'I. Value 1' },
    { left: 'B. Item 2', right: 'II. Value 2' },
    { left: 'C. Item 3', right: 'III. Value 3' },
    { left: 'D. Item 4', right: 'IV. Value 4' },
  ]);

  // Bulk Upload State
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadParseResult, setUploadParseResult] = useState<SpreadsheetParseResult | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const loadCloudQuestions = async () => {
    setLoading(true);
    try {
      const data = await backend.getQuestions();
      setQuestions(data);
      const editedList = await backend.getEditedQuestionIds();
      setEditedIds(new Set(editedList));
    } catch (e) {
      console.warn('Failed to load questions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCloudQuestions();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  // Reset Form
  const resetFormFields = () => {
    setQType('standard');
    setChapterName('Charaka Samhita > Sutrasthana > Chapter 1');
    setRefSource('');
    setDifficulty(1);
    setStem('');
    setOptions(['', '', '', '']);
    setCorrectAnswer(0);
    setExplanation('');
    setAssertionText('');
    setReasonText('');
    setStatement1('');
    setStatement2('');
    setEditingQuestion(null);
    setOriginalBeforeAI(null);
    setIsAiRephrased(false);
    setIsAiRephrasing(false);
    setAiCustomInstruction('');
    setAiActionLabel('AI Rephrased');
  };

  // Pre-fill Edit Modal with existing Question Data
  const handleStartEdit = (q: Question) => {
    setEditingQuestion(q);
    setQType(q.questionType || 'standard');
    setChapterName(q.chapterName || String(q.ch || 'Charaka Samhita > Sutrasthana > Chapter 1'));
    setRefSource(q.r || '');
    setDifficulty((q.d ?? 1) as Difficulty);
    setStem(q.stem || '');
    setOptions(
      q.o && q.o.length >= 4
        ? [...q.o]
        : [q.o?.[0] || '', q.o?.[1] || '', q.o?.[2] || '', q.o?.[3] || '']
    );
    setCorrectAnswer(q.c ?? 0);
    setExplanation(q.explanation || (q as any).exp || '');
    setAssertionText(q.assertionText || '');
    setReasonText(q.reasonText || '');
    setStatement1(q.statement1 || '');
    setStatement2(q.statement2 || '');
    if (q.matchPairs && q.matchPairs.length > 0) {
      setMatchPairs(q.matchPairs);
    }
    setOriginalBeforeAI(null);
    setIsAiRephrased(false);
    setIsAiRephrasing(false);
    setAiCustomInstruction('');
    setAiActionLabel('AI Rephrased');
    setIsAddFormOpen(false);
  };

  // Interactive AI Assistant handler
  const handleRunAI = async (customInstruction?: string, actionName?: string) => {
    const key = await GeminiService.getApiKey();
    if (!key) {
      const openSettings = confirm(
        'Gemini API Key is not configured.\n\nWould you like to open AI Settings now to paste your free Gemini API key?'
      );
      if (openSettings) {
        if (onOpenAISettings) {
          onOpenAISettings();
        } else {
          setInternalAISettingsOpen(true);
        }
      }
      return;
    }

    if (!stem.trim()) {
      alert('Please enter some question text first before asking AI.');
      return;
    }

    const instructionToUse =
      customInstruction !== undefined ? customInstruction.trim() : aiCustomInstruction.trim();

    setIsAiRephrasing(true);

    // Snapshot full original state before AI mutation (for 1-click Undo)
    if (!originalBeforeAI) {
      setOriginalBeforeAI({
        qType,
        stem,
        options: [...options],
        correctAnswer,
        explanation,
        assertionText,
        reasonText,
        statement1,
        statement2,
      });
    }

    try {
      const result = await GeminiService.transformQuestion({
        questionType: qType,
        questionText: stem,
        optionA: options[0] || '',
        optionB: options[1] || '',
        optionC: options[2] || '',
        optionD: options[3] || '',
        correctAnswer: correctAnswer,
        explanation: explanation,
        reference: refSource,
        chapter: chapterName,
        assertionText: assertionText,
        reasonText: reasonText,
        statement1: statement1,
        statement2: statement2,
        customInstruction: instructionToUse,
      });

      // Update question type if converted
      if (
        result.questionType &&
        ['standard', 'assertion_reason', 'match_the_pair', 'statement_type'].includes(
          result.questionType
        )
      ) {
        setQType(result.questionType as QuestionType);
      }

      setStem(result.questionText);
      setOptions([result.optionA, result.optionB, result.optionC, result.optionD]);

      if (
        typeof result.correctAnswer === 'number' &&
        result.correctAnswer >= 0 &&
        result.correctAnswer <= 3
      ) {
        setCorrectAnswer(result.correctAnswer);
      }

      if (result.explanation !== undefined) {
        setExplanation(result.explanation);
      }
      if (result.assertionText !== undefined) {
        setAssertionText(result.assertionText);
      }
      if (result.reasonText !== undefined) {
        setReasonText(result.reasonText);
      }
      if (result.statement1 !== undefined) {
        setStatement1(result.statement1);
      }
      if (result.statement2 !== undefined) {
        setStatement2(result.statement2);
      }

      setIsAiRephrased(true);
      setAiActionLabel(
        actionName || (instructionToUse ? `AI: "${instructionToUse.slice(0, 22)}..."` : 'AI Rephrased')
      );
      setAiCustomInstruction('');
      showToast('✨ Question transformed with Gemini AI! Review and click Save Changes.');
    } catch (err: any) {
      console.warn('AI Transformation error:', err);
      alert('Gemini AI processing failed:\n' + (err.message || 'Unknown error occurred.'));
    } finally {
      setIsAiRephrasing(false);
    }
  };

  const handleUndoAI = () => {
    if (originalBeforeAI) {
      setQType(originalBeforeAI.qType);
      setStem(originalBeforeAI.stem);
      setOptions(originalBeforeAI.options);
      setCorrectAnswer(originalBeforeAI.correctAnswer);
      setExplanation(originalBeforeAI.explanation);
      setAssertionText(originalBeforeAI.assertionText);
      setReasonText(originalBeforeAI.reasonText);
      setStatement1(originalBeforeAI.statement1);
      setStatement2(originalBeforeAI.statement2);
      setOriginalBeforeAI(null);
      setIsAiRephrased(false);
      setAiActionLabel('AI Rephrased');
      showToast('Reverted back to original question data.');
    }
  };

  // Save (Create or Update) Question
  const handleSaveQuestion = async () => {
    if (!stem.trim()) {
      alert('Please enter Question Text / Stem.');
      return;
    }
    if (!chapterName.trim()) {
      alert('Please enter Chapter Mapping (e.g. Charaka Samhita > Sutrasthana > Chapter 1).');
      return;
    }

    if (qType === 'assertion_reason') {
      if (!assertionText.trim() && !stem.includes('A:')) {
        alert('Please enter the Assertion (A) text.');
        return;
      }
    }

    const cleanOptions = options.map((o) => o.trim());
    if (cleanOptions.filter(Boolean).length < 2) {
      alert('Please provide at least options A and B.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Omit<Question, 'id'> = {
        ch: chapterName.trim(),
        chapterName: chapterName.trim(),
        questionType: qType,
        d: difficulty,
        c: correctAnswer,
        stem: stem.trim(),
        o: cleanOptions,
        r: refSource.trim() || undefined,
        explanation: explanation.trim() || undefined,
        assertionText: qType === 'assertion_reason' ? assertionText.trim() : undefined,
        reasonText: qType === 'assertion_reason' ? reasonText.trim() : undefined,
        statement1: qType === 'statement_type' ? statement1.trim() : undefined,
        statement2: qType === 'statement_type' ? statement2.trim() : undefined,
        matchPairs: qType === 'match_the_pair' ? matchPairs : undefined,
      };

      if (editingQuestion) {
        // UPDATE EXISTING QUESTION
        const updated = await backend.updateQuestion(editingQuestion.id, payload);
        const strId = String(editingQuestion.id);

        setQuestions((prev) =>
          prev.map((item) => (String(item.id) === strId ? updated : item))
        );
        setEditedIds((prev) => new Set([...prev, strId]));

        showToast('Question updated successfully in Cloud DB!');
        setEditingQuestion(null);
      } else {
        // CREATE NEW QUESTION
        const created = await backend.addQuestion(payload);
        const strId = String(created.id);

        setQuestions((prev) => [created, ...prev]);
        setEditedIds((prev) => new Set([...prev, strId]));

        showToast('New question created and saved to Cloud DB!');
        setIsAddFormOpen(false);
      }

      if (refreshQuestions) refreshQuestions();
      resetFormFields();
    } catch (e: any) {
      alert(e.message || 'Failed to save question.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (id: string | number) => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('Are you sure you want to delete this question from Cloud DB?')
        : true;
    if (!confirmed) return;

    try {
      await backend.deleteQuestion(id);
      const strId = String(id);
      setQuestions((prev) => prev.filter((q) => String(q.id) !== strId));
      setEditedIds((prev) => {
        const next = new Set(prev);
        next.delete(strId);
        return next;
      });
      if (refreshQuestions) refreshQuestions();
      showToast('Question deleted successfully.');
    } catch (e) {
      alert('Failed to delete question.');
    }
  };

  // Handle File Selection for Excel (.xlsx, .xls) and CSV (.csv)
  const handleFilePicked = (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) {
        try {
          const result = parseSpreadsheetBuffer(buffer);
          setUploadParseResult(result);
        } catch (err: any) {
          alert('Failed to parse file: ' + err.message);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Confirm and batch upload questions to Cloud DB
  const handleConfirmBatchUpload = async () => {
    if (!uploadParseResult || uploadParseResult.validQuestions.length === 0) {
      alert('No valid questions available to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const res = await backend.batchAddQuestions(uploadParseResult.validQuestions);
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();

      showToast(`Successfully uploaded ${res.added} questions to Cloud DB!`);
      setUploadParseResult(null);
      setUploadFileName('');
      setIsUploadModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Failed to upload questions.');
    } finally {
      setIsUploading(false);
    }
  };

  // Jump to specific Question #
  const handleJumpToQuestion = () => {
    const num = parseInt(jumpNumber.trim(), 10);
    if (isNaN(num) || num < 1 || num > questions.length) {
      alert(`Please enter a valid question number between 1 and ${questions.length}.`);
      return;
    }

    // Ensure list expands to show this question
    if (num > visibleCount) {
      setVisibleCount(Math.min(questions.length, num + 20));
    }

    setTimeout(() => {
      if (Platform.OS === 'web') {
        const targetElement = document.getElementById(`q-card-${num}`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetElement.style.outline = '3px solid #1F5A4D';
          targetElement.style.boxShadow = '0 0 16px rgba(31, 90, 77, 0.4)';
          setTimeout(() => {
            targetElement.style.outline = 'none';
            targetElement.style.boxShadow = 'none';
          }, 2500);
        } else {
          // If filtered out, let the user know
          alert(`Question #${num} is loaded. If it doesn't appear, check if your filters are currently hiding it.`);
        }
      }
    }, 150);
  };

  // Filtered & Paginated questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (selectedTypeFilter !== 'all' && q.questionType !== selectedTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const text = `${q.stem} ${q.chapterName || ''} ${q.r || ''} ${q.explanation || ''}`.toLowerCase();
        return text.includes(searchQuery.toLowerCase().trim());
      }
      return true;
    });
  }, [questions, selectedTypeFilter, searchQuery]);

  const displayedQuestions = useMemo(() => {
    return filteredQuestions.slice(0, visibleCount);
  }, [filteredQuestions, visibleCount]);

  // Breakdown metrics
  const typeCounts = useMemo(() => {
    const counts = {
      total: questions.length,
      standard: 0,
      assertion_reason: 0,
      match_the_pair: 0,
      statement_type: 0,
    };
    questions.forEach((q) => {
      if (counts[q.questionType] !== undefined) {
        counts[q.questionType]++;
      } else {
        counts.standard++;
      }
    });
    return counts;
  }, [questions]);

  return (
    <View style={styles.container}>
      {/* Toast Alert */}
      {toastMessage ? (
        <View style={styles.toast}>
          <CheckCircle2 size={16} color="#FFF" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Questions</Text>
          <Text style={[styles.metricNumber, { color: THEME.colors.ink }]}>{typeCounts.total}</Text>
          <Text style={styles.metricSub}>Live in Cloud DB</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Standard MCQs</Text>
          <Text style={[styles.metricNumber, { color: THEME.colors.brand }]}>{typeCounts.standard}</Text>
          <Text style={styles.metricSub}>Single Choice</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Assertion / Reason</Text>
          <Text style={[styles.metricNumber, { color: '#854D0E' }]}>{typeCounts.assertion_reason}</Text>
          <Text style={styles.metricSub}>A/R Analytical</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Match / Statements</Text>
          <Text style={[styles.metricNumber, { color: '#1E40AF' }]}>
            {typeCounts.match_the_pair + typeCounts.statement_type}
          </Text>
          <Text style={styles.metricSub}>Complex Types</Text>
        </View>
      </View>

      {/* Action Toolbar */}
      <View style={styles.toolbarRow}>
        <View style={styles.toolbarLeft}>
          {/* Add New Question */}
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => {
              resetFormFields();
              setIsAddFormOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#FFF" />
            <Text style={styles.btnPrimaryText}>+ Add New Question</Text>
          </TouchableOpacity>

          {/* Upload Excel / CSV */}
          <TouchableOpacity
            style={styles.btnUpload}
            onPress={() => {
              setIsUploadModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Upload size={16} color={THEME.colors.brandDark} />
            <Text style={styles.btnUploadText}>Upload Excel / CSV</Text>
          </TouchableOpacity>

          {/* Download Sample Template Dropdown / Action */}
          <TouchableOpacity
            style={styles.btnTemplate}
            onPress={() => downloadSampleTemplate('xlsx')}
            activeOpacity={0.8}
            accessibilityLabel="Download Excel Template"
          >
            <Download size={15} color="#166534" />
            <Text style={styles.btnTemplateText}>Download Excel Template (.xlsx)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnTemplateGhost}
            onPress={() => downloadSampleTemplate('csv')}
            activeOpacity={0.7}
            accessibilityLabel="Download CSV Template"
          >
            <Download size={14} color={THEME.colors.muted} />
            <Text style={styles.btnTemplateGhostText}>Template (.csv)</Text>
          </TouchableOpacity>

          {/* Sync Cloud */}
          <TouchableOpacity style={styles.btnGhost} onPress={loadCloudQuestions} activeOpacity={0.7}>
            <RefreshCw size={14} color={THEME.colors.muted} />
            <Text style={styles.btnGhostText}>Sync Cloud</Text>
          </TouchableOpacity>

          {/* AI Settings */}
          <TouchableOpacity
            style={styles.btnGhost}
            onPress={() => {
              if (onOpenAISettings) onOpenAISettings();
              else setInternalAISettingsOpen(true);
            }}
            activeOpacity={0.7}
          >
            <Sparkles size={14} color="#D97706" />
            <Text style={styles.btnGhostText}>AI Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ============================================================== */}
      {/* 1. BULK UPLOAD FIXED CENTERED MODAL (.XLSX / .XLS / .CSV)      */}
      {/* ============================================================== */}
      {isUploadModalOpen && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={22} color={THEME.colors.brand} />
                <View>
                  <Text style={styles.modalTitle}>Bulk Upload Questions (Excel / CSV)</Text>
                  <Text style={styles.modalSubtitle}>
                    Supports .xlsx, .xls, and .csv with strict UTF-8 Hindi &amp; Sanskrit Devanagari preservation.
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsUploadModalOpen(false)}>
                <X size={20} color={THEME.colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {/* File Picker Box */}
              <View style={styles.dropZone}>
                <Upload size={32} color={THEME.colors.brand} />
                <Text style={styles.dropZoneTitle}>Select your Question Spreadsheet</Text>
                <Text style={styles.dropZoneSub}>Choose an .xlsx, .xls, or .csv file from your computer</Text>

                {Platform.OS === 'web' && (
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFilePicked}
                    style={{
                      marginTop: 12,
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFF',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  />
                )}

                {uploadFileName ? (
                  <View style={styles.selectedFilePill}>
                    <CheckCircle2 size={14} color="#15803D" />
                    <Text style={styles.selectedFileName}>{uploadFileName}</Text>
                  </View>
                ) : null}
              </View>

              {/* Validation & Preview Summary */}
              {uploadParseResult && (
                <View style={styles.validationCard}>
                  <View style={styles.validationStatsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{uploadParseResult.totalRows}</Text>
                      <Text style={styles.statLabel}>Total Rows</Text>
                    </View>

                    <View style={styles.statBox}>
                      <Text style={[styles.statNum, { color: '#15803D' }]}>
                        {uploadParseResult.validQuestions.length}
                      </Text>
                      <Text style={styles.statLabel}>Valid Questions</Text>
                    </View>

                    <View style={styles.statBox}>
                      <Text
                        style={[
                          styles.statNum,
                          { color: uploadParseResult.errors.length > 0 ? '#DC2626' : '#15803D' },
                        ]}
                      >
                        {uploadParseResult.errors.length}
                      </Text>
                      <Text style={styles.statLabel}>Row Errors</Text>
                    </View>
                  </View>

                  {/* Error messages if any */}
                  {uploadParseResult.errors.length > 0 && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorTitle}>
                        Issues found in {uploadParseResult.errors.length} rows:
                      </Text>
                      <ScrollView style={{ maxHeight: 110 }}>
                        {uploadParseResult.errors.slice(0, 10).map((err, idx) => (
                          <Text key={idx} style={styles.errorTextItem}>
                            • Row {err.row}: {err.error}
                          </Text>
                        ))}
                        {uploadParseResult.errors.length > 10 && (
                          <Text style={styles.errorTextItem}>
                            ...and {uploadParseResult.errors.length - 10} more rows.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  )}

                  {/* Sample Preview */}
                  {uploadParseResult.validQuestions.length > 0 && (
                    <View style={styles.previewContainer}>
                      <Text style={styles.previewHeading}>
                        Preview Sample ({Math.min(3, uploadParseResult.validQuestions.length)} of{' '}
                        {uploadParseResult.validQuestions.length} questions):
                      </Text>
                      {uploadParseResult.validQuestions.slice(0, 3).map((q, qIdx) => (
                        <View key={qIdx} style={styles.sampleCard}>
                          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                            <Text style={styles.sampleBadge}>{q.chapterName}</Text>
                            <Text style={styles.sampleRefBadge}>{q.r}</Text>
                          </View>
                          <Text style={styles.sampleStem}>{q.stem}</Text>
                          <View style={styles.sampleOptionsRow}>
                            {q.o.map((opt, oIdx) => (
                              <Text
                                key={oIdx}
                                style={[
                                  styles.sampleOption,
                                  q.c === oIdx && styles.sampleOptionCorrect,
                                ]}
                              >
                                {String.fromCharCode(65 + oIdx)}. {opt}
                              </Text>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setIsUploadModalOpen(false)}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>

              {uploadParseResult && uploadParseResult.validQuestions.length > 0 && (
                <TouchableOpacity
                  style={[styles.btnConfirmUpload, isUploading && { opacity: 0.6 }]}
                  onPress={handleConfirmBatchUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Upload size={16} color="#FFF" />
                  )}
                  <Text style={styles.btnConfirmUploadText}>
                    {isUploading
                      ? 'Uploading...'
                      : `Confirm & Upload ${uploadParseResult.validQuestions.length} Questions`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ============================================================== */}
      {/* 2. ADD OR EDIT QUESTION FIXED CENTERED POPUP MODAL             */}
      {/* ============================================================== */}
      {(isAddFormOpen || editingQuestion) && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {editingQuestion ? (
                  <Pencil size={20} color={THEME.colors.brand} />
                ) : (
                  <Plus size={20} color={THEME.colors.brand} />
                )}
                <View>
                  <Text style={styles.modalTitle}>
                    {editingQuestion
                      ? `Edit Question #${
                          questions.findIndex((q) => String(q.id) === String(editingQuestion.id)) + 1
                        }`
                      : 'Add New Question to Cloud DB'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {editingQuestion
                      ? 'Changes will be saved directly to Cloud DB and reflected on the card immediately.'
                      : 'Fill details below to add a new question to the cloud database.'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsAddFormOpen(false);
                  setEditingQuestion(null);
                  resetFormFields();
                }}
              >
                <X size={20} color={THEME.colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {/* Question Type Selector */}
              <Text style={styles.label}>Question Type</Text>
              <View style={styles.pillRow}>
                {(['standard', 'assertion_reason', 'match_the_pair', 'statement_type'] as QuestionType[]).map(
                  (type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typePill, qType === type && styles.typePillActive]}
                      onPress={() => setQType(type)}
                    >
                      <Text style={[styles.typePillText, qType === type && styles.typePillTextActive]}>
                        {QUESTION_TYPE_LABELS[type]}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              {/* Chapter & Reference */}
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Chapter Mapping (Subject &gt; Sthana &gt; Chapter) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={chapterName}
                    onChangeText={setChapterName}
                    placeholder="e.g. Charaka Samhita > Sutrasthana > Chapter 1"
                    placeholderTextColor={THEME.colors.muted}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Reference / Shloka Citation</Text>
                  <TextInput
                    style={styles.textInput}
                    value={refSource}
                    onChangeText={setRefSource}
                    placeholder="e.g. Charaka Sutra 1/46, सत्त्वमात्मा शरीरं च..."
                    placeholderTextColor={THEME.colors.muted}
                  />
                </View>
              </View>

              {/* Difficulty & Correct Answer */}
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Difficulty Level</Text>
                  <View style={styles.pillRow}>
                    {[
                      { val: 0, label: 'Easy' },
                      { val: 1, label: 'Medium' },
                      { val: 2, label: 'Hard' },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.val}
                        style={[styles.typePill, difficulty === item.val && styles.typePillActive]}
                        onPress={() => setDifficulty(item.val as Difficulty)}
                      >
                        <Text style={[styles.typePillText, difficulty === item.val && styles.typePillTextActive]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Correct Answer Option *</Text>
                  <View style={styles.pillRow}>
                    {['A', 'B', 'C', 'D'].map((letter, idx) => (
                      <TouchableOpacity
                        key={letter}
                        style={[styles.typePill, correctAnswer === idx && styles.correctPillActive]}
                        onPress={() => setCorrectAnswer(idx)}
                      >
                        <Text
                          style={[
                            styles.typePillText,
                            correctAnswer === idx && styles.correctPillTextActive,
                          ]}
                        >
                          Option {letter}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Interactive AI Assistant Container */}
              <View style={styles.aiAssistantContainer}>
                {/* Header Row: Title & Undo Button / Status */}
                <View style={styles.aiAssistantHeader}>
                  <View style={styles.aiAssistantHeaderLeft}>
                    <Sparkles size={16} color="#1F5A4D" />
                    <Text style={styles.aiAssistantTitle}>Interactive AI Assistant (Gemini)</Text>
                    {isAiRephrased && (
                      <View style={styles.aiRephrasedBadge}>
                        <CheckCircle2 size={13} color="#15803D" />
                        <Text style={styles.aiRephrasedBadgeText}>
                          {aiActionLabel} — Review &amp; Save
                        </Text>
                      </View>
                    )}
                  </View>

                  {originalBeforeAI && (
                    <TouchableOpacity
                      style={styles.btnUndoAI}
                      onPress={handleUndoAI}
                      activeOpacity={0.7}
                      accessibilityLabel="Undo AI changes"
                    >
                      <RotateCcw size={12} color="#1F5A4D" />
                      <Text style={styles.btnUndoAIText}>Undo AI</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Instruction Input Box + Send Button + Rephrase with AI Button */}
                <View style={styles.aiInputRow}>
                  <View style={styles.aiInputWrapper}>
                    <TextInput
                      style={styles.aiTextInput}
                      value={aiCustomInstruction}
                      onChangeText={setAiCustomInstruction}
                      placeholder="Tell AI what to change, e.g., 'Convert to Statement I & II type' or 'Fix Hindi translation'..."
                      placeholderTextColor="#94A3B8"
                      onSubmitEditing={() => {
                        if (aiCustomInstruction.trim() && !isAiRephrasing) {
                          handleRunAI(aiCustomInstruction);
                        }
                      }}
                      editable={!isAiRephrasing}
                    />
                    {aiCustomInstruction.trim() ? (
                      <TouchableOpacity
                        style={styles.aiInputClearBtn}
                        onPress={() => setAiCustomInstruction('')}
                      >
                        <X size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Send Button */}
                  <TouchableOpacity
                    style={[
                      styles.btnAiSend,
                      (!aiCustomInstruction.trim() || isAiRephrasing) && styles.btnAiSendDisabled,
                    ]}
                    onPress={() => handleRunAI(aiCustomInstruction)}
                    disabled={!aiCustomInstruction.trim() || isAiRephrasing}
                    activeOpacity={0.8}
                  >
                    <Send size={13} color="#FFF" />
                    <Text style={styles.btnAiSendText}>Send</Text>
                  </TouchableOpacity>

                  {/* General "Rephrase with AI" button */}
                  <TouchableOpacity
                    style={[
                      styles.btnRephraseAI,
                      isAiRephrasing && styles.btnRephraseAIDisabled,
                    ]}
                    onPress={() => handleRunAI('', 'AI Polished')}
                    disabled={isAiRephrasing}
                    activeOpacity={0.8}
                  >
                    {isAiRephrasing ? (
                      <>
                        <ActivityIndicator size="small" color="#FFF" />
                        <Text style={styles.btnRephraseAIText}>Processing...</Text>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} color="#FFF" />
                        <Text style={styles.btnRephraseAIText}>✨ Rephrase with AI</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* 1-Click AIAPGET Quick-Action Conversion Chips */}
                <View style={styles.aiChipsRow}>
                  <Text style={styles.aiChipsLabel}>Quick AIAPGET Conversions:</Text>
                  {AI_QUICK_CHIPS.map((chip) => (
                    <TouchableOpacity
                      key={chip.label}
                      style={[
                        styles.aiQuickChip,
                        isAiRephrasing && { opacity: 0.5 },
                      ]}
                      onPress={() => handleRunAI(chip.instruction, chip.actionName)}
                      disabled={isAiRephrasing}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={11} color="#1F5A4D" />
                      <Text style={styles.aiQuickChipText}>{chip.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Question Text (Stem) */}
              <Text style={styles.label}>Question Stem / Text (Bilingual English + Devanagari/Hindi) *</Text>
              <TextInput
                style={[styles.textInput, styles.textareaStem]}
                value={stem}
                onChangeText={setStem}
                placeholder="Enter question text in English and Hindi/Sanskrit..."
                placeholderTextColor={THEME.colors.muted}
                multiline
              />

              {/* Assertion / Reason Fields */}
              {qType === 'assertion_reason' && (
                <View style={styles.conditionalCard}>
                  <Text style={styles.conditionalTitle}>Assertion &amp; Reason Text</Text>
                  <Text style={styles.subLabel}>Assertion (A):</Text>
                  <TextInput
                    style={[styles.textInput, styles.textareaSmall]}
                    value={assertionText}
                    onChangeText={setAssertionText}
                    placeholder="Assertion (A) statement..."
                    placeholderTextColor={THEME.colors.muted}
                    multiline
                  />
                  <Text style={[styles.subLabel, { marginTop: 8 }]}>Reason (R):</Text>
                  <TextInput
                    style={[styles.textInput, styles.textareaSmall]}
                    value={reasonText}
                    onChangeText={setReasonText}
                    placeholder="Reason (R) statement..."
                    placeholderTextColor={THEME.colors.muted}
                    multiline
                  />
                </View>
              )}

              {/* Options (A, B, C, D) */}
              <Text style={styles.label}>Options (A, B, C, D)</Text>
              {['A', 'B', 'C', 'D'].map((letter, idx) => (
                <View key={letter} style={styles.optionInputRow}>
                  <View style={[styles.optionPrefixBadge, correctAnswer === idx && styles.optionPrefixActive]}>
                    <Text style={[styles.optionPrefixText, correctAnswer === idx && styles.optionPrefixTextActive]}>
                      {letter}
                    </Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={options[idx] || ''}
                    onChangeText={(val) => {
                      const copy = [...options];
                      copy[idx] = val;
                      setOptions(copy);
                    }}
                    placeholder={`Option ${letter} text...`}
                    placeholderTextColor={THEME.colors.muted}
                  />
                </View>
              ))}

              {/* Explanation */}
              <Text style={styles.label}>Detailed Explanation &amp; Rationale</Text>
              <TextInput
                style={[styles.textInput, styles.textareaSmall]}
                value={explanation}
                onChangeText={setExplanation}
                placeholder="Detailed explanation, commentary (e.g. Chakrapanidatta), or mnemonic..."
                placeholderTextColor={THEME.colors.muted}
                multiline
              />
            </ScrollView>

            {/* Modal Footer Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => {
                  setIsAddFormOpen(false);
                  setEditingQuestion(null);
                  resetFormFields();
                }}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSave, submitting && { opacity: 0.6 }]}
                onPress={handleSaveQuestion}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Check size={16} color="#FFF" />
                )}
                <Text style={styles.btnSaveText}>
                  {editingQuestion ? 'Save Changes' : 'Save & Publish to Cloud DB'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ============================================================== */}
      {/* 3. QUESTIONS LIST & FILTERS                                    */}
      {/* ============================================================== */}
      <View style={styles.cardContainer}>
        {/* Search & Type Filter */}
        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Search size={16} color={THEME.colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search 5,952 questions by stem, chapter, or reference..."
              placeholderTextColor={THEME.colors.muted}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={THEME.colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Type Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillScroll}>
            {[
              { id: 'all', label: `All (${questions.length})` },
              { id: 'standard', label: `Standard (${typeCounts.standard})` },
              { id: 'assertion_reason', label: `Assertion / Reason (${typeCounts.assertion_reason})` },
              { id: 'match_the_pair', label: `Match Pair (${typeCounts.match_the_pair})` },
              { id: 'statement_type', label: `Statement (${typeCounts.statement_type})` },
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, selectedTypeFilter === f.id && styles.filterChipActive]}
                onPress={() => setSelectedTypeFilter(f.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedTypeFilter === f.id && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Counter Header with Jump-to-Question and Edited Counter */}
        <View style={styles.tableHeader}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={styles.tableTitle}>
              Cloud Question Bank ({filteredQuestions.length} matching)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
              <Text style={styles.tableSubtitle}>
                Showing {Math.min(visibleCount, filteredQuestions.length)} of {filteredQuestions.length}
              </Text>
              {editedIds.size > 0 && (
                <View style={styles.editedSessionBadge}>
                  <Check size={11} color="#15803D" />
                  <Text style={styles.editedSessionBadgeText}>
                    Edited in this session: {editedIds.size}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Jump to Question # Input */}
          <View style={styles.jumpContainer}>
            <Compass size={14} color={THEME.colors.brand} />
            <TextInput
              style={styles.jumpInput}
              placeholder="Jump to #..."
              placeholderTextColor={THEME.colors.muted}
              value={jumpNumber}
              onChangeText={setJumpNumber}
              keyboardType="number-pad"
              onSubmitEditing={handleJumpToQuestion}
            />
            <TouchableOpacity style={styles.jumpBtn} onPress={handleJumpToQuestion}>
              <Text style={styles.jumpBtnText}>Go</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Questions Render Loop */}
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={THEME.colors.brand} />
            <Text style={styles.emptyText}>Loading Cloud Questions...</Text>
          </View>
        ) : filteredQuestions.length === 0 ? (
          <View style={styles.emptyState}>
            <HelpCircle size={32} color={THEME.colors.muted} />
            <Text style={styles.emptyText}>No questions match your filter.</Text>
          </View>
        ) : (
          <View style={styles.questionsList}>
            {displayedQuestions.map((q) => {
              const globalIndex = questions.findIndex((item) => String(item.id) === String(q.id)) + 1;
              const isEdited = editedIds.has(String(q.id));

              const typeColor =
                q.questionType === 'assertion_reason'
                  ? '#854D0E'
                  : q.questionType === 'match_the_pair'
                  ? '#1E40AF'
                  : q.questionType === 'statement_type'
                  ? '#4338CA'
                  : THEME.colors.brand;

              const typeBg =
                q.questionType === 'assertion_reason'
                  ? '#FEF9C3'
                  : q.questionType === 'match_the_pair'
                  ? '#DBEAFE'
                  : q.questionType === 'statement_type'
                  ? '#E0E7FF'
                  : '#E6F4EA';

              return (
                <View
                  key={q.id}
                  id={`q-card-${globalIndex}`}
                  // @ts-ignore: nativeID for web DOM id attribute
                  nativeID={`q-card-${globalIndex}`}
                  style={styles.questionCard}
                >
                  {/* Top Badges & Action Buttons */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.badgeWrapper}>
                      {/* Question Serial Number Badge (#1, #2, #3...) */}
                      <View style={styles.qIndexBadge}>
                        <Text style={styles.qIndexBadgeText}>#{globalIndex}</Text>
                      </View>

                      {/* Question Type Badge */}
                      <View style={[styles.qTypeBadge, { backgroundColor: typeBg }]}>
                        <Text style={[styles.qTypeBadgeText, { color: typeColor }]}>
                          {QUESTION_TYPE_LABELS[q.questionType] || 'Standard MCQ'}
                        </Text>
                      </View>

                      {/* Edited Progress Tag */}
                      {isEdited && (
                        <View style={styles.editedBadge}>
                          <Check size={11} color="#15803D" />
                          <Text style={styles.editedBadgeText}>Edited</Text>
                        </View>
                      )}

                      {/* Chapter Badge (High Contrast Fix) */}
                      <View style={styles.qChapterBadge}>
                        <Text style={styles.qChapterBadgeText}>{q.chapterName || String(q.ch)}</Text>
                      </View>

                      {/* Reference Badge (Wrap Fix to prevent horizontal overflow) */}
                      {q.r ? (
                        <View style={styles.qRefBadge}>
                          <Text style={styles.qRefBadgeText}>{q.r}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Action Buttons: Edit (Pencil) & Delete (Trash) */}
                    <View style={styles.actionsCluster}>
                      <TouchableOpacity
                        style={styles.btnEdit}
                        onPress={() => handleStartEdit(q)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Edit Question #${globalIndex}`}
                      >
                        <Pencil size={14} color={THEME.colors.brand} />
                        <Text style={styles.btnEditText}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnDelete}
                        onPress={() => handleDeleteQuestion(q.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Delete Question #${globalIndex}`}
                      >
                        <Trash2 size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Question Stem Text */}
                  <Text style={styles.stemText}>{q.stem}</Text>

                  {/* Assertion / Reason Details */}
                  {q.questionType === 'assertion_reason' && (q.assertionText || q.reasonText) && (
                    <View style={styles.arBox}>
                      {q.assertionText ? (
                        <Text style={styles.arItem}>
                          <Text style={{ fontWeight: '700', color: THEME.colors.brand }}>Assertion (A): </Text>
                          {q.assertionText}
                        </Text>
                      ) : null}
                      {q.reasonText ? (
                        <Text style={[styles.arItem, { marginTop: 4 }]}>
                          <Text style={{ fontWeight: '700', color: THEME.colors.brand }}>Reason (R): </Text>
                          {q.reasonText}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* Options List */}
                  <View style={styles.optionsGrid}>
                    {q.o.map((opt, optIdx) => {
                      const isCorrect = q.c === optIdx;
                      return (
                        <View
                          key={optIdx}
                          style={[styles.optCard, isCorrect && styles.optCardCorrect]}
                        >
                          <Text style={[styles.optLetter, isCorrect && styles.optLetterCorrect]}>
                            {String.fromCharCode(65 + optIdx)}.
                          </Text>
                          <Text style={[styles.optText, isCorrect && styles.optTextCorrect]}>
                            {opt}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Explanation */}
                  {q.explanation && (
                    <View style={styles.explanationBox}>
                      <Text style={styles.explanationTitle}>Explanation: </Text>
                      <Text style={styles.explanationText}>{q.explanation}</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Pagination / Load More */}
            {filteredQuestions.length > visibleCount && (
              <TouchableOpacity
                style={styles.btnLoadMore}
                onPress={() => setVisibleCount((prev) => prev + 50)}
              >
                <Text style={styles.btnLoadMoreText}>
                  Load More ({filteredQuestions.length - visibleCount} remaining)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <AISettingsModal
        isOpen={internalAISettingsOpen}
        onClose={() => setInternalAISettingsOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  toast: {
    position: 'fixed' as any,
    top: 16,
    left: '50%' as any,
    transform: [{ translateX: -160 }],
    width: 320,
    zIndex: 99999,
    backgroundColor: '#065F46',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  metricLabel: {
    fontSize: 12,
    color: THEME.colors.muted,
    fontWeight: '600',
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginVertical: 4,
  },
  metricSub: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
  toolbarRow: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  btnPrimary: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnPrimaryActive: {
    backgroundColor: '#164339',
  },
  btnPrimaryText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  btnUpload: {
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnUploadText: {
    color: THEME.colors.brand,
    fontWeight: '700',
    fontSize: 13,
  },
  btnTemplate: {
    backgroundColor: '#F0FDF4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnTemplateText: {
    color: '#15803D',
    fontWeight: '600',
    fontSize: 12,
  },
  btnTemplateGhost: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnTemplateGhostText: {
    color: THEME.colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  btnGhost: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnGhostText: {
    color: THEME.colors.muted,
    fontSize: 12,
  },
  modalBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 10000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90vh' as any,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
    display: 'flex',
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
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    maxHeight: '70vh' as any,
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
  dropZone: {
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dropZoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginTop: 8,
  },
  dropZoneSub: {
    fontSize: 12,
    color: THEME.colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  selectedFilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginTop: 10,
  },
  selectedFileName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  validationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  validationStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  statLabel: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 6,
  },
  errorTextItem: {
    fontSize: 11,
    color: '#991B1B',
    lineHeight: 16,
  },
  previewContainer: {
    marginBottom: 14,
  },
  previewHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 8,
  },
  sampleCard: {
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  sampleBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
    backgroundColor: '#DBEAFE',
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
    color: THEME.colors.ink,
    fontWeight: '600',
    marginBottom: 4,
  },
  sampleOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sampleOption: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
  sampleOptionCorrect: {
    color: '#15803D',
    fontWeight: '700',
  },
  btnConfirmUpload: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnConfirmUploadText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.ink,
    marginBottom: 6,
    marginTop: 10,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.muted,
    marginBottom: 4,
  },
  aiAssistantContainer: {
    marginTop: 14,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 10,
    gap: 10,
  },
  aiAssistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  aiAssistantHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  aiAssistantTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F5A4D',
  },
  aiRephrasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  aiRephrasedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  btnUndoAI: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  btnUndoAIText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.ink,
  },
  aiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  aiInputWrapper: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  aiTextInput: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.ink,
    height: '100%',
  },
  aiInputClearBtn: {
    padding: 4,
  },
  btnAiSend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    height: 38,
  },
  btnAiSendDisabled: {
    opacity: 0.5,
  },
  btnAiSendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnRephraseAI: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#166534',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 38,
  },
  btnRephraseAIDisabled: {
    opacity: 0.65,
  },
  btnRephraseAIText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  aiChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  aiChipsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    marginRight: 2,
  },
  aiQuickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  aiQuickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F5A4D',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typePill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    backgroundColor: '#F8F9FA',
  },
  typePillActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  typePillText: {
    fontSize: 12,
    color: THEME.colors.ink,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: '#FFF',
  },
  correctPillActive: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  correctPillTextActive: {
    color: '#FFF',
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  textInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: THEME.colors.ink,
  },
  textareaStem: {
    height: 75,
    textAlignVertical: 'top',
  },
  textareaSmall: {
    height: 60,
    textAlignVertical: 'top',
  },
  conditionalCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  conditionalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.brand,
    marginBottom: 6,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  optionPrefixBadge: {
    width: 32,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  optionPrefixActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  optionPrefixText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  optionPrefixTextActive: {
    color: '#15803D',
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
  btnSave: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnSaveText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    padding: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.ink,
    height: '100%',
  },
  filterPillScroll: {
    marginTop: 10,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.brand,
  },
  filterChipText: {
    fontSize: 12,
    color: THEME.colors.muted,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 12,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  tableSubtitle: {
    fontSize: 12,
    color: THEME.colors.muted,
  },
  editedSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  editedSessionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  jumpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 3,
    gap: 6,
  },
  jumpInput: {
    width: 90,
    fontSize: 12,
    color: THEME.colors.ink,
    paddingVertical: 4,
  },
  jumpBtn: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  jumpBtnText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: THEME.colors.muted,
  },
  questionsList: {
    gap: 12,
  },
  questionCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  qIndexBadge: {
    backgroundColor: '#1E293B',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  qIndexBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qTypeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  qTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  editedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  editedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  qChapterBadge: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  qChapterBadgeText: {
    fontSize: 11,
    color: '#16241F',
    fontWeight: '600',
  },
  qRefBadge: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    maxWidth: '100%',
    flexShrink: 1,
  },
  qRefBadgeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  actionsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  btnEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  btnDelete: {
    padding: 5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
  },
  stemText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.ink,
    lineHeight: 20,
    marginBottom: 8,
  },
  arBox: {
    backgroundColor: '#FEFCE8',
    borderLeftWidth: 3,
    borderLeftColor: '#EAB308',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  arItem: {
    fontSize: 12,
    color: '#713F12',
    lineHeight: 18,
  },
  optionsGrid: {
    gap: 6,
    marginVertical: 4,
  },
  optCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  optCardCorrect: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  optLetter: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.muted,
    marginRight: 8,
    width: 20,
  },
  optLetterCorrect: {
    color: '#065F46',
  },
  optText: {
    fontSize: 12,
    color: THEME.colors.ink,
    flex: 1,
  },
  optTextCorrect: {
    color: '#065F46',
    fontWeight: '600',
  },
  explanationBox: {
    marginTop: 8,
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.brand,
  },
  explanationTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.brand,
  },
  explanationText: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
    lineHeight: 16,
  },
  btnLoadMore: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  btnLoadMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.brand,
  },
});
