import React, { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Shuffle,
  RefreshCw,
  Sparkles,
  Play,
  Pause,
  Square,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Question } from '../../types';
import {
  BaseQuestionItem,
  ProcessingOptions,
  ProcessingProgress,
  QuestionProcessingQueue,
  batchRandomizeOptions,
  AIProcessedQuestionResult,
  ShuffledQuestionResult,
} from '../../utils/questionProcessor';

interface PreImportProcessorPanelProps<T extends BaseQuestionItem = any> {
  questions: T[];
  onProcessedChange: (
    processedQuestions: T[] | null,
    summary: {
      shuffledCount: number;
      rephrasedCount: number;
      distractorSwappedCount: number;
      aiDetails?: AIProcessedQuestionResult<T>[];
      shuffleDetails?: ShuffledQuestionResult<T>[];
    } | null
  ) => void;
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

export function PreImportProcessorPanel<T extends BaseQuestionItem = any>({
  questions,
  onProcessedChange,
  onProcessingStateChange,
}: PreImportProcessorPanelProps<T>) {
  const [randomizeOptions, setRandomizeOptions] = useState<boolean>(true);
  const [swapWrongDistractor, setSwapWrongDistractor] = useState<boolean>(false);
  const [rephraseStem, setRephraseStem] = useState<boolean>(false);

  const [queueProgress, setQueueProgress] = useState<ProcessingProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [processSummary, setProcessSummary] = useState<{
    shuffledCount: number;
    rephrasedCount: number;
    distractorSwappedCount: number;
    skippedCount: number;
  } | null>(null);

  const queueRef = useRef<QuestionProcessingQueue<T> | null>(null);

  const hasAIToggle = swapWrongDistractor || rephraseStem;

  useEffect(() => {
    onProcessingStateChange?.(isProcessing);
  }, [isProcessing, onProcessingStateChange]);

  // Reset when questions input changes
  useEffect(() => {
    setQueueProgress(null);
    setIsProcessing(false);
    setIsPaused(false);
    setProcessSummary(null);
    onProcessedChange(null, null);
  }, [questions]);

  // Handle instant randomize (0 AI cost) if only randomize is checked
  const handleApplyInstantRandomize = () => {
    if (questions.length === 0) return;
    const res = batchRandomizeOptions(questions);
    setProcessSummary({
      shuffledCount: res.shuffledCount,
      rephrasedCount: 0,
      distractorSwappedCount: 0,
      skippedCount: res.skippedCount,
    });
    onProcessedChange(res.processed, {
      shuffledCount: res.shuffledCount,
      rephrasedCount: 0,
      distractorSwappedCount: 0,
      shuffleDetails: res.shuffleDetails,
    });
  };

  // Start sequential rate-limited processing queue
  const handleStartQueue = async () => {
    if (questions.length === 0) return;

    if (!hasAIToggle && randomizeOptions) {
      handleApplyInstantRandomize();
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    setProcessSummary(null);

    const options: ProcessingOptions = {
      randomizeOptions,
      swapWrongDistractor,
      rephraseStem,
    };

    const queue = new QuestionProcessingQueue<T>(
      questions,
      options,
      (prog) => {
        setQueueProgress({ ...prog });
      }
    );

    queueRef.current = queue;

    try {
      const result = await queue.run();
      setProcessSummary({
        shuffledCount: result.shuffledCount,
        rephrasedCount: result.rephrasedCount,
        distractorSwappedCount: result.distractorSwappedCount,
        skippedCount: result.shuffleDetails.filter((s) => !s.wasShuffled).length,
      });

      onProcessedChange(result.processed, {
        shuffledCount: result.shuffledCount,
        rephrasedCount: result.rephrasedCount,
        distractorSwappedCount: result.distractorSwappedCount,
        aiDetails: result.aiDetails,
        shuffleDetails: result.shuffleDetails,
      });
    } catch (err: any) {
      console.warn('[PreImportProcessor] Error:', err);
    } finally {
      setIsProcessing(false);
      setIsPaused(false);
      queueRef.current = null;
    }
  };

  const handlePause = () => {
    if (queueRef.current && isProcessing) {
      queueRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (queueRef.current && isProcessing) {
      queueRef.current.resume();
      setIsPaused(false);
    }
  };

  const handleStopAndUseCurrent = () => {
    if (queueRef.current && isProcessing) {
      queueRef.current.stop();
      setIsProcessing(false);
      setIsPaused(false);
    }
  };

  const progressPercent =
    queueProgress && queueProgress.total > 0
      ? Math.round((queueProgress.current / queueProgress.total) * 100)
      : 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Sparkles size={16} color="#047857" />
          <Text style={styles.title}>Pre-Import Processing &amp; AI Refinement</Text>
        </View>
        <Text style={styles.subtitle}>
          Enhance question variety, distractor difficulty, and wording before adding to Cloud DB
        </Text>
      </View>

      {/* Toggles Container */}
      <View style={styles.togglesGrid}>
        {/* Toggle 1: Randomize Options */}
        <TouchableOpacity
          style={[styles.toggleCard, randomizeOptions && styles.toggleCardActive]}
          onPress={() => !isProcessing && setRandomizeOptions((prev) => !prev)}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          <View style={styles.toggleHeader}>
            <View style={[styles.checkbox, randomizeOptions && styles.checkboxActive]}>
              {randomizeOptions && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.toggleTitleWrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Shuffle size={14} color="#047857" />
                <Text style={styles.toggleTitle}>Randomize Options</Text>
              </View>
              <Text style={styles.toggleBadgeFree}>Instant • 0 AI Cost</Text>
            </View>
          </View>
          <Text style={styles.toggleDesc}>
            Shuffles options A, B, C, D randomly and preserves the right answer. Smart skip automatically guards &quot;All of the above&quot;, &quot;Both A &amp; B&quot;, and Assertion-Reason items.
          </Text>
        </TouchableOpacity>

        {/* Toggle 2: Swap 1 Wrong Option */}
        <TouchableOpacity
          style={[styles.toggleCard, swapWrongDistractor && styles.toggleCardActive]}
          onPress={() => !isProcessing && setSwapWrongDistractor((prev) => !prev)}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          <View style={styles.toggleHeader}>
            <View style={[styles.checkbox, swapWrongDistractor && styles.checkboxActive]}>
              {swapWrongDistractor && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.toggleTitleWrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={14} color="#D97706" />
                <Text style={styles.toggleTitle}>Swap 1 Wrong Option</Text>
              </View>
              <Text style={styles.toggleBadgeAI}>Groq AI</Text>
            </View>
          </View>
          <Text style={styles.toggleDesc}>
            Leaves the correct answer 100% untouched. Replaces only 1 plausible incorrect distractor with a fresh Ayurveda distractor to prevent memorization.
          </Text>
        </TouchableOpacity>

        {/* Toggle 3: Rephrase Stem */}
        <TouchableOpacity
          style={[styles.toggleCard, rephraseStem && styles.toggleCardActive]}
          onPress={() => !isProcessing && setRephraseStem((prev) => !prev)}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          <View style={styles.toggleHeader}>
            <View style={[styles.checkbox, rephraseStem && styles.checkboxActive]}>
              {rephraseStem && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.toggleTitleWrap}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="#7C3AED" />
                <Text style={styles.toggleTitle}>Rephrase Question Stem</Text>
              </View>
              <Text style={styles.toggleBadgeAI}>Groq AI</Text>
            </View>
          </View>
          <Text style={styles.toggleDesc}>
            Rephrases the stem in clear bilingual English + Hindi while preserving Sanskrit shlokas, citations, and correct answer meaning.
          </Text>
        </TouchableOpacity>
      </View>

      {/* Control Actions / Start Button */}
      {(randomizeOptions || hasAIToggle) && (
        <View style={styles.actionsBar}>
          {!isProcessing ? (
            <TouchableOpacity
              style={styles.btnStartProcess}
              onPress={handleStartQueue}
              activeOpacity={0.8}
            >
              <Play size={13} color="#FFF" />
              <Text style={styles.btnStartProcessText}>
                {hasAIToggle
                  ? `Run AI Processing on ${questions.length} Questions`
                  : `Apply Option Shuffle to ${questions.length} Questions`}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.queueControlsRow}>
              {!isPaused ? (
                <TouchableOpacity style={styles.btnPause} onPress={handlePause} activeOpacity={0.8}>
                  <Pause size={13} color="#D97706" />
                  <Text style={styles.btnPauseText}>Pause</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.btnResume} onPress={handleResume} activeOpacity={0.8}>
                  <Play size={13} color="#047857" />
                  <Text style={styles.btnResumeText}>Resume</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.btnStop}
                onPress={handleStopAndUseCurrent}
                activeOpacity={0.8}
              >
                <Square size={13} color="#DC2626" />
                <Text style={styles.btnStopText}>Stop &amp; Use Current</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Rate Limit notice */}
          {hasAIToggle && (
            <Text style={styles.rateLimitNote}>
              ⚡ Rate-limited: 5 questions per call with a 2.5s safe delay to prevent Groq API 429 limits.
            </Text>
          )}
        </View>
      )}

      {/* Live Progress Bar */}
      {isProcessing && queueProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTextRow}>
            <Text style={styles.progressLabel}>
              Processing {queueProgress.current} / {queueProgress.total} Questions
              {queueProgress.totalBatches > 1
                ? ` (Batch ${queueProgress.batchIndex} of ${queueProgress.totalBatches})`
                : ''}
            </Text>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          {isPaused && (
            <Text style={styles.pausedIndicator}>
              ⏸️ Queue paused. Tap &quot;Resume&quot; to continue or &quot;Stop &amp; Use Current&quot; to keep completed items.
            </Text>
          )}
        </View>
      )}

      {/* Success Summary Banner */}
      {processSummary && !isProcessing && (
        <View style={styles.summaryBanner}>
          <CheckCircle2 size={16} color="#047857" />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>Pre-Import Processing Applied:</Text>
            <View style={styles.summaryPillsRow}>
              {processSummary.shuffledCount > 0 && (
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillText}>
                    🔀 Shuffled: {processSummary.shuffledCount}
                  </Text>
                </View>
              )}
              {processSummary.skippedCount > 0 && (
                <View style={[styles.summaryPill, { backgroundColor: '#F1F5F9' }]}>
                  <Text style={[styles.summaryPillText, { color: '#475569' }]}>
                    ⏭️ Skip Guard: {processSummary.skippedCount}
                  </Text>
                </View>
              )}
              {processSummary.distractorSwappedCount > 0 && (
                <View style={[styles.summaryPill, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.summaryPillText, { color: '#92400E' }]}>
                    🔄 Distractors Swapped: {processSummary.distractorSwappedCount}
                  </Text>
                </View>
              )}
              {processSummary.rephrasedCount > 0 && (
                <View style={[styles.summaryPill, { backgroundColor: '#EDE9FE' }]}>
                  <Text style={[styles.summaryPillText, { color: '#6D28D9' }]}>
                    ✨ Rephrased: {processSummary.rephrasedCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  headerRow: {
    marginBottom: 10,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  togglesGrid: {
    gap: 8,
  },
  toggleCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 10,
  },
  toggleCardActive: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkboxActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: -1,
  },
  toggleTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  toggleBadgeFree: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  toggleBadgeAI: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  toggleDesc: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    paddingLeft: 26,
  },
  actionsBar: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  btnStartProcess: {
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnStartProcessText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  queueControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnPause: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 6,
  },
  btnPauseText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  btnResume: {
    flex: 1,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 6,
  },
  btnResumeText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '700',
  },
  btnStop: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnStopText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  rateLimitNote: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
    fontStyle: 'italic',
  },
  progressContainer: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
  },
  pausedIndicator: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 6,
    fontWeight: '600',
  },
  summaryBanner: {
    marginTop: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 4,
  },
  summaryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryPill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  summaryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
});
