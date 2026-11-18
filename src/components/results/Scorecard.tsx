import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../../constants/theme';
import { QuizResults } from '../../types';

interface ScorecardProps {
  results: QuizResults;
}

export const Scorecard: React.FC<ScorecardProps> = ({ results }) => {
  const mins = Math.floor(results.timeSpentSecs / 60);
  const secs = results.timeSpentSecs % 60;
  const timeFormatted = `${mins}m ${secs}s`;

  return (
    <View style={styles.grid}>
      {/* Correct */}
      <View style={[styles.card, styles.cardOk]}>
        <Text style={[styles.statNumber, styles.textOk]}>{results.correct}</Text>
        <Text style={styles.statLabel}>Correct</Text>
      </View>

      {/* Incorrect */}
      <View style={[styles.card, styles.cardBad]}>
        <Text style={[styles.statNumber, styles.textBad]}>{results.incorrect}</Text>
        <Text style={styles.statLabel}>Incorrect</Text>
      </View>

      {/* Unattempted */}
      <View style={styles.card}>
        <Text style={styles.statNumber}>{results.unattempted}</Text>
        <Text style={styles.statLabel}>Unattempted</Text>
      </View>

      {/* Accuracy */}
      <View style={styles.card}>
        <Text style={[styles.statNumber, styles.textBrand]}>
          {results.accuracy}%
        </Text>
        <Text style={styles.statLabel}>Accuracy</Text>
      </View>

      {/* Time Spent */}
      <View style={styles.card}>
        <Text style={styles.statNumber}>{timeFormatted}</Text>
        <Text style={styles.statLabel}>Time spent</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 14,
  },
  card: {
    flex: 1,
    minWidth: 100,
    backgroundColor: THEME.colors.soft,
    borderRadius: THEME.radius.md,
    padding: 12,
  },
  cardOk: {
    backgroundColor: THEME.colors.okSoft,
  },
  cardBad: {
    backgroundColor: THEME.colors.badSoft,
  },
  statNumber: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    fontWeight: '700',
    color: THEME.colors.ink,
    lineHeight: 30,
  },
  textOk: {
    color: THEME.colors.ok,
  },
  textBad: {
    color: THEME.colors.bad,
  },
  textBrand: {
    color: THEME.colors.brand,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
});
