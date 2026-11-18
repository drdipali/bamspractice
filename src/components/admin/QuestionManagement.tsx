import React, { useState, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Filter,
  X,
  Layers,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ArrowRight,
  RefreshCw,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Question, QuestionType, MatchPair, Difficulty } from '../../types';
import { backend } from '../../services/backend';
import { parseQuestionsCsv, generateSampleCsv } from '../../utils/csvParser';
import { useApp } from '../../context/AppContext';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  standard: 'Standard MCQ',
  assertion_reason: 'Assertion / Reason',
  match_the_pair: 'Match the Pair',
  statement_type: 'Statement Type',
};

const STANDARD_AR_OPTIONS = [
  'Both (A) and (R) are true and (R) is the correct explanation of (A)',
  'Both (A) and (R) are true but (R) is NOT the correct explanation of (A)',
  '(A) is true but (R) is false',
  '(A) is false but (R) is true',
];

const STANDARD_STATEMENT_OPTIONS = [
  'Both Statement I and Statement II are correct',
  'Both Statement I and Statement II are incorrect',
  'Statement I is correct but Statement II is incorrect',
  'Statement I is incorrect but Statement II is correct',
];

export const QuestionManagement: React.FC = () => {
  const { refreshQuestions } = useApp() as any;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedChapterFilter, setSelectedChapterFilter] = useState<string>('all');

  // UI state for modals / panels
  const [isAddFormOpen, setIsAddFormOpen] = useState<boolean>(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Form State
  const [qType, setQType] = useState<QuestionType>('standard');
  const [chapterName, setChapterName] = useState<string>('Charaka Samhita > Sutrasthana > Chapter 1');
  const [refSource, setRefSource] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>(0);
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
    { left: 'A. Charaka Samhita', right: 'I. Agnivesha Tantra' },
    { left: 'B. Sushruta Samhita', right: 'II. Vriddha Sushruta' },
    { left: 'C. Ashtanga Hridaya', right: 'III. Vagbhata' },
    { left: 'D. Madhava Nidana', right: 'IV. Madhavakara' },
  ]);

  // CSV Bulk Upload State
  const [csvInput, setCsvInput] = useState<string>('');
  const [csvValidationResult, setCsvValidationResult] = useState<any>(null);
  const [isUploadingCsv, setIsUploadingCsv] = useState<boolean>(false);

  const loadCloudQuestions = async () => {
    setLoading(true);
    try {
      const data = await backend.getQuestions();
      setQuestions(data);
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

  // Pre-fill options when question type changes
  const handleTypeChange = (type: QuestionType) => {
    setQType(type);
    if (type === 'assertion_reason') {
      setOptions([...STANDARD_AR_OPTIONS]);
      if (!stem) setStem('Assertion (A) & Reason (R): In light of the statements, select the correct option.');
    } else if (type === 'statement_type') {
      setOptions([...STANDARD_STATEMENT_OPTIONS]);
      if (!stem) setStem('Statement Type: Consider the statements regarding Ayurvedic principles and choose the correct code:');
    } else if (type === 'match_the_pair') {
      setOptions([
        'A-I, B-II, C-III, D-IV',
        'A-II, B-I, C-IV, D-III',
        'A-III, B-IV, C-I, D-II',
        'A-IV, B-III, C-II, D-I',
      ]);
      if (!stem) setStem('Match List-I with List-II and select the correct option using the codes below:');
    } else {
      setOptions(['', '', '', '']);
    }
  };

  const handleResetForm = () => {
    setQType('standard');
    setStem('');
    setOptions(['', '', '', '']);
    setCorrectAnswer(0);
    setExplanation('');
    setRefSource('');
    setAssertionText('');
    setReasonText('');
    setStatement1('');
    setStatement2('');
    setMatchPairs([
      { left: '', right: '' },
      { left: '', right: '' },
      { left: '', right: '' },
      { left: '', right: '' },
    ]);
  };

  // Submit manual question
  const handleSaveQuestion = async () => {
    if (!chapterName.trim()) {
      alert('Please specify the Chapter Mapping (e.g. Charaka Samhita > Sutrasthana > Chapter 1).');
      return;
    }
    if (!stem.trim()) {
      alert('Please enter the Question Stem / Prompt.');
      return;
    }

    if (qType === 'assertion_reason') {
      if (!assertionText.trim() || !reasonText.trim()) {
        alert('Please provide both Assertion (A) and Reason (R).');
        return;
      }
    }

    if (qType === 'statement_type') {
      if (!statement1.trim() || !statement2.trim()) {
        alert('Please provide both Statement I and Statement II.');
        return;
      }
    }

    if (qType === 'match_the_pair') {
      const validPairs = matchPairs.filter((p) => p.left.trim() && p.right.trim());
      if (validPairs.length < 2) {
        alert('Please fill at least 2 pairs for Match the Pair.');
        return;
      }
    }

    if (options.some((o) => !o.trim())) {
      alert('Please fill all 4 options (A, B, C, D).');
      return;
    }

    setSubmitting(true);
    try {
      const questionData: Omit<Question, 'id'> = {
        ch: chapterName.trim(),
        chapterName: chapterName.trim(),
        questionType: qType,
        d: difficulty,
        c: correctAnswer,
        stem: stem.trim(),
        o: options.map((o) => o.trim()),
        r: refSource.trim() || undefined,
        explanation: explanation.trim() || undefined,
        assertionText: qType === 'assertion_reason' ? assertionText.trim() : undefined,
        reasonText: qType === 'assertion_reason' ? reasonText.trim() : undefined,
        statement1: qType === 'statement_type' ? statement1.trim() : undefined,
        statement2: qType === 'statement_type' ? statement2.trim() : undefined,
        matchPairs: qType === 'match_the_pair' ? matchPairs : undefined,
      };

      await backend.addQuestion(questionData);
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();

      showToast('Question successfully created and saved to Cloud Database!');
      handleResetForm();
      setIsAddFormOpen(false);
    } catch (e: any) {
      alert(e.message || 'Failed to save question.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete question
  const handleDeleteQuestion = async (id: string | number) => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('Are you sure you want to delete this question from the cloud question bank?')
        : true;

    if (!confirmed) return;

    try {
      await backend.deleteQuestion(id);
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();
      showToast('Question deleted successfully.');
    } catch (e) {
      alert('Failed to delete question.');
    }
  };

  // CSV Validation
  const handleValidateCsv = () => {
    if (!csvInput.trim()) {
      alert('Please paste or upload CSV content first.');
      return;
    }
    const result = parseQuestionsCsv(csvInput);
    setCsvValidationResult(result);
  };

  // CSV Upload Execution
  const handleExecuteCsvUpload = async () => {
    if (!csvValidationResult || csvValidationResult.validQuestions.length === 0) {
      alert('No valid questions found to import.');
      return;
    }

    setIsUploadingCsv(true);
    try {
      const res = await backend.batchAddQuestions(csvValidationResult.validQuestions);
      await loadCloudQuestions();
      if (refreshQuestions) refreshQuestions();

      showToast(`Successfully imported ${res.added} questions into the cloud database!`);
      setCsvInput('');
      setCsvValidationResult(null);
      setIsCsvModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Failed to upload questions.');
    } finally {
      setIsUploadingCsv(false);
    }
  };

  // Handle local file picking for CSV on web
  const handleFileSelectWeb = (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setCsvInput(content);
        const result = parseQuestionsCsv(content);
        setCsvValidationResult(result);
      }
    };
    reader.readAsText(file);
  };

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // Type filter
      if (selectedTypeFilter !== 'all' && q.questionType !== selectedTypeFilter) {
        return false;
      }
      // Chapter filter
      if (
        selectedChapterFilter !== 'all' &&
        q.chapterName !== selectedChapterFilter &&
        q.ch !== selectedChapterFilter
      ) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const qText = `${q.stem} ${q.chapterName} ${q.r || ''} ${q.explanation || ''}`.toLowerCase();
        return qText.includes(searchQuery.toLowerCase().trim());
      }
      return true;
    });
  }, [questions, selectedTypeFilter, selectedChapterFilter, searchQuery]);

  // Unique chapters in question bank
  const uniqueChapters = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.chapterName) set.add(q.chapterName);
    });
    return Array.from(set).sort();
  }, [questions]);

  // Type Breakdown
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

      {/* Metric Cards Banner */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Questions</Text>
          <Text style={styles.metricNumber}>{typeCounts.total}</Text>
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

      {/* Action Header */}
      <View style={styles.actionsBar}>
        <View style={styles.actionLeft}>
          <TouchableOpacity
            style={[styles.primaryActionBtn, isAddFormOpen && styles.primaryActionBtnActive]}
            onPress={() => {
              setIsAddFormOpen(!isAddFormOpen);
              if (isCsvModalOpen) setIsCsvModalOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#FFF" />
            <Text style={styles.primaryActionBtnText}>
              {isAddFormOpen ? 'Close Form' : '+ Add New Question'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={() => {
              setIsCsvModalOpen(!isCsvModalOpen);
              if (isAddFormOpen) setIsAddFormOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Upload size={16} color={THEME.colors.brandInk} />
            <Text style={styles.secondaryActionBtnText}>Bulk Upload CSV</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostActionBtn}
            onPress={loadCloudQuestions}
            activeOpacity={0.7}
          >
            <RefreshCw size={14} color={THEME.colors.muted} />
            <Text style={styles.ghostActionBtnText}>Sync Cloud</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ============================================================== */}
      {/* 1. MANUAL QUESTION ENTRY FORM                                  */}
      {/* ============================================================== */}
      {isAddFormOpen && (
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <View>
              <Text style={styles.formTitle}>Add New Question to Cloud Database</Text>
              <Text style={styles.formSubtitle}>
                Select Question Type to configure dynamic inputs (A/R, Match, or Statements)
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsAddFormOpen(false)}>
              <X size={20} color={THEME.colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Question Type Selector */}
          <Text style={styles.fieldLabel}>Question Type *</Text>
          <View style={styles.typeSelectorRow}>
            {(['standard', 'assertion_reason', 'match_the_pair', 'statement_type'] as QuestionType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typePill, qType === t && styles.typePillActive]}
                onPress={() => handleTypeChange(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.typePillText, qType === t && styles.typePillTextActive]}>
                  {QUESTION_TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Universal Field: Chapter Mapping */}
          <View style={styles.formGrid2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Chapter Mapping (Breadcrumb) *</Text>
              <TextInput
                style={styles.input}
                value={chapterName}
                onChangeText={setChapterName}
                placeholder="e.g. Charaka Samhita > Sutrasthana > Chapter 1"
                placeholderTextColor={THEME.colors.muted}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Reference Book / Shloka Citation</Text>
              <TextInput
                style={styles.input}
                value={refSource}
                onChangeText={setRefSource}
                placeholder="e.g. Charaka Sutra 1/46"
                placeholderTextColor={THEME.colors.muted}
              />
            </View>
          </View>

          {/* Difficulty & Correct Answer */}
          <View style={styles.formGrid2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Difficulty Level</Text>
              <View style={styles.diffSelectorRow}>
                {[
                  { val: 0, label: 'Easy' },
                  { val: 1, label: 'Medium' },
                  { val: 2, label: 'Hard' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.val}
                    style={[styles.diffPill, difficulty === item.val && styles.diffPillActive]}
                    onPress={() => setDifficulty(item.val as Difficulty)}
                  >
                    <Text style={[styles.diffPillText, difficulty === item.val && styles.diffPillTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Correct Answer Option *</Text>
              <View style={styles.diffSelectorRow}>
                {['A', 'B', 'C', 'D'].map((letter, idx) => (
                  <TouchableOpacity
                    key={letter}
                    style={[styles.diffPill, correctAnswer === idx && styles.correctPillActive]}
                    onPress={() => setCorrectAnswer(idx)}
                  >
                    <Text style={[styles.diffPillText, correctAnswer === idx && styles.correctPillTextActive]}>
                      Option {letter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* ========================================================== */}
          {/* DYNAMIC CONDITIONAL INPUTS ACCORDING TO QUESTION TYPE       */}
          {/* ========================================================== */}

          {/* Dynamic 1: Assertion & Reason */}
          {qType === 'assertion_reason' && (
            <View style={styles.conditionalCard}>
              <View style={styles.conditionalBadge}>
                <Layers size={14} color="#854D0E" />
                <Text style={styles.conditionalBadgeText}>Assertion & Reason Specific Fields</Text>
              </View>

              <Text style={styles.fieldLabel}>Assertion (A) Text *</Text>
              <TextInput
                style={[styles.input, styles.textareaSmall]}
                value={assertionText}
                onChangeText={setAssertionText}
                placeholder="Enter the Assertion statement (A)..."
                placeholderTextColor={THEME.colors.muted}
                multiline
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Reason (R) Text *</Text>
              <TextInput
                style={[styles.input, styles.textareaSmall]}
                value={reasonText}
                onChangeText={setReasonText}
                placeholder="Enter the Reason statement (R)..."
                placeholderTextColor={THEME.colors.muted}
                multiline
              />
            </View>
          )}

          {/* Dynamic 2: Match the Pair */}
          {qType === 'match_the_pair' && (
            <View style={styles.conditionalCard}>
              <View style={styles.conditionalBadge}>
                <Layers size={14} color="#1E40AF" />
                <Text style={[styles.conditionalBadgeText, { color: '#1E40AF' }]}>
                  Two-Column Matching Pairs (Column I & Column II)
                </Text>
              </View>

              {matchPairs.map((pair, idx) => (
                <View key={idx} style={styles.matchPairRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.columnHeader}>Column I ({String.fromCharCode(65 + idx)})</Text>
                    <TextInput
                      style={styles.input}
                      value={pair.left}
                      onChangeText={(val) => {
                        const copy = [...matchPairs];
                        copy[idx].left = val;
                        setMatchPairs(copy);
                      }}
                      placeholder={`Item ${String.fromCharCode(65 + idx)}`}
                      placeholderTextColor={THEME.colors.muted}
                    />
                  </View>

                  <View style={styles.matchArrow}>
                    <ArrowRight size={16} color={THEME.colors.muted} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.columnHeader}>
                      Column II ({['I', 'II', 'III', 'IV'][idx]})
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={pair.right}
                      onChangeText={(val) => {
                        const copy = [...matchPairs];
                        copy[idx].right = val;
                        setMatchPairs(copy);
                      }}
                      placeholder={`Match for ${['I', 'II', 'III', 'IV'][idx]}`}
                      placeholderTextColor={THEME.colors.muted}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Dynamic 3: Statement Type */}
          {qType === 'statement_type' && (
            <View style={styles.conditionalCard}>
              <View style={styles.conditionalBadge}>
                <Layers size={14} color="#4338CA" />
                <Text style={[styles.conditionalBadgeText, { color: '#4338CA' }]}>
                  Dual Statement Configuration
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Statement I *</Text>
              <TextInput
                style={[styles.input, styles.textareaSmall]}
                value={statement1}
                onChangeText={setStatement1}
                placeholder="Enter Statement I..."
                placeholderTextColor={THEME.colors.muted}
                multiline
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Statement II *</Text>
              <TextInput
                style={[styles.input, styles.textareaSmall]}
                value={statement2}
                onChangeText={setStatement2}
                placeholder="Enter Statement II..."
                placeholderTextColor={THEME.colors.muted}
                multiline
              />
            </View>
          )}

          {/* Question Stem / Prompt */}
          <Text style={styles.fieldLabel}>Question Stem / Prompt *</Text>
          <TextInput
            style={[styles.input, styles.textareaMedium]}
            value={stem}
            onChangeText={setStem}
            placeholder={
              qType === 'standard'
                ? 'Type the question prompt...'
                : 'Enter the introductory or concluding prompt for this question...'
            }
            placeholderTextColor={THEME.colors.muted}
            multiline
          />

          {/* 4 Options */}
          <Text style={styles.fieldLabel}>Answer Choices (Options A, B, C, D) *</Text>
          {options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isCorrect = correctAnswer === idx;

            return (
              <View key={idx} style={styles.optionInputRow}>
                <TouchableOpacity
                  style={[styles.optionRadio, isCorrect && styles.optionRadioSelected]}
                  onPress={() => setCorrectAnswer(idx)}
                >
                  <Text style={[styles.optionRadioText, isCorrect && styles.optionRadioTextSelected]}>
                    {letter}
                  </Text>
                </TouchableOpacity>

                <TextInput
                  style={[styles.input, { flex: 1 }, isCorrect && styles.inputCorrectBorder]}
                  value={opt}
                  onChangeText={(val) => {
                    const copy = [...options];
                    copy[idx] = val;
                    setOptions(copy);
                  }}
                  placeholder={`Option ${letter}`}
                  placeholderTextColor={THEME.colors.muted}
                />
              </View>
            );
          })}

          {/* Detailed Explanation */}
          <Text style={styles.fieldLabel}>Authoritative Explanation (for Learning Mode)</Text>
          <TextInput
            style={[styles.input, styles.textareaMedium]}
            value={explanation}
            onChangeText={setExplanation}
            placeholder="Explain why the answer is correct with Sanskrit shloka citation or Ayurvedic clinical commentary..."
            placeholderTextColor={THEME.colors.muted}
            multiline
          />

          {/* Form Actions */}
          <View style={styles.formFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleResetForm}>
              <Text style={styles.cancelBtnText}>Reset Form</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSaveQuestion}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <CheckCircle2 size={16} color="#FFF" />
              )}
              <Text style={styles.saveBtnText}>
                {submitting ? 'Saving Question...' : 'Save Question to Cloud'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ============================================================== */}
      {/* 2. BULK UPLOAD CSV MODAL / SECTION                             */}
      {/* ============================================================== */}
      {isCsvModalOpen && (
        <View style={styles.csvModalCard}>
          <View style={styles.formHeader}>
            <View>
              <Text style={styles.formTitle}>Bulk Upload Questions via CSV</Text>
              <Text style={styles.formSubtitle}>
                Paste exported CSV from Google Sheets or load the ready-to-test Ayurvedic template.
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsCsvModalOpen(false)}>
              <X size={20} color={THEME.colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Sample CSV Buttons */}
          <View style={styles.csvHelperRow}>
            <TouchableOpacity
              style={styles.templateBtn}
              onPress={() => {
                const sample = generateSampleCsv();
                setCsvInput(sample);
                const res = parseQuestionsCsv(sample);
                setCsvValidationResult(res);
              }}
            >
              <FileText size={14} color={THEME.colors.brand} />
              <Text style={styles.templateBtnText}>Load Sample CSV Template (4 Types)</Text>
            </TouchableOpacity>

            {Platform.OS === 'web' && (
              <View style={styles.filePickerWrapper}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelectWeb}
                  style={{ fontSize: 13, color: THEME.colors.brandInk }}
                />
              </View>
            )}
          </View>

          {/* CSV Input Area */}
          <Text style={styles.fieldLabel}>CSV Data Content</Text>
          <TextInput
            style={[styles.input, styles.csvTextarea]}
            value={csvInput}
            onChangeText={(txt) => {
              setCsvInput(txt);
              if (csvValidationResult) setCsvValidationResult(null);
            }}
            placeholder="Type,Chapter,Stem,OptionA,OptionB,OptionC,OptionD,Answer,Explanation,Reference..."
            placeholderTextColor={THEME.colors.muted}
            multiline
          />

          {/* Validate Button */}
          <View style={styles.csvActionsRow}>
            <TouchableOpacity style={styles.validateBtn} onPress={handleValidateCsv}>
              <CheckCircle2 size={14} color={THEME.colors.brandInk} />
              <Text style={styles.validateBtnText}>Validate CSV Format</Text>
            </TouchableOpacity>
          </View>

          {/* CSV Validation Feedback */}
          {csvValidationResult && (
            <View style={styles.validationFeedbackCard}>
              <View style={styles.validationMetricsRow}>
                <View style={styles.vMetricItem}>
                  <Text style={styles.vMetricNum}>{csvValidationResult.totalRows}</Text>
                  <Text style={styles.vMetricLabel}>Total Rows</Text>
                </View>

                <View style={styles.vMetricItem}>
                  <Text style={[styles.vMetricNum, { color: THEME.colors.brand }]}>
                    {csvValidationResult.validQuestions.length}
                  </Text>
                  <Text style={styles.vMetricLabel}>Valid Questions</Text>
                </View>

                <View style={styles.vMetricItem}>
                  <Text
                    style={[
                      styles.vMetricNum,
                      { color: csvValidationResult.errors.length > 0 ? '#DC2626' : THEME.colors.ok },
                    ]}
                  >
                    {csvValidationResult.errors.length}
                  </Text>
                  <Text style={styles.vMetricLabel}>Row Errors</Text>
                </View>
              </View>

              {/* Error messages if any */}
              {csvValidationResult.errors.length > 0 && (
                <View style={styles.errorListBox}>
                  <Text style={styles.errorListTitle}>Found {csvValidationResult.errors.length} errors:</Text>
                  {csvValidationResult.errors.map((err: any, idx: number) => (
                    <Text key={idx} style={styles.errorItemText}>
                      • Row {err.row}: {err.error}
                    </Text>
                  ))}
                </View>
              )}

              {/* Import Action */}
              {csvValidationResult.validQuestions.length > 0 && (
                <TouchableOpacity
                  style={[styles.importBtn, isUploadingCsv && { opacity: 0.6 }]}
                  onPress={handleExecuteCsvUpload}
                  disabled={isUploadingCsv}
                >
                  {isUploadingCsv ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Upload size={16} color="#FFF" />
                  )}
                  <Text style={styles.importBtnText}>
                    {isUploadingCsv
                      ? 'Importing...'
                      : `Import ${csvValidationResult.validQuestions.length} Valid Questions into Cloud DB`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* ============================================================== */}
      {/* 3. CLOUD QUESTIONS LIVE TABLE & FILTERS                        */}
      {/* ============================================================== */}
      <View style={styles.tableCard}>
        {/* Table Filters & Search */}
        <View style={styles.filterSection}>
          {/* Search bar */}
          <View style={styles.searchBar}>
            <Search size={16} color={THEME.colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by stem, chapter, or reference citation..."
              placeholderTextColor={THEME.colors.muted}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={THEME.colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Type Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeFilterScroll}>
            {[
              { id: 'all', label: `All (${questions.length})` },
              { id: 'standard', label: `Standard (${typeCounts.standard})` },
              { id: 'assertion_reason', label: `Assertion / Reason (${typeCounts.assertion_reason})` },
              { id: 'match_the_pair', label: `Match Pair (${typeCounts.match_the_pair})` },
              { id: 'statement_type', label: `Statement (${typeCounts.statement_type})` },
            ].map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterPill,
                  selectedTypeFilter === filter.id && styles.filterPillActive,
                ]}
                onPress={() => setSelectedTypeFilter(filter.id)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    selectedTypeFilter === filter.id && styles.filterPillTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Question Counter Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={styles.tableHeaderTitle}>
            Cloud Question Bank ({filteredQuestions.length} displayed)
          </Text>
          <Text style={styles.tableHeaderSub}>
            Live dynamic syllabus questions fetched from Cloud DB
          </Text>
        </View>

        {/* Loading / Empty / List */}
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={THEME.colors.brand} />
            <Text style={styles.emptyStateText}>Loading cloud questions...</Text>
          </View>
        ) : filteredQuestions.length === 0 ? (
          <View style={styles.emptyState}>
            <HelpCircle size={32} color={THEME.colors.muted} />
            <Text style={styles.emptyStateText}>No questions found matching your filter.</Text>
          </View>
        ) : (
          <View style={styles.questionsList}>
            {filteredQuestions.map((q, idx) => {
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
                <View key={q.id} style={styles.questionItem}>
                  {/* Top Meta Row */}
                  <View style={styles.qMetaRow}>
                    <View style={styles.qBadges}>
                      <View style={[styles.qTypeBadge, { backgroundColor: typeBg }]}>
                        <Text style={[styles.qTypeBadgeText, { color: typeColor }]}>
                          {QUESTION_TYPE_LABELS[q.questionType] || 'Standard MCQ'}
                        </Text>
                      </View>

                      <View style={styles.qChapterBadge}>
                        <Text style={styles.qChapterBadgeText}>{q.chapterName || String(q.ch)}</Text>
                      </View>

                      {q.r ? (
                        <View style={styles.qRefBadge}>
                          <Text style={styles.qRefBadgeText}>{q.r}</Text>
                        </View>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteQuestion(q.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>

                  {/* Question Stem */}
                  <Text style={styles.qStemText}>{q.stem}</Text>

                  {/* Assertion / Reason Preview */}
                  {q.questionType === 'assertion_reason' && (
                    <View style={styles.arPreviewBox}>
                      <Text style={styles.arPreviewItem}>
                        <Text style={{ fontWeight: '700', color: THEME.colors.brand }}>Assertion (A): </Text>
                        {q.assertionText}
                      </Text>
                      <Text style={[styles.arPreviewItem, { marginTop: 4 }]}>
                        <Text style={{ fontWeight: '700', color: THEME.colors.brand }}>Reason (R): </Text>
                        {q.reasonText}
                      </Text>
                    </View>
                  )}

                  {/* Match the Pair Preview */}
                  {q.questionType === 'match_the_pair' && q.matchPairs && (
                    <View style={styles.matchPreviewBox}>
                      {q.matchPairs.map((p, pIdx) => (
                        <View key={pIdx} style={styles.matchPreviewRow}>
                          <Text style={styles.matchPreviewCol1}>{p.left}</Text>
                          <ArrowRight size={12} color={THEME.colors.muted} />
                          <Text style={styles.matchPreviewCol2}>{p.right}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Statement Type Preview */}
                  {q.questionType === 'statement_type' && (
                    <View style={styles.arPreviewBox}>
                      <Text style={styles.arPreviewItem}>
                        <Text style={{ fontWeight: '700', color: THEME.colors.brand }}>Statement I: </Text>
                        {q.statement1}
                      </Text>
                      <Text style={[styles.arPreviewItem, { marginTop: 4 }]}>
                        <Text style={{ fontWeight: '700', color: THEME.colors.brand }}>Statement II: </Text>
                        {q.statement2}
                      </Text>
                    </View>
                  )}

                  {/* Options Preview */}
                  <View style={styles.optionsPreviewGrid}>
                    {q.o.map((opt, optIdx) => {
                      const isCorrect = q.c === optIdx;
                      return (
                        <View
                          key={optIdx}
                          style={[styles.optPreviewItem, isCorrect && styles.optPreviewItemCorrect]}
                        >
                          <Text
                            style={[
                              styles.optPreviewLetter,
                              isCorrect && styles.optPreviewLetterCorrect,
                            ]}
                          >
                            {String.fromCharCode(65 + optIdx)}.
                          </Text>
                          <Text
                            style={[
                              styles.optPreviewText,
                              isCorrect && styles.optPreviewTextCorrect,
                            ]}
                          >
                            {opt}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Explanation Preview */}
                  {q.explanation ? (
                    <View style={styles.explanationBox}>
                      <Text style={styles.explanationTitle}>Explanation: </Text>
                      <Text style={styles.explanationText}>{q.explanation}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  toast: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    zIndex: 9999,
    backgroundColor: '#065F46',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
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
    color: THEME.colors.brandInk,
    marginVertical: 4,
  },
  metricSub: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
  actionsBar: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryActionBtn: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryActionBtnActive: {
    backgroundColor: '#164339',
  },
  primaryActionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryActionBtn: {
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
  secondaryActionBtnText: {
    color: THEME.colors.brandInk,
    fontWeight: '600',
    fontSize: 13,
  },
  ghostActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ghostActionBtnText: {
    color: THEME.colors.muted,
    fontSize: 13,
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    marginBottom: 20,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.brandInk,
  },
  formSubtitle: {
    fontSize: 13,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.brandInk,
    marginBottom: 6,
    marginTop: 12,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  typePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
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
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.brandInk,
  },
  typePillTextActive: {
    color: '#FFF',
  },
  formGrid2: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    backgroundColor: '#FBFBFA',
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: THEME.colors.ink,
  },
  inputCorrectBorder: {
    borderColor: THEME.colors.brand,
    borderWidth: 1.5,
    backgroundColor: '#F2F8F5',
  },
  textareaSmall: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  textareaMedium: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  diffSelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  diffPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  diffPillActive: {
    backgroundColor: THEME.colors.brandInk,
    borderColor: THEME.colors.brandInk,
  },
  diffPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.brandInk,
  },
  diffPillTextActive: {
    color: '#FFF',
  },
  correctPillActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  correctPillTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  conditionalCard: {
    backgroundColor: '#FAFAF7',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
    marginBottom: 6,
  },
  conditionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  conditionalBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#854D0E',
  },
  matchPairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.muted,
    marginBottom: 4,
  },
  matchArrow: {
    marginTop: 16,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  optionRadio: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: THEME.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  optionRadioSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.brand,
  },
  optionRadioText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.muted,
  },
  optionRadioTextSelected: {
    color: '#FFF',
  },
  formFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: THEME.colors.muted,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  csvModalCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    marginBottom: 20,
  },
  csvHelperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  templateBtnText: {
    fontSize: 12,
    color: THEME.colors.brand,
    fontWeight: '600',
  },
  filePickerWrapper: {
    padding: 4,
  },
  csvTextarea: {
    minHeight: 140,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  csvActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 10,
  },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  validateBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.brandInk,
  },
  validationFeedbackCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  validationMetricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  vMetricItem: {
    alignItems: 'center',
  },
  vMetricNum: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.brandInk,
  },
  vMetricLabel: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
  errorListBox: {
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 4,
  },
  errorItemText: {
    fontSize: 12,
    color: '#991B1B',
    marginBottom: 2,
  },
  importBtn: {
    backgroundColor: THEME.colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  importBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tableCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  filterSection: {
    marginBottom: 16,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.ink,
  },
  typeFilterScroll: {
    flexDirection: 'row',
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: THEME.colors.brand,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  filterPillTextActive: {
    color: '#FFF',
  },
  tableHeaderRow: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
    marginBottom: 12,
  },
  tableHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.brandInk,
  },
  tableHeaderSub: {
    fontSize: 12,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: THEME.colors.muted,
  },
  questionsList: {
    gap: 12,
  },
  questionItem: {
    backgroundColor: '#FCFCFB',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  qMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  qBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  qTypeBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  qTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  qChapterBadge: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  qChapterBadgeText: {
    fontSize: 11,
    color: THEME.colors.brandInk,
    fontWeight: '600',
  },
  qRefBadge: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  qRefBadgeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 4,
  },
  qStemText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.ink,
    lineHeight: 20,
    marginBottom: 10,
  },
  arPreviewBox: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#854D0E',
    marginBottom: 10,
  },
  arPreviewItem: {
    fontSize: 13,
    color: THEME.colors.ink,
    lineHeight: 18,
  },
  matchPreviewBox: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#1E40AF',
    marginBottom: 10,
    gap: 4,
  },
  matchPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchPreviewCol1: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.ink,
    flex: 1,
  },
  matchPreviewCol2: {
    fontSize: 12,
    color: THEME.colors.muted,
    flex: 1,
  },
  optionsPreviewGrid: {
    gap: 4,
    marginBottom: 8,
  },
  optPreviewItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 2,
  },
  optPreviewItemCorrect: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  optPreviewLetter: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.muted,
  },
  optPreviewLetterCorrect: {
    color: THEME.colors.brand,
  },
  optPreviewText: {
    fontSize: 12,
    color: THEME.colors.ink,
    flex: 1,
  },
  optPreviewTextCorrect: {
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  explanationBox: {
    backgroundColor: '#F5F5F3',
    padding: 8,
    borderRadius: 6,
    flexDirection: 'row',
    marginTop: 4,
  },
  explanationTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.brandInk,
  },
  explanationText: {
    fontSize: 11,
    color: THEME.colors.muted,
    flex: 1,
    lineHeight: 16,
  },
});
