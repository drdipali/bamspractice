import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react-native';
import { THEME, OPTION_LABELS } from '../../constants/theme';
import { ALL_CHAPTERS, getChapterPath } from '../../constants/syllabusData';
import { Language, Question, QuizSession } from '../../types';

interface IncorrectReviewListProps {
  wrongQuestions: Question[];
  session: QuizSession;
  language: Language;
}

export const IncorrectReviewList: React.FC<IncorrectReviewListProps> = ({
  wrongQuestions,
  session,
  language,
}) => {
  if (wrongQuestions.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <AlertCircle size={20} color={THEME.colors.bad} />
        <Text style={styles.title}>
          Incorrect Questions ({wrongQuestions.length})
        </Text>
      </View>
      <Text style={styles.subtitle}>
        Review your mistakes and classical Samhita citations below:
      </Text>

      <View style={styles.list}>
        {wrongQuestions.map((q, idx) => {
          const chapter = ALL_CHAPTERS[q.ch];
          const userChoice = session.ans[q.id];
          const userChoiceLabel =
            userChoice !== undefined ? OPTION_LABELS[userChoice] : 'None';
          const correctChoiceLabel = OPTION_LABELS[q.c];

          // Bilingual stem
          const stemText =
            language === 'hi' && q.hi?.stem
              ? q.hi.stem
              : q.stem;
          const userChoiceText =
            userChoice !== undefined ? q.o[userChoice] : '';
          const correctChoiceText = q.o[q.c];

          return (
            <View key={q.id} style={styles.item}>
              <View style={styles.itemMeta}>
                <Text style={styles.qBadge}>Q #{idx + 1}</Text>
                {chapter && (
                  <Text style={styles.chapterText} numberOfLines={1}>
                    {getChapterPath(chapter)}
                  </Text>
                )}
              </View>

              <Text style={styles.stemText}>{stemText}</Text>

              {/* User choice */}
              <View style={[styles.choiceRow, styles.choiceRowUser]}>
                <XCircle size={15} color={THEME.colors.bad} />
                <Text style={styles.choiceTextBad}>
                  You chose: {userChoiceLabel}. {userChoiceText}
                </Text>
              </View>

              {/* Correct choice */}
              <View style={[styles.choiceRow, styles.choiceRowCorrect]}>
                <CheckCircle2 size={15} color={THEME.colors.ok} />
                <Text style={styles.choiceTextOk}>
                  Correct answer: {correctChoiceLabel}. {correctChoiceText}
                </Text>
              </View>

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
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.muted,
    marginBottom: 14,
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
    gap: 8,
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
  refBox: {
    paddingTop: 4,
  },
  refText: {
    fontSize: 12,
    color: THEME.colors.muted,
    fontStyle: 'italic',
  },
});
