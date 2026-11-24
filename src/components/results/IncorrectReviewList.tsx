import React, { useMemo, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import {
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  FileText,
  Flag,
  HelpCircle,
  XCircle,
} from 'lucide-react-native';
import { THEME, OPTION_LABELS } from '../../constants/theme';
import { Language, Question, QuizSession } from '../../types';
import { useApp } from '../../context/AppContext';
import { isPlaceholderCitation } from '../../utils/chapterMapper';
import { QuestionStem } from '../quiz/QuestionStem';

interface IncorrectReviewListProps {
  wrongQuestions: Question[];
  session: QuizSession;
  language: Language;
  claimedQuestions: Record<string | number, boolean>;
  onClaimPress: (question: Question) => void;
}

type FilterMode = 'all' | 'correct' | 'incorrect' | 'unattempted';

export const IncorrectReviewList: React.FC<IncorrectReviewListProps> = ({
  wrongQuestions,
  session,
  language,
  claimedQuestions,
  onClaimPress,
}) => {
  const { toggleBookmark, isBookmarked } = useApp();

  const allQuestions = session.qs;

  // Filter mode state: defaults to 'all' so student can review the complete paper
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | number | null>(null);

  // Compute live question buckets
  const correctQuestions = useMemo(() => {
    return allQuestions.filter(
      (q) => session.ans[q.id] !== undefined && session.ans[q.id] === q.c
    );
  }, [allQuestions, session.ans]);

  const incorrectQuestions = useMemo(() => {
    return allQuestions.filter(
      (q) => session.ans[q.id] !== undefined && session.ans[q.id] !== q.c
    );
  }, [allQuestions, session.ans]);

  const unattemptedQuestions = useMemo(() => {
    return allQuestions.filter((q) => session.ans[q.id] === undefined);
  }, [allQuestions, session.ans]);

  // Map original question index (Q #1 to Q #120) based on full paper session.qs
  const questionNumberMap = useMemo(() => {
    const map = new Map<string | number, number>();
    allQuestions.forEach((q, idx) => {
      map.set(q.id, idx + 1);
    });
    return map;
  }, [allQuestions]);

  // Filtered questions based on active 4-button filter
  const displayedQuestions = useMemo(() => {
    switch (filterMode) {
      case 'correct':
        return correctQuestions;
      case 'incorrect':
        return incorrectQuestions;
      case 'unattempted':
        return unattemptedQuestions;
      case 'all':
      default:
        return allQuestions;
    }
  }, [filterMode, allQuestions, correctQuestions, incorrectQuestions, unattemptedQuestions]);

  // Jump to specific question handler
  const handleJumpToQuestion = (q: Question) => {
    // If target question is hidden in current filter, switch to 'all' to show it
    if (filterMode !== 'all' && !displayedQuestions.some((item) => item.id === q.id)) {
      setFilterMode('all');
    }

    setHighlightedId(q.id);

    const scrollToTarget = () => {
      if (typeof document !== 'undefined') {
        const el = document.getElementById(`review-q-${q.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    // Small delay ensures DOM is mounted if filter switched
    setTimeout(scrollToTarget, 60);

    // Auto-remove highlight after 2.5s
    setTimeout(() => {
      setHighlightedId((prev) => (prev === q.id ? null : prev));
    }, 2500);
  };

  return (
    <View style={styles.card}>
      {/* Title & Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <FileText size={20} color={THEME.colors.brand} />
          <Text style={styles.title}>Question Review &amp; Claims</Text>
        </View>

        {/* 4-Button Filter Bar with Live Counts */}
        <View style={styles.filterBar}>
          {/* All Filter */}
          <TouchableOpacity
            style={[styles.filterBtn, filterMode === 'all' && styles.filterBtnActiveAll]}
            onPress={() => setFilterMode('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterMode === 'all' && styles.filterBtnTextActiveAll,
              ]}
            >
              All ({allQuestions.length})
            </Text>
          </TouchableOpacity>

          {/* Correct Filter */}
          <TouchableOpacity
            style={[
              styles.filterBtn,
              filterMode === 'correct' && styles.filterBtnActiveCorrect,
            ]}
            onPress={() => setFilterMode('correct')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.filterDot,
                { backgroundColor: THEME.colors.ok },
                filterMode === 'correct' && { backgroundColor: '#FFFFFF' },
              ]}
            />
            <Text
              style={[
                styles.filterBtnText,
                filterMode === 'correct'
                  ? styles.filterBtnTextActiveCorrect
                  : styles.filterBtnTextCorrect,
              ]}
            >
              Correct ({correctQuestions.length})
            </Text>
          </TouchableOpacity>

          {/* Incorrect Filter */}
          <TouchableOpacity
            style={[
              styles.filterBtn,
              filterMode === 'incorrect' && styles.filterBtnActiveIncorrect,
            ]}
            onPress={() => setFilterMode('incorrect')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.filterDot,
                { backgroundColor: THEME.colors.bad },
                filterMode === 'incorrect' && { backgroundColor: '#FFFFFF' },
              ]}
            />
            <Text
              style={[
                styles.filterBtnText,
                filterMode === 'incorrect'
                  ? styles.filterBtnTextActiveIncorrect
                  : styles.filterBtnTextIncorrect,
              ]}
            >
              Incorrect ({incorrectQuestions.length})
            </Text>
          </TouchableOpacity>

          {/* Unattempted Filter */}
          <TouchableOpacity
            style={[
              styles.filterBtn,
              filterMode === 'unattempted' && styles.filterBtnActiveUnattempted,
            ]}
            onPress={() => setFilterMode('unattempted')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.filterDot,
                { backgroundColor: '#D97706' },
                filterMode === 'unattempted' && { backgroundColor: '#FFFFFF' },
              ]}
            />
            <Text
              style={[
                styles.filterBtnText,
                filterMode === 'unattempted'
                  ? styles.filterBtnTextActiveUnattempted
                  : styles.filterBtnTextUnattempted,
              ]}
            >
              Unattempted ({unattemptedQuestions.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Review full paper questions with citations &amp; options, or tap any question in the palette below to jump directly:
      </Text>

      {/* Quick Navigation: Compact Question Palette / Jump Bar (1..120) */}
      <View style={styles.paletteContainer}>
        <View style={styles.paletteHeader}>
          <TouchableOpacity
            style={styles.paletteToggleBtn}
            onPress={() => setIsPaletteOpen((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Compass size={15} color={THEME.colors.brand} />
            <Text style={styles.paletteTitle}>
              Question Palette (1–{allQuestions.length})
            </Text>
            {isPaletteOpen ? (
              <ChevronUp size={16} color={THEME.colors.muted} />
            ) : (
              <ChevronDown size={16} color={THEME.colors.muted} />
            )}
          </TouchableOpacity>

          {/* Legend Badges */}
          <View style={styles.paletteLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Correct ({correctQuestions.length})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Wrong ({incorrectQuestions.length})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#9CA3AF' }]} />
              <Text style={styles.legendText}>Skipped ({unattemptedQuestions.length})</Text>
            </View>
          </View>
        </View>

        {isPaletteOpen && (
          <View style={styles.paletteGrid}>
            {allQuestions.map((q, idx) => {
              const uAns = session.ans[q.id];
              const isAns = uAns !== undefined;
              const isCorr = isAns && uAns === q.c;
              const isWr = isAns && uAns !== q.c;
              const qNum = idx + 1;

              let chipStyle: StyleProp<ViewStyle> = styles.paletteChipUnattempted;
              let textStyle: StyleProp<TextStyle> = styles.paletteTextUnattempted;

              if (isCorr) {
                chipStyle = styles.paletteChipCorrect;
                textStyle = styles.paletteTextCorrect;
              } else if (isWr) {
                chipStyle = styles.paletteChipWrong;
                textStyle = styles.paletteTextWrong;
              }

              const isCurrHighlighted = highlightedId === q.id;

              return (
                <TouchableOpacity
                  key={q.id}
                  style={[
                    styles.paletteChip,
                    chipStyle,
                    isCurrHighlighted && styles.paletteChipHighlighted,
                  ]}
                  onPress={() => handleJumpToQuestion(q)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.paletteChipText, textStyle]}>{qNum}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Questions Review List */}
      {displayedQuestions.length === 0 ? (
        <View style={styles.emptyCard}>
          <CheckCircle2 size={26} color={THEME.colors.ok} />
          <Text style={styles.emptyTitle}>
            {filterMode === 'correct' && 'No correct questions in this filter.'}
            {filterMode === 'incorrect' && 'No incorrect questions! You answered everything right.'}
            {filterMode === 'unattempted' && 'No unattempted questions! You attempted the entire paper.'}
            {filterMode === 'all' && 'No questions available.'}
          </Text>
          <Text style={styles.emptySub}>
            Tap "All" to review the entire paper in sequence.
          </Text>
          <TouchableOpacity
            style={styles.switchAllBtn}
            onPress={() => setFilterMode('all')}
            activeOpacity={0.7}
          >
            <Text style={styles.switchAllText}>View all {allQuestions.length} questions</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          {displayedQuestions.map((q) => {
            const paperNum = questionNumberMap.get(q.id) || 1;
            const userChoice = session.ans[q.id];
            const hasAnswered = userChoice !== undefined;
            const isCorrect = hasAnswered && userChoice === q.c;
            const isWrong = hasAnswered && userChoice !== q.c;
            const isClaimed = !!claimedQuestions[q.id];

            const userChoiceLabel = hasAnswered ? OPTION_LABELS[userChoice] : 'None';
            const correctChoiceLabel = OPTION_LABELS[q.c];

            const isCardHighlighted = highlightedId === q.id;

            return (
              <View
                key={q.id}
                // @ts-ignore - Support DOM ID for smooth scrolling in React Native Web
                id={`review-q-${q.id}`}
                nativeID={`review-q-${q.id}`}
                style={[
                  styles.item,
                  isCardHighlighted && styles.itemHighlighted,
                ]}
              >
                {/* Meta Header */}
                <View style={styles.itemMeta}>
                  <View style={styles.metaLeft}>
                    <Text style={styles.qBadge}>Q #{paperNum}</Text>
                    <Text style={styles.chapterText} numberOfLines={1}>
                      {q.chapterName || `Chapter ${q.ch}`}
                    </Text>
                  </View>

                  <View style={styles.metaRightActions}>
                    {/* Persistent Bookmark Button */}
                    <TouchableOpacity
                      style={[
                        styles.bookmarkReviewBtn,
                        isBookmarked(q.id) && styles.bookmarkReviewBtnActive,
                      ]}
                      onPress={() => toggleBookmark(q.id)}
                      activeOpacity={0.7}
                    >
                      <Bookmark
                        size={12}
                        color={
                          isBookmarked(q.id)
                            ? '#16241F'
                            : THEME.colors.accent
                        }
                        fill={isBookmarked(q.id) ? THEME.colors.accent : 'none'}
                      />
                      <Text
                        style={[
                          styles.bookmarkReviewBtnText,
                          isBookmarked(q.id) && styles.bookmarkReviewBtnTextActive,
                        ]}
                      >
                        {isBookmarked(q.id) ? 'Bookmarked 🔖' : 'Bookmark 🔖'}
                      </Text>
                    </TouchableOpacity>

                    {/* Report / Claim Error button */}
                    {isClaimed ? (
                      <View style={styles.claimSubmittedBadge}>
                        <Check size={12} color={THEME.colors.ok} />
                        <Text style={styles.claimSubmittedText}>Claim Submitted</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.claimBtn}
                        onPress={() => onClaimPress(q)}
                        activeOpacity={0.7}
                      >
                        <Flag size={12} color={THEME.colors.brand} />
                        <Text style={styles.claimBtnText}>Report/Claim Error</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Question Stem (Formatted with bilingual and statement/assertion support) */}
                <QuestionStem question={q} language={language} />

                {/* Picked Answer & Status Banner */}
                {isCorrect && (
                  <View style={styles.statusBannerCorrect}>
                    <CheckCircle2 size={16} color={THEME.colors.ok} />
                    <Text style={styles.statusBannerTextCorrect}>
                      ✓ You chose: Option {userChoiceLabel} (+4 Marks)
                    </Text>
                  </View>
                )}

                {isWrong && (
                  <View style={styles.statusBannerIncorrect}>
                    <XCircle size={16} color={THEME.colors.bad} />
                    <View style={styles.statusBannerTextGroup}>
                      <Text style={styles.statusBannerTextIncorrect}>
                        ✗ You chose: Option {userChoiceLabel} (-1 Mark)
                      </Text>
                      <Text style={styles.statusBannerSubCorrect}>
                        • Correct answer: Option {correctChoiceLabel}
                      </Text>
                    </View>
                  </View>
                )}

                {!hasAnswered && (
                  <View style={styles.statusBannerUnattempted}>
                    <HelpCircle size={16} color="#D97706" />
                    <View style={styles.statusBannerTextGroup}>
                      <Text style={styles.statusBannerTextUnattempted}>
                        — Not Attempted (0 Marks)
                      </Text>
                      <Text style={styles.statusBannerSubCorrect}>
                        • Correct answer: Option {correctChoiceLabel}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Full 4 Options (A, B, C, D) Clean Layout */}
                <View style={styles.optionsContainer}>
                  {q.o.map((optText, optIdx) => {
                    const isStudentPick = hasAnswered && userChoice === optIdx;
                    const isRightAnswer = optIdx === q.c;

                    const hiOptText = q.hi?.o?.[optIdx];
                    let primaryText = optText;
                    let subText: string | null = null;

                    if (language === 'hi' && hiOptText) {
                      primaryText = hiOptText;
                    } else if (language === 'both' && hiOptText && hiOptText !== optText) {
                      subText = hiOptText;
                    }

                    // Determine row style and badge
                    let rowStyle: StyleProp<ViewStyle> = styles.optionRowNeutral;
                    let letterBoxStyle: StyleProp<ViewStyle> = styles.optLetterBoxNeutral;
                    let letterTextStyle: StyleProp<TextStyle> = styles.optLetterTextNeutral;
                    let optionContentStyle: StyleProp<TextStyle> = styles.optTextNeutral;
                    let tagBadge: React.ReactNode = null;

                    if (isStudentPick && isRightAnswer) {
                      // Student picked correct answer
                      rowStyle = styles.optionRowPickedCorrect;
                      letterBoxStyle = styles.optLetterBoxPickedCorrect;
                      letterTextStyle = styles.optLetterTextPickedCorrect;
                      optionContentStyle = styles.optTextPickedCorrect;
                      tagBadge = (
                        <View style={styles.badgePickedCorrect}>
                          <CheckCircle2 size={12} color="#047857" />
                          <Text style={styles.badgeTextPickedCorrect}>
                            ✓ You chose (+4 Marks)
                          </Text>
                        </View>
                      );
                    } else if (isStudentPick && !isRightAnswer) {
                      // Student picked wrong answer
                      rowStyle = styles.optionRowPickedWrong;
                      letterBoxStyle = styles.optLetterBoxPickedWrong;
                      letterTextStyle = styles.optLetterTextPickedWrong;
                      optionContentStyle = styles.optTextPickedWrong;
                      tagBadge = (
                        <View style={styles.badgePickedWrong}>
                          <XCircle size={12} color="#B91C1C" />
                          <Text style={styles.badgeTextPickedWrong}>
                            ✗ You chose (-1 Mark)
                          </Text>
                        </View>
                      );
                    } else if (!isStudentPick && isRightAnswer) {
                      // The correct answer when student chose another or skipped
                      rowStyle = styles.optionRowCorrect;
                      letterBoxStyle = styles.optLetterBoxCorrect;
                      letterTextStyle = styles.optLetterTextCorrect;
                      optionContentStyle = styles.optTextCorrect;
                      tagBadge = (
                        <View style={styles.badgeCorrect}>
                          <CheckCircle2 size={12} color="#047857" />
                          <Text style={styles.badgeTextCorrect}>
                            ✓ Correct answer
                          </Text>
                        </View>
                      );
                    }

                    return (
                      <View key={optIdx} style={[styles.optionRow, rowStyle]}>
                        <View style={[styles.optLetterBox, letterBoxStyle]}>
                          <Text style={[styles.optLetterText, letterTextStyle]}>
                            {OPTION_LABELS[optIdx]}
                          </Text>
                        </View>

                        <View style={styles.optionBody}>
                          <Text style={[styles.optionMainText, optionContentStyle]}>
                            {primaryText}
                          </Text>
                          {subText ? (
                            <Text style={styles.optionSubText}>{subText}</Text>
                          ) : null}
                        </View>

                        {tagBadge && <View style={styles.optionTagBox}>{tagBadge}</View>}
                      </View>
                    );
                  })}
                </View>

                {/* Reference / Citation Box (Always displayed for all states) */}
                <View style={styles.refBox}>
                  <View style={styles.refHeader}>
                    <BookOpen size={14} color={THEME.colors.brand} />
                    <Text style={styles.refHeading}>Reference &amp; Classical Citation</Text>
                  </View>

                  {q.r && !isPlaceholderCitation(q.r, q.chapterName) ? (
                    <Text style={styles.refText}>
                      <Text style={styles.refLabel}>Samhita Shloka: </Text>
                      {q.r}
                    </Text>
                  ) : (
                    <Text style={styles.refText}>
                      <Text style={styles.refLabel}>Samhita Section: </Text>
                      {q.chapterName || `Chapter ${q.ch}`}
                    </Text>
                  )}

                  {(q.explanation || q.hi?.explanation) ? (
                    <Text style={styles.explanationText}>
                      <Text style={styles.refLabel}>Explanation: </Text>
                      {language === 'hi' && q.hi?.explanation
                        ? q.hi.explanation
                        : q.explanation || q.hi?.explanation}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    padding: 16,
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 6,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: THEME.colors.bg,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    padding: 3,
    gap: 4,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.sm,
    backgroundColor: 'transparent',
  },
  filterBtnActiveAll: {
    backgroundColor: THEME.colors.brand,
  },
  filterBtnActiveCorrect: {
    backgroundColor: THEME.colors.ok,
  },
  filterBtnActiveIncorrect: {
    backgroundColor: THEME.colors.bad,
  },
  filterBtnActiveUnattempted: {
    backgroundColor: '#D97706',
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  filterBtnTextActiveAll: {
    color: THEME.colors.brandInk,
    fontWeight: '700',
  },
  filterBtnTextCorrect: {
    color: THEME.colors.ok,
  },
  filterBtnTextActiveCorrect: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterBtnTextIncorrect: {
    color: THEME.colors.bad,
  },
  filterBtnTextActiveIncorrect: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterBtnTextUnattempted: {
    color: '#92400E',
  },
  filterBtnTextActiveUnattempted: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.muted,
    marginBottom: 12,
    lineHeight: 18,
  },

  // Question Palette / Jump Bar Styles
  paletteContainer: {
    backgroundColor: THEME.colors.bg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  paletteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  paletteToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paletteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  paletteLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: THEME.colors.muted,
    fontWeight: '500',
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 4,
  },
  paletteChip: {
    width: 32,
    height: 32,
    borderRadius: THEME.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  paletteChipCorrect: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  paletteChipWrong: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  paletteChipUnattempted: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  paletteChipHighlighted: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    transform: [{ scale: 1.15 }],
  },
  paletteChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  paletteTextCorrect: {
    color: '#15803D',
  },
  paletteTextWrong: {
    color: '#B91C1C',
  },
  paletteTextUnattempted: {
    color: '#4B5563',
  },

  // Empty State
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: THEME.colors.soft,
    borderRadius: THEME.radius.md,
    gap: 6,
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginTop: 4,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: THEME.colors.muted,
    textAlign: 'center',
  },
  switchAllBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.sm,
  },
  switchAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.brandInk,
  },

  // Question Card Item
  list: {
    gap: 16,
  },
  item: {
    padding: 14,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.bg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    gap: 10,
  },
  itemHighlighted: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#FFFBEB',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 150,
  },
  qBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.brand,
    backgroundColor: THEME.colors.soft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
  },
  chapterText: {
    fontSize: 12,
    color: THEME.colors.muted,
    fontWeight: '500',
    flex: 1,
  },
  metaRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookmarkReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  bookmarkReviewBtnActive: {
    backgroundColor: THEME.colors.accent,
    borderColor: THEME.colors.accent,
  },
  bookmarkReviewBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  bookmarkReviewBtnTextActive: {
    color: '#16241F',
    fontWeight: '800',
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  claimBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  claimSubmittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.okSoft,
    borderWidth: 1,
    borderColor: THEME.colors.ok,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  claimSubmittedText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.ok,
  },

  // Picked Answer & Status Banners
  statusBannerCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.sm,
  },
  statusBannerTextCorrect: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  statusBannerIncorrect: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.sm,
  },
  statusBannerTextGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  statusBannerTextIncorrect: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  statusBannerSubCorrect: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  statusBannerUnattempted: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.sm,
  },
  statusBannerTextUnattempted: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },

  // Options List Layout
  optionsContainer: {
    gap: 8,
    marginVertical: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: THEME.radius.md,
    gap: 10,
  },
  optionRowNeutral: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  optionRowPickedCorrect: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  optionRowPickedWrong: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  optionRowCorrect: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  optLetterBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optLetterBoxNeutral: {
    backgroundColor: THEME.colors.soft,
  },
  optLetterBoxPickedCorrect: {
    backgroundColor: '#10B981',
  },
  optLetterBoxPickedWrong: {
    backgroundColor: '#EF4444',
  },
  optLetterBoxCorrect: {
    backgroundColor: '#10B981',
  },
  optLetterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  optLetterTextNeutral: {
    color: THEME.colors.ink,
  },
  optLetterTextPickedCorrect: {
    color: '#FFFFFF',
  },
  optLetterTextPickedWrong: {
    color: '#FFFFFF',
  },
  optLetterTextCorrect: {
    color: '#FFFFFF',
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
  optionMainText: {
    fontSize: 13,
    lineHeight: 18,
  },
  optTextNeutral: {
    color: THEME.colors.ink,
    fontWeight: '400',
  },
  optTextPickedCorrect: {
    color: '#065F46',
    fontWeight: '600',
  },
  optTextPickedWrong: {
    color: '#991B1B',
    fontWeight: '600',
  },
  optTextCorrect: {
    color: '#065F46',
    fontWeight: '600',
  },
  optionSubText: {
    fontSize: 12,
    color: THEME.colors.muted,
  },
  optionTagBox: {
    marginLeft: 'auto',
  },
  badgePickedCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.sm,
  },
  badgeTextPickedCorrect: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  badgePickedWrong: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.sm,
  },
  badgeTextPickedWrong: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  badgeCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.sm,
  },
  badgeTextCorrect: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },

  // Reference & Shloka Citation Box
  refBox: {
    backgroundColor: THEME.colors.soft,
    borderRadius: THEME.radius.sm,
    padding: 10,
    marginTop: 4,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.brand,
  },
  refHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  refHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.brand,
  },
  refLabel: {
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  refText: {
    fontSize: 12,
    color: THEME.colors.muted,
    lineHeight: 17,
  },
  explanationText: {
    fontSize: 12,
    color: THEME.colors.ink,
    lineHeight: 18,
    marginTop: 2,
  },
});
