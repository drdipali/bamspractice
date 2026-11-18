import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Award } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { QuizResults } from '../../types';

interface ScorecardProps {
  results: QuizResults;
}

export const Scorecard: React.FC<ScorecardProps> = ({ results }) => {
  const mins = Math.floor(results.timeSpentSecs / 60);
  const secs = results.timeSpentSecs % 60;
  const timeFormatted = `${mins}m ${secs}s`;

  const isPositive = results.score >= 0;

  return (
    <View style={styles.container}>
      {/* Prominent Competitive Total Score Card */}
      <View style={styles.scoreBanner}>
        <View style={styles.scoreHeaderRow}>
          <View style={styles.scoreTitleGroup}>
            <Award size={20} color={THEME.colors.brandInk} />
            <Text style={styles.scoreBannerTitle}>Total Score (AIAPGET Marking)</Text>
          </View>
          <View style={styles.markingPill}>
            <Text style={styles.markingPillText}>+4 / -1</Text>
          </View>
        </View>

        <View style={styles.scoreMainRow}>
          <Text style={styles.scoreDisplay}>
            Score: {results.score}{' '}
            <Text style={styles.scoreMax}>/ {results.maxScore}</Text>
          </Text>
          <View style={styles.percentageBadge}>
            <Text style={styles.percentageText}>
              {results.scorePercent}%
            </Text>
          </View>
        </View>

        <Text style={styles.markingSchemeSub}>
          +4 for correct (+{results.correct * 4}) · -1 for incorrect (-{results.incorrect * 1}) · 0 for unattempted
        </Text>
      </View>

      {/* Grid of sub-metrics */}
      <View style={styles.grid}>
        {/* Correct */}
        <View style={[styles.card, styles.cardOk]}>
          <Text style={[styles.statNumber, styles.textOk]}>{results.correct}</Text>
          <Text style={styles.statLabel}>Correct (+4)</Text>
        </View>

        {/* Incorrect */}
        <View style={[styles.card, styles.cardBad]}>
          <Text style={[styles.statNumber, styles.textBad]}>{results.incorrect}</Text>
          <Text style={styles.statLabel}>Incorrect (-1)</Text>
        </View>

        {/* Unattempted */}
        <View style={styles.card}>
          <Text style={styles.statNumber}>{results.unattempted}</Text>
          <Text style={styles.statLabel}>Unattempted (0)</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  scoreBanner: {
    backgroundColor: THEME.colors.brand,
    borderRadius: THEME.radius.lg,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.brandInk,
    letterSpacing: 0.2,
  },
  markingPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.pill,
  },
  markingPillText: {
    color: THEME.colors.brandInk,
    fontSize: 11,
    fontWeight: '700',
  },
  scoreMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginVertical: 4,
  },
  scoreDisplay: {
    fontFamily: THEME.fonts.serif,
    fontSize: 34,
    fontWeight: '800',
    color: THEME.colors.brandInk,
  },
  scoreMax: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  percentageBadge: {
    backgroundColor: THEME.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: THEME.radius.pill,
  },
  percentageText: {
    color: '#16241F',
    fontSize: 12,
    fontWeight: '800',
  },
  markingSchemeSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    flex: 1,
    minWidth: 95,
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
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.ink,
    lineHeight: 28,
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
    fontSize: 11,
    color: THEME.colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
});
