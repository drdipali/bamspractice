import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { QuizSession } from '../../types';

interface QuestionPaletteProps {
  session: QuizSession;
  onJump: (index: number) => void;
}

export const QuestionPalette: React.FC<QuestionPaletteProps> = ({
  session,
  onJump,
}) => {
  const isLearning = session.mode === 'learning';
  const total = session.qs.length;
  const answeredCount = Object.keys(session.ans).length;
  const markedCount = Object.values(session.rev).filter(Boolean).length;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Question Palette</Text>
        <Text style={styles.countText}>
          {answeredCount}/{total} Answered
        </Text>
      </View>

      {/* Grid of question buttons */}
      <View style={styles.grid}>
        {session.qs.map((q, idx) => {
          const isCurrent = idx === session.i;
          const isMarked = !!session.rev[q.id];
          const hasAnswer = session.ans[q.id] !== undefined;
          const isSubmitted = isLearning && !!session.sub[q.id];
          const isCorrect = isSubmitted && session.ans[q.id] === q.c;
          const isIncorrect =
            isSubmitted &&
            session.ans[q.id] !== undefined &&
            session.ans[q.id] !== q.c;
          const isSkipped = isSubmitted && session.ans[q.id] === undefined;

          let tileStyle = styles.tileDefault;
          let textStyle = styles.tileTextDefault;

          if (isCorrect) {
            tileStyle = styles.tileCorrect;
            textStyle = styles.tileTextLight;
          } else if (isIncorrect) {
            tileStyle = styles.tileIncorrect;
            textStyle = styles.tileTextLight;
          } else if (isSkipped) {
            tileStyle = styles.tileSkipped;
            textStyle = styles.tileTextSkipped;
          } else if (hasAnswer) {
            tileStyle = styles.tileAnswered;
            textStyle = styles.tileTextAnswered;
          }

          return (
            <TouchableOpacity
              key={q.id}
              style={[
                styles.tile,
                tileStyle,
                isCurrent && styles.tileCurrent,
                isMarked && styles.tileMarked,
              ]}
              onPress={() => onJump(idx)}
              activeOpacity={0.7}
            >
              {isMarked && (
                <View style={styles.markedDot}>
                  <Bookmark size={8} color={THEME.colors.accent} />
                </View>
              )}
              <Text style={[styles.tileText, textStyle, isCurrent && styles.tileTextCurrent]}>
                {idx + 1}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend & Stats */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.tileAnswered]} />
          <Text style={styles.legendText}>Answered</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.tileMarkedBox]} />
          <Text style={styles.legendText}>Review</Text>
        </View>
        {isLearning && (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.tileCorrect]} />
              <Text style={styles.legendText}>Correct</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.tileIncorrect]} />
              <Text style={styles.legendText}>Wrong</Text>
            </View>
          </>
        )}
      </View>

      <Text style={styles.summaryText}>
        {answeredCount} answered · {markedCount} marked for review
      </Text>
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  tile: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.line,
    position: 'relative',
  },
  tileDefault: {
    backgroundColor: THEME.colors.surface,
  },
  tileCurrent: {
    borderColor: THEME.colors.ink,
    borderWidth: 2,
    backgroundColor: THEME.colors.soft,
  },
  tileAnswered: {
    backgroundColor: THEME.colors.soft,
    borderColor: THEME.colors.brand,
  },
  tileMarked: {
    borderBottomWidth: 3,
    borderBottomColor: THEME.colors.accent,
  },
  markedDot: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  tileCorrect: {
    backgroundColor: THEME.colors.ok,
    borderColor: THEME.colors.ok,
  },
  tileIncorrect: {
    backgroundColor: THEME.colors.bad,
    borderColor: THEME.colors.bad,
  },
  tileSkipped: {
    backgroundColor: THEME.colors.bg,
    borderColor: THEME.colors.line,
    borderWidth: 1,
  },
  tileTextSkipped: {
    color: THEME.colors.muted,
  },
  tileText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tileTextDefault: {
    color: THEME.colors.ink,
  },
  tileTextCurrent: {
    fontWeight: '800',
    color: THEME.colors.brand,
  },
  tileTextAnswered: {
    color: THEME.colors.brand,
  },
  tileTextLight: {
    color: '#FFFFFF',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  tileMarkedBox: {
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 3,
    borderBottomColor: THEME.colors.accent,
  },
  legendText: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
  summaryText: {
    fontSize: 12,
    color: THEME.colors.muted,
  },
});
