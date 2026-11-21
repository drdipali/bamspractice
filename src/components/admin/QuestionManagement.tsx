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
  AlertTriangle,
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
  FolderSync,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Wrench,
  Edit3,
  CheckSquare,
  Link2,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Question, QuestionType, MatchPair, Difficulty } from '../../types';
import { backend } from '../../services/backend';
import {
  parseSpreadsheetBuffer,
  downloadSampleTemplate,
  fetchGoogleSheetCsv,
  extractGoogleSheetCsvCandidates,
  SpreadsheetParseResult,
} from '../../utils/spreadsheetHelper';
import { GoogleDriveService } from '../../services/googleDriveService';
import {
  buildChapterHierarchy,
  checkQuestionRemap,
  detectChapterInfo,
  detectSamhitaMismatch,
  getQuestionAuditStatus,
  isQuestionMalformed,
  SubjectSummaryItem,
  ChapterSummaryItem,
  SthanaSummaryItem,
  CLASSICAL_SAMHITA_SCHEMA,
  getCanonicalSthana,
  isValidClassicalTag,
  isQuestionChapterVerified,
  isValidQuestion,
} from '../../utils/chapterMapper';
import { useApp } from '../../context/AppContext';
import { GeminiService, AIProvider } from '../../services/gemini';
import { AISettingsModal } from './AISettingsModal';
import { GoogleSheetSyncModal } from './GoogleSheetSyncModal';
import { GoogleDriveSyncModal } from './GoogleDriveSyncModal';
import { Portal } from '../common/Portal';

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
      'Convert this question into NTA AIAPGET Statement I & Statement II format. DO NOT cut or shorten the question concepts. Formulate Statement I and Statement II with full bilingual text in BOTH English and Devanagari Hindi. NEVER label as A: or R:. Provide a full bilingual explanation in BOTH English and natural Hindi (हिंदी व्याख्या:) with classical Shloka citations explaining why Statement I and Statement II are true or false.',
    actionName: 'Statement I & II Conversion',
  },
  {
    label: 'Convert to Assertion–Reason',
    instruction:
      'Convert this question into NTA AIAPGET Assertion (A) and Reason (R) format. DO NOT cut the core question concepts. Formulate Assertion (A) and Reason (R) with full bilingual text in BOTH English and Devanagari Hindi. Provide a full bilingual explanation in BOTH English and natural Hindi (हिंदी व्याख्या:) with classical Shloka citations.',
    actionName: 'Assertion–Reason Conversion',
  },
  {
    label: 'Convert to Direct MCQ',
    instruction:
      'Convert this question into a direct single-best-answer standard MCQ with 4 plausible choices A-D in English and Devanagari Hindi. Provide a full bilingual explanation in BOTH English and natural Hindi (हिंदी व्याख्या:).',
    actionName: 'Direct MCQ Conversion',
  },
  {
    label: 'Fix Bilingual Hindi',
    instruction:
      'Fix and polish bilingual English and Devanagari Hindi for Question Text, all Options A-D, and provide a full bilingual explanation in English and natural Hindi (हिंदी व्याख्या:). Keep the correct answer index unchanged.',
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

/**
 * Checks if a question row is shifted (e.g. question_text is purely numeric like 360, 420 or < 10 chars
 * while option_a is longer than 25 characters containing the actual stem).
 */
export const isBrokenShiftedQuestion = (q: Question): boolean => {
  const stem = String(q.stem || '').trim();
  const optA = String((q.o && q.o[0]) || (q as any).options?.[0] || '').trim();
  return (/^\d+\.?$/.test(stem) || stem.length < 10) && optA.length > 20;
};

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
  const [isGoogleSheetModalOpen, setIsGoogleSheetModalOpen] = useState<boolean>(false);
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isDeletingBroken, setIsDeletingBroken] = useState<boolean>(false);
  const [isRepairingBroken, setIsRepairingBroken] = useState<boolean>(false);

  // AI Interactive Assistant state
  const [isAiRephrasing, setIsAiRephrasing] = useState<boolean>(false);
  const [isAiRephrased, setIsAiRephrased] = useState<boolean>(false);
  const [aiCustomInstruction, setAiCustomInstruction] = useState<string>('');
  const [aiActionLabel, setAiActionLabel] = useState<string>('AI Rephrased');
  const [aiError, setAiError] = useState<string | null>(null);
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
  const [activeAIProvider, setActiveAIProvider] = useState<AIProvider>('gemini');

  const refreshAIProvider = async () => {
    try {
      const p = await GeminiService.getProvider();
      setActiveAIProvider(p);
    } catch {}
  };

  useEffect(() => {
    refreshAIProvider();
  }, []);

  // Progress Tracking: Set of Question IDs edited
  const [editedIds, setEditedIds] = useState<Set<string>>(new Set());

  // Cascading 3-Step Chapter Filter state (Samhita -> Sthana -> Chapter)
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string | null>(null);
  const [selectedSthanaFilter, setSelectedSthanaFilter] = useState<string | null>(null);
  const [selectedChapterFilter, setSelectedChapterFilter] = useState<string | null>(null);
  const [isChapterPanelExpanded, setIsChapterPanelExpanded] = useState<boolean>(true);
  const [auditHealthFilter, setAuditHealthFilter] = useState<'all' | 'valid' | 'errors' | 'verified'>('all');

  // Smart Citation Auto-Mapper state
  const [isAutoFixModalOpen, setIsAutoFixModalOpen] = useState<boolean>(false);
  const [remapCandidates, setRemapCandidates] = useState<
    { question: Question; remapInfo: ReturnType<typeof checkQuestionRemap> }[]
  >([]);
  const [manualReviewCandidates, setManualReviewCandidates] = useState<
    { question: Question; mismatch: ReturnType<typeof detectSamhitaMismatch> }[]
  >([]);
  const [isApplyingRemap, setIsApplyingRemap] = useState<boolean>(false);

  // Quick Jump Input
  const [jumpNumber, setJumpNumber] = useState<string>('');

  // Form State (for Add or Edit)
  const [qType, setQType] = useState<QuestionType>('standard');
  const [chapterName, setChapterName] = useState<string>('Uncategorized / Needs Review > General > Chapter 1');
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
  const [uploadTargetSamhita, setUploadTargetSamhita] = useState<string>('Charaka Samhita');
  const [uploadTargetSthana, setUploadTargetSthana] = useState<string>('Sutrasthana');
  const [uploadTargetChapter, setUploadTargetChapter] = useState<string>('Chapter 1');
  const [uploadMarkVerified, setUploadMarkVerified] = useState<boolean>(true);
  const [uploadTab, setUploadTab] = useState<'file' | 'link'>('file');
  const [uploadLinkUrl, setUploadLinkUrl] = useState<string>('');
  const [isFetchingLink, setIsFetchingLink] = useState<boolean>(false);
  const [uploadLinkError, setUploadLinkError] = useState<string | null>(null);

  // Multi-Select Bar State
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [isBatchUpdatingVerification, setIsBatchUpdatingVerification] = useState<boolean>(false);

  // Edit / Form state for chapter verified toggle
  const [isChapterVerifiedField, setIsChapterVerifiedField] = useState<boolean>(false);

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
    const defaultTag =
      [selectedSubjectFilter, selectedSthanaFilter, selectedChapterFilter].filter(Boolean).length === 3
        ? `${selectedSubjectFilter} > ${selectedSthanaFilter} > ${selectedChapterFilter}`
        : 'Uncategorized / Needs Review > General > Chapter 1';
    setChapterName(defaultTag);
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
    setIsChapterVerifiedField(false);
    setEditingQuestion(null);
    setOriginalBeforeAI(null);
    setIsAiRephrased(false);
    setIsAiRephrasing(false);
    setAiCustomInstruction('');
    setAiActionLabel('AI Rephrased');
    setAiError(null);
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

    let aText = q.assertionText || '';
    let rText = q.reasonText || '';
    if ((!aText || !rText) && q.stem) {
      const ma = (q.stem || '').match(/(?:Assertion\s*\(?A\)?|अभिकथन\s*\(?A\)?)\s*[:\/\-]([\s\S]*?)(?=(?:Reason\s*\(?R\)?|कारण\s*\(?R\)?)|$)/i);
      const mr = (q.stem || '').match(/(?:Reason\s*\(?R\)?|कारण\s*\(?R\)?)\s*[:\/\-]([\s\S]*?)$/i);
      if (ma && !aText) aText = `Assertion (A): ${ma[1].trim()}`;
      if (mr && !rText) rText = `Reason (R): ${mr[1].trim()}`;
    }
    setAssertionText(aText);
    setReasonText(rText);

    let s1 = q.statement1 || '';
    let s2 = q.statement2 || '';
    if ((!s1 || !s2) && q.stem) {
      const m1 = (q.stem || '').match(/(?:Statement\s*(?:I|1)|कथन\s*(?:I|1))\s*[:\/\-]([\s\S]*?)(?=(?:Statement\s*(?:II|2)|कथन\s*(?:II|2))|$)/i);
      const m2 = (q.stem || '').match(/(?:Statement\s*(?:II|2)|कथन\s*(?:II|2))\s*[:\/\-]([\s\S]*?)$/i);
      if (m1 && !s1) s1 = `Statement I: ${m1[1].trim()}`;
      if (m2 && !s2) s2 = `Statement II: ${m2[1].trim()}`;
    }
    setStatement1(s1);
    setStatement2(s2);
    setIsChapterVerifiedField(isQuestionChapterVerified(q));
    if (q.matchPairs && q.matchPairs.length > 0) {
      setMatchPairs(q.matchPairs);
    }
    setOriginalBeforeAI(null);
    setIsAiRephrased(false);
    setIsAiRephrasing(false);
    setAiCustomInstruction('');
    setAiActionLabel('AI Rephrased');
    setAiError(null);
    setIsAddFormOpen(false);
  };

  // Interactive AI Assistant handler
  const handleRunAI = async (customInstruction?: string, actionName?: string) => {
    setAiError(null);
    const provider = await GeminiService.getProvider();
    setActiveAIProvider(provider);
    const providerLabel = provider === 'groq' ? 'Groq Free' : 'Google Gemini';
    const key = await GeminiService.getApiKey();
    if (!key) {
      const msg = `${providerLabel} API Key missing. Please click "AI Settings" in the header to paste your ${providerLabel} API key.`;
      setAiError(msg);
      const openSettings = confirm(
        `${providerLabel} API Key is not configured.\n\nWould you like to open AI Settings now to paste your free ${providerLabel} API key?`
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
      setAiError('Please enter question stem text before running AI.');
      return;
    }

    const instructionToUse =
      customInstruction !== undefined ? customInstruction.trim() : aiCustomInstruction.trim();

    setIsAiRephrasing(true);

    try {
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
      if (result.suggestedChapterTag && result.suggestedChapterTag.trim()) {
        setChapterName(result.suggestedChapterTag.trim());
      }

      setIsAiRephrased(true);
      setAiActionLabel(
        actionName || (instructionToUse ? `AI: "${instructionToUse.slice(0, 22)}..."` : 'AI Rephrased')
      );
      setAiCustomInstruction('');
      setAiError(null);
      showToast('✨ Question transformed with Gemini AI! Review and click Save Changes.');
    } catch (err: any) {
      console.warn('AI Transformation error:', err);
      const errMsg = err.message || 'Unknown error occurred while contacting Gemini API.';
      setAiError(errMsg);
    } finally {
      setIsAiRephrasing(false); // ALWAYS RESET LOADING STATE
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

    if (qType === 'statement_type') {
      if (!statement1.trim() && !statement2.trim() && !stem.includes('Statement I')) {
        alert('Please enter Statement I and Statement II.');
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
        is_chapter_verified: isChapterVerifiedField,
        isChapterVerified: isChapterVerifiedField,
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
          const result = parseSpreadsheetBuffer(buffer, { fileName: file.name });
          setUploadParseResult(result);
        } catch (err: any) {
          alert('Failed to parse file: ' + err.message);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Fetch & Parse Google Sheet or Google Drive file link
  const handleFetchUploadLink = async () => {
    const raw = uploadLinkUrl.trim().replace(/^["']|["']$/g, '');
    if (!raw) {
      setUploadLinkError('Please paste a Google Sheet or Google Drive file link.');
      return;
    }

    setIsFetchingLink(true);
    setUploadLinkError(null);
    setUploadParseResult(null);
    setUploadFileName('');

    try {
      let csvOrBuffer: ArrayBuffer | string | null = null;
      const gdriveToken = GoogleDriveService.getActiveToken();
      const candidates = extractGoogleSheetCsvCandidates(raw);
      const fileId = candidates?.sheetId;

      // 1. If Google Drive token exists, attempt authenticated Drive API export / download
      if (gdriveToken && fileId) {
        try {
          const exportRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
            { headers: { Authorization: `Bearer ${gdriveToken}` } }
          );
          if (exportRes.ok) {
            csvOrBuffer = await exportRes.arrayBuffer();
          } else {
            const mediaRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
              { headers: { Authorization: `Bearer ${gdriveToken}` } }
            );
            if (mediaRes.ok) {
              csvOrBuffer = await mediaRes.arrayBuffer();
            }
          }
        } catch (authErr) {
          console.warn('Authenticated Drive fetch error, falling back to public export:', authErr);
        }
      }

      // 2. Fallback to public fetchGoogleSheetCsv across candidate export endpoints
      if (!csvOrBuffer) {
        csvOrBuffer = await fetchGoogleSheetCsv(raw);
      }

      // 3. Parse spreadsheet buffer with strict UTF-8 preservation & column-shift auto-healing
      const parsed = parseSpreadsheetBuffer(csvOrBuffer, { fileName: 'Google Sheet Link' });
      if (parsed.validQuestions.length === 0) {
        throw new Error(
          'No valid questions could be extracted from this sheet. Please make sure the sheet contains Question Text, Options A-D, and Correct Answer.'
        );
      }

      setUploadParseResult(parsed);
      setUploadFileName(fileId ? `Google Sheet (${fileId.slice(0, 10)}...)` : 'Google Sheet Link');
      showToast(`Parsed ${parsed.validQuestions.length} valid questions from Google link!`);
    } catch (err: any) {
      console.warn('Google link import error:', err);
      let msg = err.message || 'Failed to fetch and parse Google link.';
      if (
        msg.includes('401') ||
        msg.includes('403') ||
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('private')
      ) {
        msg = "Make sure the Google Sheet sharing is set to 'Anyone with the link can view' (or connect Google Drive).";
      }
      setUploadLinkError(msg);
    } finally {
      setIsFetchingLink(false);
    }
  };

  // Confirm and batch upload questions to Cloud DB with strict target chapter & verification
  const handleConfirmBatchUpload = async () => {
    if (!uploadParseResult || uploadParseResult.validQuestions.length === 0) {
      alert('No valid questions available to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const targetTag = `${uploadTargetSamhita} > ${uploadTargetSthana} > ${uploadTargetChapter}`;
      const questionsToUpload = uploadParseResult.validQuestions.map((q) => ({
        ...q,
        ch: targetTag,
        chapterName: targetTag,
        is_chapter_verified: uploadMarkVerified,
        isChapterVerified: uploadMarkVerified,
      }));

      const res = await backend.batchAddQuestions(questionsToUpload);
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();

      showToast(
        `Successfully uploaded ${res.added} questions to ${targetTag}${
          uploadMarkVerified ? ' (✓ Chapter-Verified)' : ''
        }!`
      );
      setUploadParseResult(null);
      setUploadFileName('');
      setUploadLinkUrl('');
      setUploadLinkError(null);
      setIsUploadModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Failed to upload questions.');
    } finally {
      setIsUploading(false);
    }
  };

  // Quick 1-click toggle verification status on a question card
  const handleQuickToggleVerify = async (q: Question) => {
    const nextState = !isQuestionChapterVerified(q);
    try {
      await backend.updateQuestion(q.id, {
        is_chapter_verified: nextState,
        isChapterVerified: nextState,
      });
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();
      showToast(
        nextState
          ? `✓ Marked Question #${q.id} as Chapter-Verified!`
          : `Unmarked Chapter-Verified for Question #${q.id}.`
      );
    } catch (err: any) {
      alert('Failed to toggle verification: ' + err.message);
    }
  };

  // Toggle selection for multi-select
  const toggleSelectQuestion = (id: string | number) => {
    const strId = String(id);
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(strId)) next.delete(strId);
      else next.add(strId);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedQuestionIds(new Set(displayedQuestions.map((q) => String(q.id))));
  };

  const handleDeselectAll = () => {
    setSelectedQuestionIds(new Set());
  };

  const handleBatchSetVerified = async (verified: boolean) => {
    if (selectedQuestionIds.size === 0) return;
    const ids = Array.from(selectedQuestionIds);
    setIsBatchUpdatingVerification(true);
    try {
      const updates = ids.map((id) => ({
        id,
        patch: {
          is_chapter_verified: verified,
          isChapterVerified: verified,
        },
      }));
      await backend.updateQuestionsBatch(updates);
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();
      setSelectedQuestionIds(new Set());
      showToast(
        verified
          ? `✓ Marked ${ids.length} question(s) as Chapter-Verified!`
          : `Unmarked Chapter-Verified for ${ids.length} question(s).`
      );
    } catch (err: any) {
      alert('Failed to update questions: ' + err.message);
    } finally {
      setIsBatchUpdatingVerification(false);
    }
  };

  // 1-Click Promote Entire Chapter to Verified
  const handleMarkEntireChapterVerified = async () => {
    if (filteredQuestions.length === 0) return;
    const count = filteredQuestions.length;
    const chapterLabel = [selectedSubjectFilter, selectedSthanaFilter, selectedChapterFilter].filter(Boolean).join(' › ');
    const confirmed = confirm(
      `Mark all ${count} question(s) in "${chapterLabel}" as Chapter-Verified?\n\n` +
        `These questions will immediately appear in Student Chapter-Wise Practice Mode.`
    );
    if (!confirmed) return;
    setIsBatchUpdatingVerification(true);
    try {
      const updates = filteredQuestions.map((q) => ({
        id: q.id,
        patch: {
          is_chapter_verified: true,
          isChapterVerified: true,
        },
      }));
      await backend.updateQuestionsBatch(updates);
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();
      showToast(`✓ Successfully verified all ${count} questions in ${chapterLabel}!`);
    } catch (err: any) {
      alert('Failed to verify chapter: ' + err.message);
    } finally {
      setIsBatchUpdatingVerification(false);
    }
  };

  // Google Sheet Direct Sync callback
  const handleGoogleSheetImportSuccess = async (result: {
    addedCount: number;
    updatedCount: number;
    skippedCount: number;
    affectedIds: string[];
  }) => {
    await loadCloudQuestions();
    if (refreshQuestions) refreshQuestions();

    if (result.affectedIds && result.affectedIds.length > 0) {
      setEditedIds((prev) => new Set([...prev, ...result.affectedIds]));
    }

    const msg =
      result.updatedCount > 0
        ? `Successfully imported ${result.addedCount} new questions (${result.updatedCount} updated, ${result.skippedCount} skipped) from Google Sheet!`
        : `Successfully imported ${result.addedCount} questions (${result.skippedCount} skipped) from Google Sheet!`;
    showToast(msg);
  };

  // Google Drive Folder Sync callback
  const handleGoogleDriveImportSuccess = async (result: {
    addedCount: number;
    updatedCount: number;
    skippedCount: number;
    affectedIds: string[];
  }) => {
    await loadCloudQuestions();
    if (refreshQuestions) refreshQuestions();

    if (result.affectedIds && result.affectedIds.length > 0) {
      setEditedIds((prev) => new Set([...prev, ...result.affectedIds]));
    }

    const msg =
      result.updatedCount > 0
        ? `🎉 Google Drive Sync complete! ${result.addedCount} new questions added (${result.updatedCount} updated, ${result.skippedCount} skipped).`
        : `🎉 Google Drive Sync complete! ${result.addedCount} questions added (${result.skippedCount} skipped).`;
    showToast(msg);
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

  // Detect Shifted / Broken rows (numeric serial stems with question in Option A)
  const brokenQuestions = useMemo(() => {
    return questions.filter(isBrokenShiftedQuestion);
  }, [questions]);

  // Detect Samhita / Citation Mismatches (e.g. su.su citation with Charaka tag, or impossible chapters)
  const mismatchQuestions = useMemo(() => {
    return questions.filter((q) => detectSamhitaMismatch(q).hasMismatch);
  }, [questions]);

  // Delete all flagged shifted/broken rows in one click
  const handleDeleteAllBrokenRows = async () => {
    if (brokenQuestions.length === 0) return;
    const count = brokenQuestions.length;
    const confirmed = confirm(
      `Are you sure you want to delete ${count} flagged shifted/broken question(s) from Cloud DB?\n\n` +
        `These questions have numeric serial numbers (like 420 or 430) as question text while Option A contains the question stem.\n\n` +
        `Once deleted, you can re-run Google Drive Sync with the updated smart parser to cleanly re-import all questions without any shift!`
    );
    if (!confirmed) return;

    setIsDeletingBroken(true);
    try {
      const idsToDelete = brokenQuestions.map((q) => q.id);
      await backend.deleteQuestions(idsToDelete);
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();
      setSelectedTypeFilter('all');
      showToast(`🗑️ Successfully deleted ${count} broken shifted rows! You can now re-run Google Drive Sync.`);
    } catch (err: any) {
      alert(`Failed to delete broken rows: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeletingBroken(false);
    }
  };

  // Auto-Repair all flagged shifted/broken rows in one click
  const handleAutoRepairBrokenRows = async () => {
    if (brokenQuestions.length === 0) return;
    const count = brokenQuestions.length;
    const confirmed = confirm(
      `Auto-repair ${count} shifted question(s) directly in Cloud DB?\n\n` +
        `This will:\n` +
        `1. Move the question text from Option A into the Question Stem.\n` +
        `2. Shift Options B, C, D into Options A, B, C.\n` +
        `3. Automatically detect the correct Samhita, Sthana & Chapter from the citation (e.g. Charaka Sutra 26/32 -> Ch 26).\n\n` +
        `Proceed with repair?`
    );
    if (!confirmed) return;

    setIsRepairingBroken(true);
    try {
      const updates = brokenQuestions.map((q) => {
        const realStem = String(q.o?.[0] || (q as any).options?.[0] || '').trim();
        const realOptA = String(q.o?.[1] || (q as any).options?.[1] || '').trim();
        const realOptB = String(q.o?.[2] || (q as any).options?.[2] || '').trim();
        const realOptC = String(q.o?.[3] || (q as any).options?.[3] || '').trim();
        const realOptD = 'None of the above / उपर्युक्त में से कोई नहीं';

        const detected = detectChapterInfo(q.r, q.explanation, undefined, realStem);

        return {
          id: q.id,
          patch: {
            stem: realStem,
            o: [realOptA, realOptB, realOptC, realOptD],
            ch: detected.fullChapterName,
            chapterName: detected.fullChapterName,
          },
        };
      });

      await backend.updateQuestionsBatch(updates);
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();
      setSelectedTypeFilter('all');
      showToast(`🛠️ Successfully repaired ${count} shifted question(s)!`);
    } catch (err: any) {
      alert(`Failed to repair broken rows: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRepairingBroken(false);
    }
  };

  // Cascading 3-Step Chapter Filter Helper: Reset all 3 tiers
  const handleResetCascadingFilter = () => {
    setSelectedSubjectFilter(null);
    setSelectedSthanaFilter(null);
    setSelectedChapterFilter(null);
  };

  // Filtered & Paginated questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (selectedTypeFilter === 'broken_shifted') {
        if (!isBrokenShiftedQuestion(q)) return false;
      } else if (selectedTypeFilter === 'citation_mismatch') {
        if (!detectSamhitaMismatch(q).hasMismatch) return false;
      } else if (selectedTypeFilter === 'chapter_verified') {
        if (!isQuestionChapterVerified(q)) return false;
      } else if (selectedTypeFilter !== 'all' && q.questionType !== selectedTypeFilter) {
        return false;
      }

      // Cascading 3-Step Chapter Filter (Subject -> Sthana -> Chapter)
      if (selectedSubjectFilter) {
        const rawTag = String(q.chapterName || q.ch || 'Charaka Samhita > Sutrasthana > Chapter 1').trim();
        const parts = rawTag.split('>').map((s) => s.trim());
        let qSubj = parts[0] || 'Charaka Samhita';
        let qSthana = parts[1] || 'Sutrasthana';
        let qChapter = parts[2] || (parts[1] && parts[1].toLowerCase().includes('chapter') ? parts[1] : 'Chapter 1');
        if (!parts[1] && !parts[2]) {
          qSubj = 'General Ayurveda';
          qSthana = 'General';
          qChapter = rawTag || 'Chapter 1';
        }

        const subjMatch =
          qSubj.toLowerCase() === selectedSubjectFilter.toLowerCase() ||
          rawTag.toLowerCase().includes(selectedSubjectFilter.toLowerCase());
        if (!subjMatch) return false;

        if (selectedSthanaFilter) {
          const sthanaMatch =
            qSthana.toLowerCase() === selectedSthanaFilter.toLowerCase() ||
            rawTag.toLowerCase().includes(selectedSthanaFilter.toLowerCase());
          if (!sthanaMatch) return false;

          if (selectedChapterFilter) {
            const chFilterNum = selectedChapterFilter.replace(/\D/g, '');
            const qChNum = qChapter.replace(/\D/g, '');
            const chMatch =
              qChapter.toLowerCase() === selectedChapterFilter.toLowerCase() ||
              (chFilterNum !== '' && qChNum !== '' && chFilterNum === qChNum) ||
              rawTag.toLowerCase().includes(selectedChapterFilter.toLowerCase());
            if (!chMatch) return false;
          }
        }
      } else if (selectedChapterFilter) {
        const qBreadcrumb = (q.chapterName || String(q.ch) || '').toLowerCase();
        if (!qBreadcrumb.includes(selectedChapterFilter.toLowerCase())) {
          return false;
        }
      }

      // Chapter Health & Accuracy Filter ('all' | 'valid' | 'errors' | 'verified')
      if (auditHealthFilter !== 'all') {
        const audit = getQuestionAuditStatus(q);
        if (auditHealthFilter === 'valid' && !audit.isValid) return false;
        if (auditHealthFilter === 'errors' && audit.isValid) return false;
        if (auditHealthFilter === 'verified' && !isQuestionChapterVerified(q)) return false;
      }

      if (searchQuery.trim()) {
        const text = `${q.stem} ${q.chapterName || ''} ${q.r || ''} ${q.explanation || ''}`.toLowerCase();
        return text.includes(searchQuery.toLowerCase().trim());
      }
      return true;
    });
  }, [
    questions,
    selectedTypeFilter,
    selectedSubjectFilter,
    selectedSthanaFilter,
    selectedChapterFilter,
    auditHealthFilter,
    searchQuery,
  ]);

  const displayedQuestions = useMemo(() => {
    return filteredQuestions.slice(0, visibleCount);
  }, [filteredQuestions, visibleCount]);

  // Build hierarchical chapter breakdown
  const chapterHierarchy = useMemo(() => {
    return buildChapterHierarchy(questions);
  }, [questions]);

  // Total unique chapters count across all subjects
  const totalChaptersCount = useMemo(() => {
    let count = 0;
    chapterHierarchy.forEach((s) => {
      s.sthanas.forEach((st) => {
        count += st.chapters.length;
      });
    });
    return count;
  }, [chapterHierarchy]);

  // Cascading Selection Lookups
  const activeSubjectObj = useMemo(() => {
    if (!selectedSubjectFilter) return null;
    return (
      chapterHierarchy.find(
        (s) => s.name.toLowerCase() === selectedSubjectFilter.toLowerCase()
      ) || null
    );
  }, [chapterHierarchy, selectedSubjectFilter]);

  const availableSthanas = useMemo(() => {
    return activeSubjectObj ? activeSubjectObj.sthanas : [];
  }, [activeSubjectObj]);

  const canonicalSchemaForSubject = useMemo(() => {
    if (!selectedSubjectFilter) return null;
    return CLASSICAL_SAMHITA_SCHEMA[selectedSubjectFilter] || null;
  }, [selectedSubjectFilter]);

  const { canonicalSthanasDisplay, impossibleSthanasDisplay } = useMemo(() => {
    if (!selectedSubjectFilter || !canonicalSchemaForSubject) {
      return {
        canonicalSthanasDisplay: availableSthanas.map((s) => ({
          name: s.name,
          total: s.total,
          valid: s.valid,
          malformed: s.malformed,
          maxChapters: undefined as number | undefined,
        })),
        impossibleSthanasDisplay: [],
      };
    }

    // Canonical Sthanas from the official schema
    const canonicalList = canonicalSchemaForSubject.sthanas.map((schemaSth) => {
      // Find matching sthana in DB if any
      const found = availableSthanas.find((s) => {
        const clean = s.name.trim().toLowerCase();
        return (
          clean === schemaSth.name.toLowerCase() ||
          clean.includes(schemaSth.name.toLowerCase()) ||
          schemaSth.aliases?.some((a) => clean.includes(a.toLowerCase()))
        );
      });
      return {
        name: schemaSth.name,
        total: found ? found.total : 0,
        valid: found ? found.valid : 0,
        malformed: found ? found.malformed : 0,
        maxChapters: schemaSth.maxChapters,
      };
    });

    // Any sthana currently in DB that is NOT canonical for this Samhita (e.g. Uttarasthana in Charaka)
    const impossibleList = availableSthanas.filter((s) => {
      return !getCanonicalSthana(selectedSubjectFilter, s.name);
    });

    return {
      canonicalSthanasDisplay: canonicalList,
      impossibleSthanasDisplay: impossibleList,
    };
  }, [selectedSubjectFilter, canonicalSchemaForSubject, availableSthanas]);

  const activeSthanaMaxChapters = useMemo(() => {
    if (!selectedSubjectFilter || !selectedSthanaFilter) return null;
    const canonical = getCanonicalSthana(selectedSubjectFilter, selectedSthanaFilter);
    return canonical ? canonical.maxChapters : null;
  }, [selectedSubjectFilter, selectedSthanaFilter]);

  const activeSthanaObj = useMemo(() => {
    if (!activeSubjectObj || !selectedSthanaFilter) return null;
    return (
      activeSubjectObj.sthanas.find(
        (st) => st.name.toLowerCase() === selectedSthanaFilter.toLowerCase()
      ) || null
    );
  }, [activeSubjectObj, selectedSthanaFilter]);

  const availableChapters = useMemo(() => {
    return activeSthanaObj ? activeSthanaObj.chapters : [];
  }, [activeSthanaObj]);

  const activeChapterObj = useMemo(() => {
    if (!availableChapters.length || !selectedChapterFilter) return null;
    return (
      availableChapters.find(
        (c) => c.name.toLowerCase() === selectedChapterFilter.toLowerCase()
      ) || null
    );
  }, [availableChapters, selectedChapterFilter]);

  // Live count for active path
  const activeFilterLiveCount = useMemo(() => {
    if (activeChapterObj) return activeChapterObj.valid;
    if (activeSthanaObj) return activeSthanaObj.valid;
    if (activeSubjectObj) return activeSubjectObj.valid;
    return questions.filter((q) => !isQuestionMalformed(q)).length;
  }, [activeChapterObj, activeSthanaObj, activeSubjectObj, questions]);

  // Scope Metrics for Chapter Health & Accuracy Summary Strip
  const scopeMetrics = useMemo(() => {
    const inScope = questions.filter((q) => {
      if (!selectedSubjectFilter) return true;
      const rawTag = String(q.chapterName || q.ch || 'Uncategorized / Needs Review > General > Chapter 1').trim();
      const parts = rawTag.split('>').map((s) => s.trim());
      let qSubj = parts[0] || 'Uncategorized / Needs Review';
      let qSthana = parts[1] || (qSubj.includes('Uncategorized') ? 'General' : 'Sutrasthana');
      let qChapter = parts[2] || (parts[1] && parts[1].toLowerCase().includes('chapter') ? parts[1] : 'Chapter 1');
      if (!parts[1] && !parts[2]) {
        qSubj = 'Uncategorized / Needs Review';
        qSthana = 'General';
        qChapter = rawTag || 'Chapter 1';
      }

      const subjMatch =
        qSubj.toLowerCase() === selectedSubjectFilter.toLowerCase() ||
        rawTag.toLowerCase().includes(selectedSubjectFilter.toLowerCase());
      if (!subjMatch) return false;

      if (selectedSthanaFilter) {
        const sthanaMatch =
          qSthana.toLowerCase() === selectedSthanaFilter.toLowerCase() ||
          rawTag.toLowerCase().includes(selectedSthanaFilter.toLowerCase());
        if (!sthanaMatch) return false;

        if (selectedChapterFilter) {
          const chFilterNum = selectedChapterFilter.replace(/\D/g, '');
          const qChNum = qChapter.replace(/\D/g, '');
          return (
            qChapter.toLowerCase() === selectedChapterFilter.toLowerCase() ||
            (chFilterNum !== '' && qChNum !== '' && chFilterNum === qChNum) ||
            rawTag.toLowerCase().includes(selectedChapterFilter.toLowerCase())
          );
        }
      }
      return true;
    });

    let validCount = 0;
    let errorCount = 0;
    let verifiedCount = 0;
    inScope.forEach((q) => {
      if (isQuestionChapterVerified(q)) {
        verifiedCount++;
      }
      if (getQuestionAuditStatus(q).isValid) {
        validCount++;
      } else {
        errorCount++;
      }
    });

    return {
      total: inScope.length,
      valid: validCount,
      errors: errorCount,
      verified: verifiedCount,
    };
  }, [questions, selectedSubjectFilter, selectedSthanaFilter, selectedChapterFilter]);

  // Smart Citation Auto-Mapper handlers
  const handleOpenAutoFixModal = () => {
    const autoFixable: { question: Question; remapInfo: ReturnType<typeof checkQuestionRemap> }[] = [];
    const manualReview: { question: Question; mismatch: ReturnType<typeof detectSamhitaMismatch> }[] = [];

    questions.forEach((q) => {
      const res = checkQuestionRemap(q);
      const currentTag = String(q.chapterName || q.ch || '').trim();

      if (res.needsRemap && res.suggestedTag !== currentTag && isValidClassicalTag(res.suggestedTag)) {
        autoFixable.push({ question: q, remapInfo: res });
      } else {
        const mismatch = detectSamhitaMismatch(q);
        if (mismatch.hasMismatch) {
          manualReview.push({ question: q, mismatch });
        }
      }
    });

    setRemapCandidates(autoFixable);
    setManualReviewCandidates(manualReview);
    setIsAutoFixModalOpen(true);
  };

  const handleApplyAutoRemap = async () => {
    if (remapCandidates.length === 0) return;
    setIsApplyingRemap(true);
    try {
      const updates = remapCandidates.map((c) => ({
        id: c.question.id,
        patch: {
          chapterName: c.remapInfo.suggestedTag,
          ch: c.remapInfo.suggestedTag,
        },
      }));

      const count = await backend.updateQuestionsBatch(updates);
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();
      showToast(`🔄 Successfully updated chapter tags for ${count} question(s)!`);
      setIsAutoFixModalOpen(false);
    } catch (err: any) {
      alert(`Failed to auto-remap questions: ${err.message || 'Unknown error'}`);
    } finally {
      setIsApplyingRemap(false);
    }
  };

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

  const verifiedCount = useMemo(() => {
    return questions.filter(isQuestionChapterVerified).length;
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

          {/* Import from Google Sheet */}
          <TouchableOpacity
            style={styles.btnGoogleSheet}
            onPress={() => {
              setIsGoogleSheetModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <FileSpreadsheet size={16} color="#047857" />
            <Text style={styles.btnGoogleSheetText}>Import from Google Sheet</Text>
          </TouchableOpacity>

          {/* Google Drive Folder Sync */}
          <TouchableOpacity
            style={styles.btnGoogleDrive}
            onPress={() => {
              setIsGoogleDriveModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <FolderSync size={16} color="#1D4ED8" />
            <Text style={styles.btnGoogleDriveText}>Google Drive Sync</Text>
          </TouchableOpacity>

          {/* Auto-Fix Chapter Tags from Citations */}
          <TouchableOpacity
            style={styles.btnAutoFixChapters}
            onPress={handleOpenAutoFixModal}
            activeOpacity={0.8}
            accessibilityLabel="Auto-Fix Chapter Tags from Citations"
          >
            <RefreshCw size={15} color="#4338CA" />
            <Text style={styles.btnAutoFixChaptersText}>Auto-Fix Chapter Tags</Text>
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
        <Portal>
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
              {/* Step 1: Strict Classical Target Chapter Selector */}
              <View style={styles.uploadTargetCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Compass size={16} color="#047857" />
                  <Text style={styles.uploadTargetTitle}>1. Target Classical Samhita, Sthana &amp; Chapter *</Text>
                </View>
                <Text style={styles.uploadTargetSub}>
                  Select where these questions belong. Every row in this upload will be mapped to this exact chapter (ignoring fallback defaults).
                </Text>

                <View style={styles.uploadSelectorsRow}>
                  {/* Samhita Selector */}
                  <View style={styles.uploadSelectCol}>
                    <Text style={styles.uploadSelectLabel}>Samhita / Subject</Text>
                    <select
                      value={uploadTargetSamhita}
                      onChange={(e) => {
                        const newSamhita = e.target.value;
                        setUploadTargetSamhita(newSamhita);
                        const schema = CLASSICAL_SAMHITA_SCHEMA[newSamhita];
                        if (schema && schema.sthanas.length > 0) {
                          setUploadTargetSthana(schema.sthanas[0].name);
                        }
                        setUploadTargetChapter('Chapter 1');
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
                  <View style={styles.uploadSelectCol}>
                    <Text style={styles.uploadSelectLabel}>Sthana / Section</Text>
                    <select
                      value={uploadTargetSthana}
                      onChange={(e) => {
                        setUploadTargetSthana(e.target.value);
                        setUploadTargetChapter('Chapter 1');
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
                      {(CLASSICAL_SAMHITA_SCHEMA[uploadTargetSamhita]?.sthanas || []).map((sth) => (
                        <option key={sth.name} value={sth.name}>
                          {sth.name} ({sth.maxChapters} Chs)
                        </option>
                      ))}
                    </select>
                  </View>

                  {/* Chapter Selector */}
                  <View style={styles.uploadSelectCol}>
                    <Text style={styles.uploadSelectLabel}>Chapter</Text>
                    <select
                      value={uploadTargetChapter}
                      onChange={(e) => setUploadTargetChapter(e.target.value)}
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
                            CLASSICAL_SAMHITA_SCHEMA[uploadTargetSamhita]?.sthanas.find(
                              (s) => s.name === uploadTargetSthana
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
                  style={styles.uploadVerifyToggleRow}
                  onPress={() => setUploadMarkVerified(!uploadMarkVerified)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkboxBoxSmall,
                      uploadMarkVerified && { backgroundColor: '#059669', borderColor: '#059669' },
                    ]}
                  >
                    {uploadMarkVerified && <Check size={11} color="#FFF" strokeWidth={3} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uploadVerifyToggleText}>
                      ✅ Mark uploaded questions as Chapter-Verified
                    </Text>
                    <Text style={styles.uploadVerifyToggleSub}>
                      Enables these questions immediately in Student Chapter-Wise Practice Mode.
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.targetPreviewBadge}>
                  <Text style={styles.targetPreviewBadgeLabel}>Target Mapping:</Text>
                  <Text style={styles.targetPreviewBadgeTag}>
                    {uploadTargetSamhita} › {uploadTargetSthana} › {uploadTargetChapter}
                  </Text>
                  {uploadMarkVerified && (
                    <Text style={styles.targetPreviewBadgeVerified}>✓ Chapter-Verified</Text>
                  )}
                </View>
              </View>

              <Text style={styles.uploadStep2Title}>2. Choose Question Source</Text>

              {/* Source Tabs: Upload File vs Google Drive / Sheet Link */}
              <View style={styles.uploadSourceTabsRow}>
                <TouchableOpacity
                  style={[
                    styles.uploadSourceTab,
                    uploadTab === 'file' && styles.uploadSourceTabActive,
                  ]}
                  onPress={() => {
                    setUploadTab('file');
                    setUploadLinkError(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Upload size={14} color={uploadTab === 'file' ? '#047857' : '#64748B'} />
                  <Text
                    style={[
                      styles.uploadSourceTabText,
                      uploadTab === 'file' && styles.uploadSourceTabTextActive,
                    ]}
                  >
                    Upload File (.xlsx, .xls, .csv)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.uploadSourceTab,
                    uploadTab === 'link' && styles.uploadSourceTabActive,
                  ]}
                  onPress={() => {
                    setUploadTab('link');
                    setUploadLinkError(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Link2 size={14} color={uploadTab === 'link' ? '#047857' : '#64748B'} />
                  <Text
                    style={[
                      styles.uploadSourceTabText,
                      uploadTab === 'link' && styles.uploadSourceTabTextActive,
                    ]}
                  >
                    Google Drive / Sheet Link
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab 1: File Picker Box */}
              {uploadTab === 'file' && (
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
              )}

              {/* Tab 2: Google Drive / Sheet Link Import */}
              {uploadTab === 'link' && (
                <View style={styles.uploadLinkCard}>
                  <Text style={styles.uploadLinkLabel}>Paste Google Sheet or Google Drive file link:</Text>
                  <View style={styles.uploadLinkInputRow}>
                    <View style={styles.uploadLinkIconWrap}>
                      <Link2 size={16} color="#047857" />
                    </View>
                    <TextInput
                      style={styles.uploadLinkInput}
                      value={uploadLinkUrl}
                      onChangeText={(text) => {
                        setUploadLinkUrl(text);
                        if (uploadLinkError) setUploadLinkError(null);
                      }}
                      placeholder="Paste Google Sheet or Google Drive file link..."
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                      selectTextOnFocus
                      onSubmitEditing={handleFetchUploadLink}
                    />
                    <TouchableOpacity
                      style={[styles.btnFetchLink, isFetchingLink && styles.btnFetchLinkDisabled]}
                      onPress={handleFetchUploadLink}
                      disabled={isFetchingLink}
                      activeOpacity={0.8}
                    >
                      {isFetchingLink ? (
                        <>
                          <ActivityIndicator size="small" color="#FFF" />
                          <Text style={styles.btnFetchLinkText}>Fetching...</Text>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={13} color="#FFF" />
                          <Text style={styles.btnFetchLinkText}>Fetch &amp; Import</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.uploadLinkHelper}>
                    Supports URLs from Google Sheets (docs.google.com/spreadsheets/d/...) and Google Drive (drive.google.com/file/d/...).
                  </Text>

                  {/* Clear Error Feedback */}
                  {uploadLinkError && (
                    <View style={styles.uploadLinkErrorBanner}>
                      <AlertCircle size={16} color="#DC2626" style={{ marginTop: 2, flexShrink: 0 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.uploadLinkErrorTitle}>Unable to Access Link</Text>
                        <Text style={styles.uploadLinkErrorText}>{uploadLinkError}</Text>
                      </View>
                    </View>
                  )}

                  {uploadFileName && !uploadLinkError ? (
                    <View style={styles.selectedFilePill}>
                      <CheckCircle2 size={14} color="#15803D" />
                      <Text style={styles.selectedFileName}>{uploadFileName}</Text>
                    </View>
                  ) : null}
                </View>
              )}

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
                          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Text style={styles.sampleBadge}>
                              {uploadTargetSamhita} › {uploadTargetSthana} › {uploadTargetChapter}
                            </Text>
                            {uploadMarkVerified && (
                              <Text style={styles.sampleVerifiedBadge}>✓ Chapter-Verified</Text>
                            )}
                            {q.r ? <Text style={styles.sampleRefBadge}>{q.r}</Text> : null}
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
        </Portal>
      )}

      {/* ============================================================== */}
      {/* 2. ADD OR EDIT QUESTION FIXED CENTERED POPUP MODAL             */}
      {/* ============================================================== */}
      {(isAddFormOpen || editingQuestion) && (
        <Portal>
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

              {/* Chapter-Verified Toggle in Edit Modal */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 6,
                  marginBottom: 12,
                  padding: 9,
                  borderRadius: 6,
                  backgroundColor: isChapterVerifiedField ? '#ECFDF5' : '#F8FAFC',
                  borderWidth: 1,
                  borderColor: isChapterVerifiedField ? '#A7F3D0' : '#E2E8F0',
                }}
                onPress={() => setIsChapterVerifiedField(!isChapterVerifiedField)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.checkboxBoxSmall,
                    isChapterVerifiedField && { backgroundColor: '#059669', borderColor: '#059669' },
                  ]}
                >
                  {isChapterVerifiedField && <Check size={11} color="#FFF" strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: isChapterVerifiedField ? '#047857' : '#334155',
                    }}
                  >
                    {isChapterVerifiedField ? '✓ Marked as Chapter-Verified' : 'Mark as Chapter-Verified'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Verified questions appear in Student Chapter-Wise Practice Mode.
                  </Text>
                </View>
              </TouchableOpacity>

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
                    <Text style={styles.aiAssistantTitle}>
                      Interactive AI Assistant ({activeAIProvider === 'groq' ? 'Groq Free' : 'Gemini'})
                    </Text>
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

                {/* Visible Red Error Alert if AI fails */}
                {aiError && (
                  <View style={styles.aiErrorBox}>
                    <AlertCircle size={15} color="#DC2626" style={{ marginTop: 2, flexShrink: 0 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aiErrorTitle}>AI Assistant Error</Text>
                      <Text style={styles.aiErrorText}>{aiError}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setAiError(null)} style={styles.aiErrorCloseBtn}>
                      <X size={14} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                )}
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
                    placeholder="Assertion (A) statement in English and Hindi..."
                    placeholderTextColor={THEME.colors.muted}
                    multiline
                  />
                  <Text style={[styles.subLabel, { marginTop: 8 }]}>Reason (R):</Text>
                  <TextInput
                    style={[styles.textInput, styles.textareaSmall]}
                    value={reasonText}
                    onChangeText={setReasonText}
                    placeholder="Reason (R) statement in English and Hindi..."
                    placeholderTextColor={THEME.colors.muted}
                    multiline
                  />
                </View>
              )}

              {/* Statement I & II Fields */}
              {qType === 'statement_type' && (
                <View style={[styles.conditionalCard, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                  <Text style={[styles.conditionalTitle, { color: '#5B21B6' }]}>
                    Statement I &amp; Statement II (Bilingual)
                  </Text>
                  <Text style={[styles.subLabel, { color: '#4C1D95' }]}>Statement I / कथन I (English + Devanagari Hindi):</Text>
                  <TextInput
                    style={[styles.textInput, styles.textareaSmall]}
                    value={statement1}
                    onChangeText={(val) => {
                      setStatement1(val);
                      if (val || statement2) {
                        const intro =
                          'Given below are two statements: One is labelled as Statement I and the other is labelled as Statement II. / नीचे दो कथन दिए गए हैं: एक को कथन I और दूसरे को कथन II कहा गया है।';
                        const s1Text = val.trim();
                        const s2Text = statement2.trim();
                        setStem(
                          `${intro}\n\n${s1Text ? (s1Text.startsWith('Statement I') ? s1Text : `Statement I: ${s1Text}`) : ''}\n\n${s2Text ? (s2Text.startsWith('Statement II') ? s2Text : `Statement II: ${s2Text}`) : ''}`.trim()
                        );
                      }
                    }}
                    placeholder="Statement I in English and Devanagari Hindi..."
                    placeholderTextColor={THEME.colors.muted}
                    multiline
                  />
                  <Text style={[styles.subLabel, { marginTop: 8, color: '#4C1D95' }]}>
                    Statement II / कथन II (English + Devanagari Hindi):
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.textareaSmall]}
                    value={statement2}
                    onChangeText={(val) => {
                      setStatement2(val);
                      if (statement1 || val) {
                        const intro =
                          'Given below are two statements: One is labelled as Statement I and the other is labelled as Statement II. / नीचे दो कथन दिए गए हैं: एक को कथन I और दूसरे को कथन II कहा गया है।';
                        const s1Text = statement1.trim();
                        const s2Text = val.trim();
                        setStem(
                          `${intro}\n\n${s1Text ? (s1Text.startsWith('Statement I') ? s1Text : `Statement I: ${s1Text}`) : ''}\n\n${s2Text ? (s2Text.startsWith('Statement II') ? s2Text : `Statement II: ${s2Text}`) : ''}`.trim()
                        );
                      }
                    }}
                    placeholder="Statement II in English and Devanagari Hindi..."
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
        </Portal>
      )}

      {/* ============================================================== */}
      {/* 2.5 CASCADING DROPDOWNS BAR (Samhita -> Sthana -> Chapter)     */}
      {/* ============================================================== */}
      <View style={styles.dropdownBarContainer}>
        <View style={styles.dropdownBarHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <View style={styles.dropdownBarIconWrap}>
              <BookOpen size={16} color="#047857" />
            </View>
            <View>
              <Text style={styles.dropdownBarTitle}>📊 Chapter & Samhita Filter</Text>
              <Text style={styles.dropdownBarSub}>
                3-Level Cascading Dropdowns • {chapterHierarchy.length} Samhitas • {totalChaptersCount} Chapters
              </Text>
            </View>
          </View>

          {(selectedSubjectFilter || selectedSthanaFilter || selectedChapterFilter) && (
            <TouchableOpacity
              style={styles.btnResetDropdowns}
              onPress={() => {
                setSelectedSubjectFilter(null);
                setSelectedSthanaFilter(null);
                setSelectedChapterFilter(null);
                setAuditHealthFilter('all');
              }}
              activeOpacity={0.7}
            >
              <RotateCcw size={13} color="#991B1B" />
              <Text style={styles.btnResetDropdownsText}>Reset Filter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3-Level Side-by-Side Cascading Dropdown Menus */}
        <View style={styles.dropdownsGrid}>
          {/* Dropdown 1: Samhita / Subject */}
          <View style={styles.dropdownField}>
            <Text style={styles.dropdownLabel}>1. Samhita / Subject</Text>
            <View style={styles.selectWrap}>
              <select
                aria-label="Select Samhita / Subject"
                value={selectedSubjectFilter || ''}
                onChange={(e: any) => {
                  const val = e.target.value;
                  setSelectedSubjectFilter(val || null);
                  setSelectedSthanaFilter(null);
                  setSelectedChapterFilter(null);
                  setAuditHealthFilter('all');
                }}
                style={{
                  width: '100%',
                  height: 40,
                  backgroundColor: '#FFFFFF',
                  borderColor: selectedSubjectFilter ? '#047857' : '#CBD5E1',
                  borderWidth: selectedSubjectFilter ? 1.5 : 1,
                  borderRadius: 8,
                  paddingLeft: 12,
                  paddingRight: 32,
                  fontSize: 13,
                  fontWeight: selectedSubjectFilter ? '700' : '500',
                  color: selectedSubjectFilter ? '#064E3B' : '#1E293B',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                }}
              >
                <option value="">All Samhitas ({questions.length.toLocaleString()})</option>
                {chapterHierarchy.map((subj) => {
                  const label =
                    subj.name === 'General Ayurveda'
                      ? `Uncategorized (${subj.total.toLocaleString()})`
                      : `${subj.name} (${subj.total.toLocaleString()})`;
                  return (
                    <option key={subj.name} value={subj.name}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <View style={styles.dropdownChevron}>
                <ChevronDown size={15} color={selectedSubjectFilter ? '#047857' : '#64748B'} />
              </View>
            </View>
          </View>

          {/* Dropdown 2: Sthana (Section) */}
          <View style={styles.dropdownField}>
            <Text style={styles.dropdownLabel}>2. Sthana (Section)</Text>
            <View style={styles.selectWrap}>
              <select
                aria-label="Select Sthana"
                disabled={!selectedSubjectFilter}
                value={selectedSthanaFilter || ''}
                onChange={(e: any) => {
                  const val = e.target.value;
                  setSelectedSthanaFilter(val || null);
                  setSelectedChapterFilter(null);
                  setAuditHealthFilter('all');
                }}
                style={{
                  width: '100%',
                  height: 40,
                  backgroundColor: !selectedSubjectFilter ? '#F8FAFC' : '#FFFFFF',
                  borderColor: !selectedSubjectFilter
                    ? '#E2E8F0'
                    : selectedSthanaFilter
                    ? '#0284C7'
                    : '#CBD5E1',
                  borderWidth: selectedSthanaFilter ? 1.5 : 1,
                  borderRadius: 8,
                  paddingLeft: 12,
                  paddingRight: 32,
                  fontSize: 13,
                  fontWeight: selectedSthanaFilter ? '700' : '500',
                  color: !selectedSubjectFilter
                    ? '#94A3B8'
                    : selectedSthanaFilter
                    ? '#0369A1'
                    : '#1E293B',
                  cursor: !selectedSubjectFilter ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                }}
              >
                {!selectedSubjectFilter ? (
                  <option value="">Select a Samhita first...</option>
                ) : (
                  <>
                    <option value="">
                      All Sthanas ({activeSubjectObj?.total.toLocaleString() || 0})
                    </option>
                    {canonicalSchemaForSubject ? (
                      <>
                        <optgroup label={`Classical Sthanas (${canonicalSchemaForSubject.sthanas.length})`}>
                          {canonicalSthanasDisplay.map((sth) => (
                            <option key={sth.name} value={sth.name}>
                              {sth.name} ({sth.total.toLocaleString()} Qs • {sth.maxChapters} Chs)
                            </option>
                          ))}
                        </optgroup>
                        {impossibleSthanasDisplay.length > 0 && (
                          <optgroup label="⚠️ Impossible / Invalid Sthanas (Needs Auto-Remap)">
                            {impossibleSthanasDisplay.map((sth) => (
                              <option key={sth.name} value={sth.name}>
                                ⚠️ {sth.name} (Impossible for {selectedSubjectFilter} — {sth.total.toLocaleString()} Qs)
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      availableSthanas.map((sth) => (
                        <option key={sth.name} value={sth.name}>
                          {sth.name} ({sth.total.toLocaleString()})
                        </option>
                      ))
                    )}
                  </>
                )}
              </select>
              <View style={styles.dropdownChevron}>
                <ChevronDown
                  size={15}
                  color={!selectedSubjectFilter ? '#CBD5E1' : selectedSthanaFilter ? '#0284C7' : '#64748B'}
                />
              </View>
            </View>
          </View>

          {/* Dropdown 3: Chapter */}
          <View style={styles.dropdownField}>
            <Text style={styles.dropdownLabel}>3. Chapter</Text>
            <View style={styles.selectWrap}>
              <select
                aria-label="Select Chapter"
                disabled={!selectedSthanaFilter}
                value={selectedChapterFilter || ''}
                onChange={(e: any) => {
                  const val = e.target.value;
                  setSelectedChapterFilter(val || null);
                  setAuditHealthFilter('all');
                }}
                style={{
                  width: '100%',
                  height: 40,
                  backgroundColor: !selectedSthanaFilter ? '#F8FAFC' : '#FFFFFF',
                  borderColor: !selectedSthanaFilter
                    ? '#E2E8F0'
                    : selectedChapterFilter
                    ? '#D97706'
                    : '#CBD5E1',
                  borderWidth: selectedChapterFilter ? 1.5 : 1,
                  borderRadius: 8,
                  paddingLeft: 12,
                  paddingRight: 32,
                  fontSize: 13,
                  fontWeight: selectedChapterFilter ? '700' : '500',
                  color: !selectedSthanaFilter
                    ? '#94A3B8'
                    : selectedChapterFilter
                    ? '#92400E'
                    : '#1E293B',
                  cursor: !selectedSthanaFilter ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                }}
              >
                {!selectedSthanaFilter ? (
                  <option value="">Select a Sthana first...</option>
                ) : (
                  <>
                    <option value="">
                      All Chapters in {selectedSthanaFilter} ({activeSthanaObj?.total.toLocaleString() || 0})
                    </option>
                    {availableChapters.map((ch) => {
                      const chNumMatch = ch.name.match(/(\d+)/);
                      const chNum = chNumMatch ? parseInt(chNumMatch[1], 10) : 0;
                      const isImpossibleCh = activeSthanaMaxChapters !== null && chNum > activeSthanaMaxChapters;

                      let warningSuffix = '';
                      if (isImpossibleCh) {
                        warningSuffix = ` (⚠️ Exceeds max ${activeSthanaMaxChapters})`;
                      } else if (ch.malformed > 0) {
                        warningSuffix = ` (⚠️ ${ch.malformed})`;
                      }

                      return (
                        <option key={ch.name} value={ch.name}>
                          {isImpossibleCh ? '⚠️ ' : ''}{ch.name} — {ch.total.toLocaleString()} Qs{warningSuffix}
                        </option>
                      );
                    })}
                  </>
                )}
              </select>
              <View style={styles.dropdownChevron}>
                <ChevronDown
                  size={15}
                  color={!selectedSthanaFilter ? '#CBD5E1' : selectedChapterFilter ? '#D97706' : '#64748B'}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Chapter Health & Accuracy Summary Strip (when a Chapter, Sthana, or Samhita is selected) */}
        {(selectedChapterFilter || selectedSthanaFilter || selectedSubjectFilter) && (
          <View style={styles.auditSummaryStrip}>
            <View style={styles.auditScopeHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                <CheckCircle2 size={16} color="#047857" />
                <Text style={styles.auditScopeTitle}>
                  Chapter Health & Accuracy Audit:{' '}
                  <Text style={{ fontWeight: '800', color: '#064E3B' }}>
                    {[selectedSubjectFilter, selectedSthanaFilter, selectedChapterFilter].filter(Boolean).join(' › ')}
                  </Text>
                </Text>
              </View>

              <View style={styles.auditMetricsRow}>
                <View style={styles.metricBadgeTotal}>
                  <Text style={styles.metricBadgeTotalText}>
                    {scopeMetrics.total.toLocaleString()} Total
                  </Text>
                </View>
                <View style={styles.metricBadgeValid}>
                  <Check size={11} color="#15803D" />
                  <Text style={styles.metricBadgeValidText}>
                    {scopeMetrics.valid.toLocaleString()} Valid
                  </Text>
                </View>
                <View style={styles.metricBadgeVerified}>
                  <Check size={11} color="#047857" strokeWidth={2.5} />
                  <Text style={styles.metricBadgeVerifiedText}>
                    {scopeMetrics.verified.toLocaleString()} Verified
                  </Text>
                </View>
                <View
                  style={[
                    styles.metricBadgeError,
                    scopeMetrics.errors === 0 && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                  ]}
                >
                  <AlertTriangle
                    size={11}
                    color={scopeMetrics.errors > 0 ? '#C2410C' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.metricBadgeErrorText,
                      scopeMetrics.errors === 0 && { color: '#64748B' },
                    ]}
                  >
                    {scopeMetrics.errors.toLocaleString()}{' '}
                    {scopeMetrics.errors === 1 ? 'Error' : 'Errors'}
                  </Text>
                </View>

                {(selectedChapterFilter || selectedSthanaFilter) && (
                  <TouchableOpacity
                    style={styles.btnPromoteChapterVerified}
                    onPress={handleMarkEntireChapterVerified}
                    activeOpacity={0.8}
                  >
                    <CheckCircle2 size={13} color="#FFF" />
                    <Text style={styles.btnPromoteChapterVerifiedText}>
                      ✓ Mark Chapter Verified
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Quick Filter Pills Inside the Summary Strip */}
            <View style={styles.auditFilterPillsRow}>
              <Text style={styles.auditFilterLabel}>Filter View:</Text>

              <TouchableOpacity
                style={[
                  styles.auditFilterPill,
                  auditHealthFilter === 'all' && styles.auditFilterPillActiveAll,
                ]}
                onPress={() => setAuditHealthFilter('all')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.auditFilterPillText,
                    auditHealthFilter === 'all' && styles.auditFilterPillTextActive,
                  ]}
                >
                  All ({scopeMetrics.total.toLocaleString()})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.auditFilterPill,
                  auditHealthFilter === 'valid' && styles.auditFilterPillActiveValid,
                ]}
                onPress={() => setAuditHealthFilter('valid')}
                activeOpacity={0.8}
              >
                <Check
                  size={12}
                  color={auditHealthFilter === 'valid' ? '#FFF' : '#15803D'}
                />
                <Text
                  style={[
                    styles.auditFilterPillText,
                    auditHealthFilter === 'valid' && styles.auditFilterPillTextActive,
                    auditHealthFilter !== 'valid' && { color: '#15803D' },
                  ]}
                >
                  ✅ Valid Only ({scopeMetrics.valid.toLocaleString()})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.auditFilterPill,
                  auditHealthFilter === 'verified' && styles.auditFilterPillActiveVerified,
                ]}
                onPress={() => setAuditHealthFilter('verified')}
                activeOpacity={0.8}
              >
                <Check
                  size={12}
                  color={auditHealthFilter === 'verified' ? '#FFF' : '#047857'}
                />
                <Text
                  style={[
                    styles.auditFilterPillText,
                    auditHealthFilter === 'verified' && styles.auditFilterPillTextActive,
                    auditHealthFilter !== 'verified' && { color: '#047857' },
                  ]}
                >
                  ✓ Verified Only ({scopeMetrics.verified.toLocaleString()})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.auditFilterPill,
                  auditHealthFilter === 'errors' && styles.auditFilterPillActiveError,
                ]}
                onPress={() => setAuditHealthFilter('errors')}
                activeOpacity={0.8}
              >
                <AlertTriangle
                  size={12}
                  color={
                    auditHealthFilter === 'errors'
                      ? '#FFF'
                      : scopeMetrics.errors > 0
                      ? '#C2410C'
                      : '#64748B'
                  }
                />
                <Text
                  style={[
                    styles.auditFilterPillText,
                    auditHealthFilter === 'errors' && styles.auditFilterPillTextActive,
                    auditHealthFilter !== 'errors' && {
                      color: scopeMetrics.errors > 0 ? '#C2410C' : '#64748B',
                    },
                  ]}
                >
                  ⚠️ Errors Only ({scopeMetrics.errors.toLocaleString()})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

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

          {/* Active Cascading Filter Bar */}
          {(selectedSubjectFilter || selectedSthanaFilter || selectedChapterFilter) && (
            <View style={styles.activeChapterFilterBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                <BookOpen size={14} color="#047857" />
                <Text style={styles.activeChapterFilterText}>
                  Active Filter:{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {[selectedSubjectFilter, selectedSthanaFilter, selectedChapterFilter].filter(Boolean).join(' › ')}
                  </Text>{' '}
                  ({filteredQuestions.length.toLocaleString()} matching)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.btnClearChapterFilter}
                onPress={handleResetCascadingFilter}
              >
                <X size={13} color="#991B1B" />
                <Text style={styles.btnClearChapterFilterText}>Reset Filter</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Type Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillScroll}>
            {[
              { id: 'all', label: `All (${questions.length})` },
              { id: 'standard', label: `Standard (${typeCounts.standard})` },
              { id: 'assertion_reason', label: `Assertion / Reason (${typeCounts.assertion_reason})` },
              { id: 'match_the_pair', label: `Match Pair (${typeCounts.match_the_pair})` },
              { id: 'statement_type', label: `Statement (${typeCounts.statement_type})` },
              ...(verifiedCount > 0
                ? [
                    {
                      id: 'chapter_verified',
                      label: `✓ Verified (${verifiedCount})`,
                      isVerifiedPill: true,
                    },
                  ]
                : []),
              ...(mismatchQuestions.length > 0
                ? [
                    {
                      id: 'citation_mismatch',
                      label: `⚠️ Citation Mismatch (${mismatchQuestions.length})`,
                      isMismatchPill: true,
                    },
                  ]
                : []),
              ...(brokenQuestions.length > 0
                ? [
                    {
                      id: 'broken_shifted',
                      label: `⚠️ Shifted Rows (${brokenQuestions.length})`,
                      isBrokenPill: true,
                    },
                  ]
                : []),
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterChip,
                  selectedTypeFilter === f.id && styles.filterChipActive,
                  (f as any).isVerifiedPill && styles.filterChipVerified,
                  (f as any).isVerifiedPill && selectedTypeFilter === f.id && styles.filterChipVerifiedActive,
                  (f as any).isMismatchPill && styles.filterChipMismatch,
                  (f as any).isMismatchPill && selectedTypeFilter === f.id && styles.filterChipMismatchActive,
                  (f as any).isBrokenPill && styles.filterChipBroken,
                  (f as any).isBrokenPill && selectedTypeFilter === f.id && styles.filterChipBrokenActive,
                ]}
                onPress={() => setSelectedTypeFilter(f.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedTypeFilter === f.id && styles.filterChipTextActive,
                    (f as any).isVerifiedPill && styles.filterChipVerifiedText,
                    (f as any).isVerifiedPill && selectedTypeFilter === f.id && styles.filterChipVerifiedTextActive,
                    (f as any).isMismatchPill && styles.filterChipMismatchText,
                    (f as any).isMismatchPill && selectedTypeFilter === f.id && styles.filterChipMismatchTextActive,
                    (f as any).isBrokenPill && styles.filterChipBrokenText,
                    (f as any).isBrokenPill && selectedTypeFilter === f.id && styles.filterChipBrokenTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Samhita / Citation Mismatch Alert & Action Bar */}
        {mismatchQuestions.length > 0 && (
          <View style={styles.mismatchBannerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 }}>
              <View style={styles.mismatchBannerIconWrap}>
                <AlertTriangle size={18} color="#C2410C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mismatchBannerTitle}>
                  ⚠️ Detected {mismatchQuestions.length} Samhita / Citation Mismatch(es)
                </Text>
                <Text style={styles.mismatchBannerText}>
                  Questions where the citation (e.g. su.su / Sushruta) conflicts with the tagged or worded Samhita (e.g. Charaka), or chapter numbers exceed classical limits.
                </Text>
              </View>
            </View>

            <View style={styles.mismatchBannerActions}>
              <TouchableOpacity
                style={[
                  styles.btnViewMismatch,
                  selectedTypeFilter === 'citation_mismatch' && styles.btnViewMismatchActive,
                ]}
                onPress={() =>
                  setSelectedTypeFilter(selectedTypeFilter === 'citation_mismatch' ? 'all' : 'citation_mismatch')
                }
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.btnViewMismatchText,
                    selectedTypeFilter === 'citation_mismatch' && styles.btnViewMismatchTextActive,
                  ]}
                >
                  {selectedTypeFilter === 'citation_mismatch' ? 'Show All Questions' : 'View Mismatches'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnAutoFixFromBanner}
                onPress={handleOpenAutoFixModal}
                activeOpacity={0.8}
              >
                <RefreshCw size={13} color="#FFF" />
                <Text style={styles.btnAutoFixFromBannerText}>
                  Auto-Fix Chapter Tags
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Broken / Shifted Rows Alert & Cleanup Bar */}
        {brokenQuestions.length > 0 && (
          <View style={styles.brokenBannerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 }}>
              <View style={styles.brokenBannerIconWrap}>
                <AlertTriangle size={18} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.brokenBannerTitle}>
                  ⚠️ Detected {brokenQuestions.length} Shifted / Broken Question(s)
                </Text>
                <Text style={styles.brokenBannerText}>
                  These questions have numeric serial numbers (e.g. 420, 430) stored as the question text while Option A contains the question stem. You can delete them in one click and re-run Google Drive Sync.
                </Text>
              </View>
            </View>

            <View style={styles.brokenBannerActions}>
              <TouchableOpacity
                style={[
                  styles.btnViewBroken,
                  selectedTypeFilter === 'broken_shifted' && styles.btnViewBrokenActive,
                ]}
                onPress={() =>
                  setSelectedTypeFilter(selectedTypeFilter === 'broken_shifted' ? 'all' : 'broken_shifted')
                }
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.btnViewBrokenText,
                    selectedTypeFilter === 'broken_shifted' && styles.btnViewBrokenTextActive,
                  ]}
                >
                  {selectedTypeFilter === 'broken_shifted' ? 'Show All Questions' : 'View Flagged Rows'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnRepairBroken, isRepairingBroken && { opacity: 0.7 }]}
                onPress={handleAutoRepairBrokenRows}
                disabled={isRepairingBroken || isDeletingBroken}
                activeOpacity={0.8}
              >
                {isRepairingBroken ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Wrench size={13} color="#FFF" />
                    <Text style={styles.btnRepairBrokenText}>
                      Auto-Repair Shifted ({brokenQuestions.length})
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnDeleteBroken, isDeletingBroken && { opacity: 0.7 }]}
                onPress={handleDeleteAllBrokenRows}
                disabled={isDeletingBroken || isRepairingBroken}
                activeOpacity={0.8}
              >
                {isDeletingBroken ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Trash2 size={13} color="#FFF" />
                    <Text style={styles.btnDeleteBrokenText}>
                      Delete Flagged Broken Rows ({brokenQuestions.length})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Multi-Select Floating / Sticky Action Bar */}
        {selectedQuestionIds.size > 0 && (
          <View style={styles.multiSelectBar}>
            <View style={styles.multiSelectInfo}>
              <CheckCircle2 size={16} color="#047857" />
              <Text style={styles.multiSelectText}>
                {selectedQuestionIds.size} Question{selectedQuestionIds.size > 1 ? 's' : ''} Selected
              </Text>
            </View>

            <View style={styles.multiSelectActions}>
              <TouchableOpacity
                style={[styles.btnMultiSelectAction, isBatchUpdatingVerification && { opacity: 0.7 }]}
                onPress={() => handleBatchSetVerified(true)}
                disabled={isBatchUpdatingVerification}
                activeOpacity={0.8}
              >
                {isBatchUpdatingVerification ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Check size={12} color="#FFF" strokeWidth={2.5} />
                    <Text style={styles.btnMultiSelectActionText}>Mark Selected as Chapter-Verified</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnMultiSelectUnverify, isBatchUpdatingVerification && { opacity: 0.7 }]}
                onPress={() => handleBatchSetVerified(false)}
                disabled={isBatchUpdatingVerification}
                activeOpacity={0.8}
              >
                <X size={12} color="#475569" strokeWidth={2} />
                <Text style={styles.btnMultiSelectUnverifyText}>Unmark Verified</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnMultiSelectClear}
                onPress={handleDeselectAll}
                activeOpacity={0.8}
              >
                <Text style={styles.btnMultiSelectClearText}>Deselect All</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Counter Header with Jump-to-Question and Edited Counter */}
        <View style={styles.tableHeader}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.tableTitle}>
                Cloud Question Bank ({filteredQuestions.length} matching)
              </Text>
              {filteredQuestions.length > 0 && (
                <TouchableOpacity
                  style={styles.btnSelectAllVisible}
                  onPress={handleSelectAllFiltered}
                  activeOpacity={0.8}
                >
                  <CheckSquare size={13} color="#047857" />
                  <Text style={styles.btnSelectAllVisibleText}>
                    {selectedQuestionIds.size > 0 && selectedQuestionIds.size >= displayedQuestions.length
                      ? 'Deselect Visible'
                      : `Select Visible (${Math.min(visibleCount, filteredQuestions.length)})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
              const isBroken = isBrokenShiftedQuestion(q);
              const mismatch = detectSamhitaMismatch(q);
              const audit = getQuestionAuditStatus(q);

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
                  style={[
                    styles.questionCard,
                    !audit.isValid && styles.questionCardIssue,
                    isBroken && styles.questionCardBroken,
                    mismatch.hasMismatch && styles.questionCardMismatch,
                  ]}
                >
                  {/* Top Badges & Action Buttons */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.badgeWrapper}>
                      {/* Multi-Select Checkbox */}
                      <TouchableOpacity
                        style={[
                          styles.cardSelectCheckbox,
                          selectedQuestionIds.has(String(q.id)) && styles.cardSelectCheckboxActive,
                        ]}
                        onPress={() => toggleSelectQuestion(q.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        activeOpacity={0.8}
                      >
                        {selectedQuestionIds.has(String(q.id)) && (
                          <Check size={10} color="#FFF" strokeWidth={3} />
                        )}
                      </TouchableOpacity>

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

                      {/* Chapter-Verified Badge (Quick 1-click toggle) */}
                      {isQuestionChapterVerified(q) ? (
                        <TouchableOpacity
                          style={styles.badgeVerified}
                          onPress={() => handleQuickToggleVerify(q)}
                          activeOpacity={0.8}
                          title="Click to toggle verification status"
                        >
                          <Check size={10} color="#047857" strokeWidth={2.5} />
                          <Text style={styles.badgeVerifiedText}>✓ Chapter-Verified</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.badgeUnverifiedBtn}
                          onPress={() => handleQuickToggleVerify(q)}
                          activeOpacity={0.8}
                          title="Click to mark as Chapter-Verified"
                        >
                          <Text style={styles.badgeUnverifiedBtnText}>+ Verify</Text>
                        </TouchableOpacity>
                      )}

                      {/* Chapter Health & Accuracy Status Badge */}
                      {audit.isValid ? (
                        <View style={styles.badgeAuditValid}>
                          <Check size={11} color="#15803D" />
                          <Text style={styles.badgeAuditValidText}>✓ Valid</Text>
                        </View>
                      ) : (
                        <View style={styles.badgeAuditIssue}>
                          <AlertTriangle size={11} color="#C2410C" />
                          <Text style={styles.badgeAuditIssueText}>⚠️ Issue: {audit.issueReason}</Text>
                        </View>
                      )}

                      {/* Samhita / Citation Mismatch Badge */}
                      {mismatch.hasMismatch && (
                        <View style={styles.badgeMismatchError}>
                          <AlertTriangle size={11} color="#C2410C" />
                          <Text style={styles.badgeMismatchErrorText}>{mismatch.badgeLabel}</Text>
                        </View>
                      )}

                      {/* Shifted / Broken Badge */}
                      {isBroken && (
                        <View style={styles.badgeShiftedError}>
                          <AlertTriangle size={11} color="#DC2626" />
                          <Text style={styles.badgeShiftedErrorText}>Shifted Row (Numeric Stem)</Text>
                        </View>
                      )}

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

                  {/* Samhita / Citation Mismatch Alert Banner with 1-click Auto-Fix */}
                  {mismatch.hasMismatch && (
                    <View style={styles.cardMismatchAlert}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, flex: 1, minWidth: 220 }}>
                        <AlertTriangle size={13} color="#C2410C" style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardMismatchAlertTitle}>
                            {mismatch.badgeLabel}
                          </Text>
                          <Text style={styles.cardMismatchAlertText}>
                            {mismatch.detailedMessage}
                          </Text>
                        </View>
                      </View>
                      {(() => {
                        const currentTag = String(q.chapterName || q.ch || '').trim();
                        const hasValidAutoFix = Boolean(
                          mismatch.suggestedTag &&
                          mismatch.suggestedTag !== currentTag &&
                          isValidClassicalTag(mismatch.suggestedTag)
                        );

                        if (hasValidAutoFix) {
                          return (
                            <TouchableOpacity
                              style={styles.btnCardQuickFixTag}
                              onPress={async () => {
                                try {
                                  await backend.updateQuestion(q.id, {
                                    chapterName: mismatch.suggestedTag!,
                                    ch: mismatch.suggestedTag!,
                                  });
                                  setQuestions((prev) =>
                                    prev.map((item) =>
                                      item.id === q.id
                                        ? { ...item, chapterName: mismatch.suggestedTag!, ch: mismatch.suggestedTag! }
                                        : item
                                    )
                                  );
                                  setEditedIds((prev) => new Set(prev).add(String(q.id)));
                                  showToast(`Auto-fixed chapter tag to "${mismatch.suggestedTag}"`);
                                } catch (err: any) {
                                  console.error('Failed to quick-fix chapter tag:', err);
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <Sparkles size={11} color="#FFF" />
                              <Text style={styles.btnCardQuickFixTagText}>
                                Fix Tag to: {mismatch.suggestedTag}
                              </Text>
                            </TouchableOpacity>
                          );
                        }

                        return (
                          <TouchableOpacity
                            style={styles.btnCardEditManually}
                            onPress={() => {
                              setEditingQuestion(q);
                              setQType(q.questionType || 'standard');
                              setChapterName(q.chapterName || String(q.ch) || 'Uncategorized / Needs Review > General > Chapter 1');
                              setRefSource(q.r || '');
                              setDifficulty(q.d || 1);
                              setStem(q.stem || '');
                              setOptions(q.o || ['', '', '', '']);
                              setCorrectAnswer(typeof q.c === 'number' ? q.c : 0);
                              setExplanation(q.explanation || '');
                              setIsAddFormOpen(true);
                            }}
                            activeOpacity={0.8}
                          >
                            <Edit3 size={11} color="#FFF" />
                            <Text style={styles.btnCardEditManuallyText}>Edit Manually</Text>
                          </TouchableOpacity>
                        );
                      })()}
                    </View>
                  )}

                  {/* Shifted warning alert banner on card */}
                  {isBroken && (
                    <View style={styles.cardShiftedAlert}>
                      <AlertTriangle size={13} color="#DC2626" />
                      <Text style={styles.cardShiftedAlertText}>
                        Shifted column detected: Stem is a serial number and Option A contains question text. Delete this row and re-run Google Drive Sync to re-import cleanly.
                      </Text>
                    </View>
                  )}

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

                  {/* Statement Type Details */}
                  {q.questionType === 'statement_type' && (q.statement1 || q.statement2) && (
                    <View style={[styles.arBox, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                      {q.statement1 ? (
                        <Text style={styles.arItem}>
                          <Text style={{ fontWeight: '700', color: '#5B21B6' }}>Statement I: </Text>
                          {q.statement1.replace(/^Statement I:\s*/i, '')}
                        </Text>
                      ) : null}
                      {q.statement2 ? (
                        <Text style={[styles.arItem, { marginTop: 4 }]}>
                          <Text style={{ fontWeight: '700', color: '#5B21B6' }}>Statement II: </Text>
                          {q.statement2.replace(/^Statement II:\s*/i, '')}
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
        onClose={() => {
          setInternalAISettingsOpen(false);
          refreshAIProvider();
        }}
        onKeySaved={refreshAIProvider}
      />

      <GoogleSheetSyncModal
        isOpen={isGoogleSheetModalOpen}
        onClose={() => setIsGoogleSheetModalOpen(false)}
        onImportSuccess={handleGoogleSheetImportSuccess}
        existingQuestions={questions}
      />

      <GoogleDriveSyncModal
        isOpen={isGoogleDriveModalOpen}
        onClose={() => setIsGoogleDriveModalOpen(false)}
        onImportSuccess={handleGoogleDriveImportSuccess}
        existingQuestions={questions}
      />

      {/* Auto-Fix Chapter Tags from Citations Modal */}
      {isAutoFixModalOpen && (
        <Portal>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalDialog, { maxWidth: 760 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <RefreshCw size={20} color="#4338CA" />
                  <View>
                    <Text style={styles.modalTitle}>Smart Citation Auto-Mapper</Text>
                    <Text style={styles.modalSub}>
                      Automatically detect Subject, Sthana &amp; Chapter from citations and shloka references
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setIsAutoFixModalOpen(false)}>
                  <X size={20} color={THEME.colors.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Live Status Strip */}
                {(remapCandidates.length > 0 || manualReviewCandidates.length > 0) && (
                  <View style={styles.modalStatusStrip}>
                    <View style={styles.statusBadgeGreen}>
                      <CheckCircle2 size={13} color="#15803D" />
                      <Text style={styles.statusBadgeGreenText}>
                        Auto-fixable: {remapCandidates.length}
                      </Text>
                    </View>
                    <View style={[styles.statusBadgeAmber, manualReviewCandidates.length === 0 && { opacity: 0.6 }]}>
                      <AlertTriangle size={13} color="#D97706" />
                      <Text style={styles.statusBadgeAmberText}>
                        Needs Manual Review: {manualReviewCandidates.length}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Case 1: Truly all questions are clean */}
                {remapCandidates.length === 0 && manualReviewCandidates.length === 0 ? (
                  <View style={styles.remapEmptyState}>
                    <CheckCircle2 size={40} color="#059669" />
                    <Text style={styles.remapEmptyTitle}>All Questions Already Tagged Accurately!</Text>
                    <Text style={styles.remapEmptyText}>
                      Every question in Cloud DB has a valid classical chapter tag that matches its textual citations.
                    </Text>
                  </View>
                ) : remapCandidates.length === 0 && manualReviewCandidates.length > 0 ? (
                  /* Case 2: Only manual reviews exist (none auto-fixable) */
                  <View>
                    <View style={styles.remapManualNoticeBox}>
                      <AlertTriangle size={32} color="#D97706" />
                      <Text style={styles.remapManualTitle}>
                        {manualReviewCandidates.length} Question(s) Need Manual Review
                      </Text>
                      <Text style={styles.remapManualDesc}>
                        These questions have Samhita or chapter mismatches, but their textual citations cannot be safely auto-mapped with 100% certainty. Please review or edit them manually using the cards below.
                      </Text>
                    </View>

                    <View style={styles.remapPreviewList}>
                      {manualReviewCandidates.slice(0, 50).map((c, idx) => (
                        <View key={idx} style={styles.remapItemCard}>
                          <View style={styles.remapItemHeader}>
                            <Text style={styles.remapStem} numberOfLines={2}>
                              #{questions.findIndex((q) => q.id === c.question.id) + 1}. {c.question.stem}
                            </Text>
                            <TouchableOpacity
                              style={styles.btnCardEditManually}
                              onPress={() => {
                                setIsAutoFixModalOpen(false);
                                setEditingQuestion(c.question);
                                setQType(c.question.questionType || 'standard');
                                setChapterName(c.question.chapterName || String(c.question.ch) || 'Uncategorized / Needs Review > General > Chapter 1');
                                setRefSource(c.question.r || '');
                                setDifficulty(c.question.d || 1);
                                setStem(c.question.stem || '');
                                setOptions(c.question.o || ['', '', '', '']);
                                setCorrectAnswer(typeof c.question.c === 'number' ? c.question.c : 0);
                                setExplanation(c.question.explanation || '');
                                setIsAddFormOpen(true);
                              }}
                            >
                              <Edit3 size={11} color="#FFF" />
                              <Text style={styles.btnCardEditManuallyText}>Edit</Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.remapCitationText} numberOfLines={1}>
                            <Text style={{ fontWeight: '700' }}>Citation: </Text>
                            {c.question.r || c.question.explanation || '—'}
                          </Text>
                          <View style={{ marginTop: 6 }}>
                            <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '600' }}>
                              {c.mismatch.badgeLabel}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                              Current Tag: {c.question.chapterName || c.question.ch}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  /* Case 3: Auto-fixable candidates exist */
                  <View>
                    <View style={styles.remapSummaryBox}>
                      <Text style={styles.remapSummaryTitle}>
                        Found {remapCandidates.length} Question(s) with Auto-Fixable Chapter Tags
                      </Text>
                      <Text style={styles.remapSummaryDesc}>
                        These questions have classical textual citations pointing to a specific Samhita, Sthana &amp; Chapter.
                        Review the preview below and click &quot;Confirm &amp; Apply Auto-Remap&quot; to update them in bulk.
                      </Text>
                    </View>

                    <View style={styles.remapPreviewList}>
                      {remapCandidates.slice(0, 50).map((c, idx) => (
                        <View key={idx} style={styles.remapItemCard}>
                          <View style={styles.remapItemHeader}>
                            <Text style={styles.remapStem} numberOfLines={2}>
                              #{questions.findIndex((q) => q.id === c.question.id) + 1}. {c.question.stem}
                            </Text>
                          </View>
                          <Text style={styles.remapCitationText} numberOfLines={1}>
                            <Text style={{ fontWeight: '700' }}>Citation: </Text>
                            {c.question.r || c.question.explanation || '—'}
                          </Text>
                          <View style={styles.remapTagsRow}>
                            <View style={styles.tagOld}>
                              <Text style={styles.tagOldText} numberOfLines={1}>
                                {c.remapInfo.currentTag}
                              </Text>
                            </View>
                            <ArrowRight size={14} color={THEME.colors.muted} />
                            <View style={styles.tagNew}>
                              <Text style={styles.tagNewText} numberOfLines={1}>
                                {c.remapInfo.suggestedTag}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                      {remapCandidates.length > 50 && (
                        <Text style={styles.remapMoreNotice}>
                          + {remapCandidates.length - 50} more questions will also be updated in bulk
                        </Text>
                      )}
                    </View>

                    {manualReviewCandidates.length > 0 && (
                      <View style={{ marginTop: 20 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 8 }}>
                          ⚠️ {manualReviewCandidates.length} Additional Question(s) Require Manual Review:
                        </Text>
                        <View style={styles.remapPreviewList}>
                          {manualReviewCandidates.slice(0, 10).map((c, idx) => (
                            <View key={idx} style={[styles.remapItemCard, { borderColor: '#FDE68A', backgroundColor: '#FFFDF5' }]}>
                              <View style={styles.remapItemHeader}>
                                <Text style={styles.remapStem} numberOfLines={2}>
                                  #{questions.findIndex((q) => q.id === c.question.id) + 1}. {c.question.stem}
                                </Text>
                                <TouchableOpacity
                                  style={styles.btnCardEditManually}
                                  onPress={() => {
                                    setIsAutoFixModalOpen(false);
                                    setEditingQuestion(c.question);
                                    setQType(c.question.questionType || 'standard');
                                    setChapterName(c.question.chapterName || String(c.question.ch) || 'Uncategorized / Needs Review > General > Chapter 1');
                                    setRefSource(c.question.r || '');
                                    setDifficulty(c.question.d || 1);
                                    setStem(c.question.stem || '');
                                    setOptions(c.question.o || ['', '', '', '']);
                                    setCorrectAnswer(typeof c.question.c === 'number' ? c.question.c : 0);
                                    setExplanation(c.question.explanation || '');
                                    setIsAddFormOpen(true);
                                  }}
                                >
                                  <Edit3 size={11} color="#FFF" />
                                  <Text style={styles.btnCardEditManuallyText}>Edit</Text>
                                </TouchableOpacity>
                              </View>
                              <Text style={{ fontSize: 11, color: '#C2410C', fontWeight: '600', marginTop: 4 }}>
                                {c.mismatch.badgeLabel}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={() => setIsAutoFixModalOpen(false)}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>

                {remapCandidates.length > 0 && (
                  <TouchableOpacity
                    style={[styles.btnConfirmRemap, isApplyingRemap && { opacity: 0.6 }]}
                    onPress={handleApplyAutoRemap}
                    disabled={isApplyingRemap}
                  >
                    {isApplyingRemap ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <RefreshCw size={15} color="#FFF" />
                    )}
                    <Text style={styles.btnConfirmRemapText}>
                      {isApplyingRemap
                        ? 'Applying...'
                        : `Confirm & Apply Auto-Remap (${remapCandidates.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Portal>
      )}
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
  btnGoogleSheet: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnGoogleSheetText: {
    color: '#047857',
    fontWeight: '700',
    fontSize: 13,
  },
  btnGoogleDrive: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnGoogleDriveText: {
    color: '#1D4ED8',
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
    flex: 1,
    maxHeight: 'calc(90vh - 130px)' as any,
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
  aiErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  aiErrorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  aiErrorText: {
    fontSize: 11,
    color: '#B91C1C',
    lineHeight: 15,
  },
  aiErrorCloseBtn: {
    padding: 2,
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
  filterChipMismatch: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  filterChipMismatchActive: {
    backgroundColor: '#EA580C',
    borderColor: '#C2410C',
  },
  filterChipMismatchText: {
    color: '#EA580C',
    fontWeight: '700',
  },
  filterChipMismatchTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  filterChipBroken: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  filterChipBrokenActive: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  filterChipBrokenText: {
    color: '#DC2626',
    fontWeight: '700',
  },
  filterChipBrokenTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  brokenBannerCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  brokenBannerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brokenBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  brokenBannerText: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 15,
  },
  brokenBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  btnViewBroken: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  btnViewBrokenActive: {
    backgroundColor: '#991B1B',
    borderColor: '#991B1B',
  },
  btnViewBrokenText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
  },
  btnViewBrokenTextActive: {
    color: '#FFF',
  },
  btnDeleteBroken: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnDeleteBrokenText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  btnRepairBroken: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnRepairBrokenText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  questionCardBroken: {
    borderColor: '#F87171',
    borderWidth: 1.5,
    backgroundColor: '#FFFDFD',
  },
  badgeShiftedError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeShiftedErrorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  cardShiftedAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 8,
  },
  cardShiftedAlertText: {
    fontSize: 11,
    color: '#B91C1C',
    flex: 1,
    lineHeight: 15,
  },
  mismatchBannerCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  mismatchBannerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mismatchBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9A3412',
  },
  mismatchBannerText: {
    fontSize: 11,
    color: '#C2410C',
    marginTop: 2,
    lineHeight: 15,
  },
  mismatchBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  btnViewMismatch: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  btnViewMismatchActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  btnViewMismatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C2410C',
  },
  btnViewMismatchTextActive: {
    color: '#FFF',
  },
  btnAutoFixFromBanner: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#EA580C',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnAutoFixFromBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  questionCardMismatch: {
    borderColor: '#FB923C',
    borderWidth: 1.5,
    backgroundColor: '#FFFAF5',
  },
  badgeMismatchError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '100%',
    flexShrink: 1,
  },
  badgeMismatchErrorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C2410C',
  },
  cardMismatchAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  cardMismatchAlertTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9A3412',
  },
  cardMismatchAlertText: {
    fontSize: 11,
    color: '#C2410C',
    marginTop: 2,
    lineHeight: 15,
  },
  btnCardQuickFixTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EA580C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  btnCardQuickFixTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  btnCardEditManually: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#475569',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  btnCardEditManuallyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  modalStatusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  statusBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusBadgeGreenText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusBadgeAmberText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  remapManualNoticeBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  remapManualTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 8,
  },
  remapManualDesc: {
    fontSize: 12,
    color: '#B45309',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  btnAutoFixChapters: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnAutoFixChaptersText: {
    color: '#4338CA',
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownBarContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dropdownBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 8,
  },
  dropdownBarIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownBarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  dropdownBarSub: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
  btnResetDropdowns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnResetDropdownsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  dropdownsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  dropdownField: {
    flex: 1,
    minWidth: 180,
    gap: 4,
  },
  dropdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  selectWrap: {
    position: 'relative',
    width: '100%',
  },
  dropdownChevron: {
    position: 'absolute',
    right: 10,
    top: 12,
    pointerEvents: 'none' as any,
  },
  auditSummaryStrip: {
    backgroundColor: '#F0FDF4',
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
    padding: 12,
    gap: 10,
  },
  auditScopeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  auditScopeTitle: {
    fontSize: 12,
    color: '#065F46',
  },
  auditMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metricBadgeTotal: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  metricBadgeTotalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  metricBadgeValid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  metricBadgeValidText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  metricBadgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  metricBadgeErrorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  auditFilterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  auditFilterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  auditFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  auditFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  auditFilterPillActiveAll: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  auditFilterPillActiveValid: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  auditFilterPillActiveError: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  auditFilterPillTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  badgeAuditValid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeAuditValidText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  badgeAuditIssue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 280,
  },
  badgeAuditIssueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C2410C',
  },
  questionCardIssue: {
    borderColor: '#FDBA74',
    borderWidth: 1.5,
    backgroundColor: '#FFFDFB',
  },
  activeChapterFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  activeChapterFilterText: {
    fontSize: 12,
    color: '#065F46',
  },
  btnClearChapterFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  btnClearChapterFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  remapEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    gap: 10,
  },
  remapEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
  },
  remapEmptyText: {
    fontSize: 12,
    color: THEME.colors.muted,
    textAlign: 'center',
  },
  remapSummaryBox: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  remapSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3730A3',
  },
  remapSummaryDesc: {
    fontSize: 11,
    color: '#4F46E5',
    lineHeight: 16,
  },
  remapPreviewList: {
    gap: 8,
  },
  remapItemCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  remapItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  remapStem: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.ink,
    lineHeight: 16,
  },
  remapCitationText: {
    fontSize: 11,
    color: '#475569',
  },
  remapTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  tagOld: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagOldText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#991B1B',
  },
  tagNew: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagNewText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  remapMoreNotice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 6,
  },
  btnConfirmRemap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4338CA',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  btnConfirmRemapText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  metricBadgeVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  metricBadgeVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  btnPromoteChapterVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  btnPromoteChapterVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  auditFilterPillActiveVerified: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterChipVerified: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  filterChipVerifiedActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterChipVerifiedText: {
    color: '#047857',
  },
  filterChipVerifiedTextActive: {
    color: '#FFF',
  },
  multiSelectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  multiSelectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  multiSelectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  multiSelectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  btnMultiSelectAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnMultiSelectActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  btnMultiSelectUnverify: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnMultiSelectUnverifyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  btnMultiSelectClear: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  btnMultiSelectClearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  btnSelectAllVisible: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnSelectAllVisibleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  cardSelectCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    marginRight: 2,
  },
  cardSelectCheckboxActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  badgeVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeVerifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  badgeUnverifiedBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeUnverifiedBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  uploadTargetCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  uploadTargetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  uploadTargetSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  uploadSelectorsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  uploadSelectCol: {
    flex: 1,
    minWidth: 140,
  },
  uploadSelectLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  uploadVerifyToggleRow: {
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
  uploadVerifyToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  uploadVerifyToggleSub: {
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
  uploadStep2Title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  sampleVerifiedBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  uploadSourceTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
    flexWrap: 'wrap',
  },
  uploadSourceTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  uploadSourceTabActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  uploadSourceTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  uploadSourceTabTextActive: {
    color: '#047857',
    fontWeight: '700',
  },
  uploadLinkCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
  },
  uploadLinkLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  uploadLinkInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  uploadLinkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadLinkInput: {
    flex: 1,
    minWidth: 220,
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  btnFetchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#047857',
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  btnFetchLinkDisabled: {
    opacity: 0.6,
  },
  btnFetchLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  uploadLinkHelper: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  uploadLinkErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  uploadLinkErrorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  uploadLinkErrorText: {
    fontSize: 11,
    color: '#B91C1C',
    lineHeight: 16,
  },
});
