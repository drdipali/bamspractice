import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle, Check, CheckCircle2, Flag, HelpCircle, XCircle } from 'lucide-react-native';
import { THEME, OPTION_LABELS } from '../../constants/theme';
import { ALL_CHAPTERS, getChapterPath } from '../../constants/syllabusData';
import { Language, Question, QuizSession } from '../../types';

interface IncorrectReviewListProps {
  wrongQuestions: Question[];
  session: QuizSession;
  language: Language;
  claimedQuestions: Record<number, boolean>;
  onClaimPress: (question: Question) => void;
}

export const IncorrectReviewList: React.FC<IncorrectReviewListProps> = ({
  wrongQuestions,
  session,
  language,
  claimedQuestions,
  onClaimPress,
}) => {
  const [filterMode, setFilterMode] = useState<'incorrect' | 'all'>(
    wrongQuestions.length > 0 ? 'incorrect' : 'all'
  );

  const displayedQuestions =
    filterMode === 'incorrect' ? wrongQuestions : session.qs;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <AlertCircle size={20} color={THEME.colors.bad} />
          <Text style={styles.title}>Question Review &amp; Claims</Text>
        </View>

        {/* Filter Toggle */}
        <View style={styles.filterSeg}>
          <TouchableOpacity
            style={[
              styles.filterBtn,
              filterMode === 'incorrect' && styles.filterBtnActive,
            ]}
            onPress={() => setFilterMode('incorrect')}
          >
            <Text
              style={[
                styles.filterText,
                filterMode === 'incorrect' && styles.filterTextActive,
              ]}
            >
              Incorrect ({wrongQuestions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterBtn,
              filterMode === 'all' && styles.filterBtnActive,
            ]}
            onPress={() => setFilterMode('all')}
          >
            <Text
              style={[
                styles.filterText,
                filterMode === 'all' && styles.filterTextActive,
              ]}
            >
              All ({session.qs.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Review your responses, check Samhita citations, or challenge any question by clicking "Report/Claim Error":
      </Text>

      {displayedQuestions.length === 0 ? (
        <View style={styles.emptyCard}>
          <CheckCircle2 size={24} color={THEME.colors.ok} />
          <Text style={styles.emptyTitle}>No incorrect questions!</Text>
          <Text style={styles.emptySub}>
            You answered all attempted questions correctly in this session.
          </Text>
          <TouchableOpacity
            style={styles.switchAllBtn}
            onPress={() => setFilterMode('all')}
          >
            <Text style={styles.switchAllText}>View all {session.qs.length} questions</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          {displayedQuestions.map((q, idx) => {
            const chapter = ALL_CHAPTERS[q.ch];
            const userChoice = session.ans[q.id];
            const hasAnswered = userChoice !== undefined;
            const userChoiceLabel = hasAnswered ? OPTION_LABELS[userChoice] : 'None';
            const correctChoiceLabel = OPTION_LABELS[q.c];
            const isCorrect = userChoice === q.c;
            const isClaimed = !!claimedQuestions[q.id];

            // Bilingual stem
            const stemText =
              language === 'hi' && q.hi?.stem
                ? q.hi.stem
                : q.stem;
            const userChoiceText = hasAnswered ? q.o[userChoice] : 'Unattempted';
            const correctChoiceText = q.o[q.c];

            return (
              <View key={q.id} style={styles.item}>
                <View style={styles.itemMeta}>
                  <View style={styles.metaLeft}>
                    <Text style={styles.qBadge}>Q #{idx + 1}</Text>
                    {chapter && (
                      <Text style={styles.chapterText} numberOfLines={1}>
                        {getChapterPath(chapter)}
                      </Text>
                    )}
                  </View>

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

                <Text style={styles.stemText}>{stemText}</Text>

                {/* User choice */}
                <View
                  style={[
                    styles.choiceRow,
                    isCorrect
                      ? styles.choiceRowCorrect
                      : !hasAnswered
                      ? styles.choiceRowUnattempted
                      : styles.choiceRowUser,
                  ]}
                >
                  {isCorrect ? (
                    <CheckCircle2 size={15} color={THEME.colors.ok} />
                  ) : !hasAnswered ? (
                    <HelpCircle size={15} color={THEME.colors.muted} />
                  ) : (
                    <XCircle size={15} color={THEME.colors.bad} />
                  )}
                  <Text
                    style={
                      isCorrect
                        ? styles.choiceTextOk
                        : !hasAnswered
                        ? styles.choiceTextMuted
                        : styles.choiceTextBad
                    }
                  >
                    You chose: {hasAnswered ? `${userChoiceLabel}. ${userChoiceText}` : 'Unattempted (0 marks)'}
                  </Text>
                </View>

                {/* Correct choice if wrong or unattempted */}
                {!isCorrect && (
                  <View style={[styles.choiceRow, styles.choiceRowCorrect]}>
                    <CheckCircle2 size={15} color={THEME.colors.ok} />
                    <Text style={styles.choiceTextOk}>
                      Correct answer: {correctChoiceLabel}. {correctChoiceText}
                    </Text>
                  </View>
                )}

                {/* Samhita Reference */}
                {q.r && (
                  <View style={styles.refBox}>
                    <Text style={styles.refText}>
                      Reference: Charaka Samhita, Sutrasthana {q.r}
                    </Text>
                  </View>
                )}
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
    gap: 10,
    marginBottom: 4,
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
  filterSeg: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.bg,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    overflow: 'hidden',
  },
  filterBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  filterBtnActive: {
    backgroundColor: THEME.colors.brand,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  filterTextActive: {
    color: THEME.colors.brandInk,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.muted,
    marginBottom: 14,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: THEME.colors.soft,
    borderRadius: THEME.radius.md,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginTop: 4,
  },
  emptySub: {
    fontSize: 13,
    color: THEME.colors.muted,
    textAlign: 'center',
  },
  switchAllBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.sm,
  },
  switchAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.brandInk,
  },
  list: {
    gap: 14,
  },
  item: {
    padding: 14,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.bg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    gap: 8,
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
    minWidth: 160,
  },
  qBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.brand,
    backgroundColor: THEME.colors.soft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
  },
  chapterText: {
    fontSize: 12,
    color: THEME.colors.muted,
    flex: 1,
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
  stemText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: THEME.colors.ink,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.sm,
  },
  choiceRowUser: {
    backgroundColor: THEME.colors.badSoft,
  },
  choiceRowCorrect: {
    backgroundColor: THEME.colors.okSoft,
  },
  choiceRowUnattempted: {
    backgroundColor: THEME.colors.soft,
  },
  choiceTextBad: {
    fontSize: 13,
    color: THEME.colors.bad,
    fontWeight: '500',
    flex: 1,
  },
  choiceTextOk: {
    fontSize: 13,
    color: THEME.colors.ok,
    fontWeight: '600',
    flex: 1,
  },
  choiceTextMuted: {
    fontSize: 13,
    color: THEME.colors.muted,
    flex: 1,
  },
  refBox: {
    paddingTop: 4,
  },
  refText: {
    fontSize: 12,
    color: THEME.colors.muted,
    fontStyle: 'italic',
  },
});
