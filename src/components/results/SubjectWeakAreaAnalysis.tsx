import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Flame, AlertTriangle, CheckCircle2, TrendingUp, Info } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { SubjectAccuracyStat } from '../../types';

interface SubjectWeakAreaAnalysisProps {
  statsBySubject?: Record<string, SubjectAccuracyStat>;
  isMockTest?: boolean;
}

export const SubjectWeakAreaAnalysis: React.FC<SubjectWeakAreaAnalysisProps> = ({
  statsBySubject,
  isMockTest,
}) => {
  if (!statsBySubject || Object.keys(statsBySubject).length === 0) {
    return null;
  }

  const allSubjects = Object.values(statsBySubject).filter((s) => s.total > 0);
  if (allSubjects.length === 0) return null;

  // 1. High-Yield Weak Areas: < 50% accuracy AND is_high_yield === true
  const highYieldWeak = allSubjects.filter(
    (s) => s.accuracy < 50 && s.is_high_yield
  );

  // 2. Secondary Weak Areas: < 50% accuracy AND is_high_yield === false
  const secondaryWeak = allSubjects.filter(
    (s) => s.accuracy < 50 && !s.is_high_yield
  );

  // 3. Strong Areas: >= 75% accuracy
  const strongAreas = allSubjects.filter((s) => s.accuracy >= 75);

  // 4. Moderate / Average Areas: 50% <= accuracy < 75%
  const moderateAreas = allSubjects.filter(
    (s) => s.accuracy >= 50 && s.accuracy < 75
  );

  const renderSubjectCard = (
    stat: SubjectAccuracyStat,
    variant: 'danger' | 'warning' | 'success' | 'info'
  ) => {
    const isDanger = variant === 'danger';
    const isWarning = variant === 'warning';
    const isSuccess = variant === 'success';

    const barColor = isDanger
      ? '#DC2626'
      : isWarning
      ? '#D97706'
      : isSuccess
      ? '#059669'
      : '#2563EB';

    const textColor = isDanger
      ? '#DC2626'
      : isWarning
      ? '#B45309'
      : isSuccess
      ? '#047857'
      : '#1D4ED8';

    return (
      <View key={stat.subject} style={styles.subjectRow}>
        <View style={styles.subjectInfoCol}>
          <View style={styles.subjectTitleRow}>
            <Text style={styles.subjectTitle}>{stat.subject}</Text>
            {stat.is_high_yield && (
              <View style={styles.miniFlameBadge}>
                <Flame size={11} color="#DC2626" />
                <Text style={styles.miniFlameText}>High Yield</Text>
              </View>
            )}
          </View>
          <Text style={styles.subjectBreakdown}>
            {stat.correct} correct · {stat.incorrect} wrong · {stat.unattempted} skipped ({stat.total} Qs)
          </Text>
        </View>

        {/* Progress bar & Percent */}
        <View style={styles.progressCol}>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.max(4, stat.accuracy)}%`, backgroundColor: barColor },
              ]}
            />
          </View>
          <Text style={[styles.percentLabel, { color: textColor }]}>
            {stat.accuracy}%
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <TrendingUp size={20} color={THEME.colors.brand} />
        <Text style={styles.sectionTitle}>
          {isMockTest ? 'Full-Syllabus Weak Area & Topic Diagnosis' : 'Subject Accuracy & Revision Focus'}
        </Text>
      </View>

      {/* 🔴 Section 1: High-Yield Weak Areas (Priority Revision) */}
      {highYieldWeak.length > 0 && (
        <View style={[styles.categoryCard, styles.cardDanger]}>
          <View style={styles.cardTopHeader}>
            <View style={styles.categoryTitleRow}>
              <Flame size={18} color="#DC2626" />
              <Text style={styles.dangerTitle}>🔴 High-Yield Weak Areas (Priority Revision)</Text>
            </View>
            <View style={styles.urgencyPill}>
              <Text style={styles.urgencyPillText}>Critical Priority</Text>
            </View>
          </View>

          <View style={styles.adviceBoxDanger}>
            <AlertTriangle size={15} color="#DC2626" />
            <Text style={styles.adviceTextDanger}>
              <Text style={styles.adviceBold}>Immediate Action Recommended: </Text>
              These topics carry maximum weightage in AIAPGET (over 60% of question pool) but scored below 50% accuracy. Revise classical shlokas, samkhya tables, and diagnostic criteria for these subjects before attempting another test.
            </Text>
          </View>

          <View style={styles.subjectsContainer}>
            {highYieldWeak.map((s) => renderSubjectCard(s, 'danger'))}
          </View>
        </View>
      )}

      {/* 🟡 Section 2: Secondary Weak Areas */}
      {secondaryWeak.length > 0 && (
        <View style={[styles.categoryCard, styles.cardWarning]}>
          <View style={styles.cardTopHeader}>
            <View style={styles.categoryTitleRow}>
              <AlertTriangle size={17} color="#D97706" />
              <Text style={styles.warningTitle}>🟡 Secondary Weak Areas (&lt; 50% Accuracy)</Text>
            </View>
            <View style={styles.secondaryPill}>
              <Text style={styles.secondaryPillText}>Secondary Priority</Text>
            </View>
          </View>

          <View style={styles.adviceBoxWarning}>
            <Info size={14} color="#B45309" />
            <Text style={styles.adviceTextWarning}>
              <Text style={styles.adviceBold}>Study Advice: </Text>
              These subjects scored below 50%. Consolidate fundamental concepts here once high-yield subjects are thoroughly revised.
            </Text>
          </View>

          <View style={styles.subjectsContainer}>
            {secondaryWeak.map((s) => renderSubjectCard(s, 'warning'))}
          </View>
        </View>
      )}

      {/* 🔵 Section 3: Moderate Areas (50% - 74%) */}
      {moderateAreas.length > 0 && (
        <View style={[styles.categoryCard, styles.cardInfo]}>
          <View style={styles.cardTopHeader}>
            <View style={styles.categoryTitleRow}>
              <TrendingUp size={17} color="#2563EB" />
              <Text style={styles.infoTitle}>🔵 Moderate Performance (50% – 74% Accuracy)</Text>
            </View>
          </View>

          <View style={styles.subjectsContainer}>
            {moderateAreas.map((s) => renderSubjectCard(s, 'info'))}
          </View>
        </View>
      )}

      {/* 🟢 Section 4: Strong Areas (>= 75%) */}
      {strongAreas.length > 0 && (
        <View style={[styles.categoryCard, styles.cardSuccess]}>
          <View style={styles.cardTopHeader}>
            <View style={styles.categoryTitleRow}>
              <CheckCircle2 size={17} color="#059669" />
              <Text style={styles.successTitle}>🟢 Strong Areas (≥ 75% Accuracy)</Text>
            </View>
            <View style={styles.successPill}>
              <Text style={styles.successPillText}>Exam-Ready</Text>
            </View>
          </View>

          <View style={styles.adviceBoxSuccess}>
            <CheckCircle2 size={14} color="#047857" />
            <Text style={styles.adviceTextSuccess}>
              Excellent mastery demonstrated in these topics! Maintain your sharpness with periodic spaced flashcard reviews.
            </Text>
          </View>

          <View style={styles.subjectsContainer}>
            {strongAreas.map((s) => renderSubjectCard(s, 'success'))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardDanger: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  cardWarning: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  cardInfo: {
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
  },
  cardSuccess: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  cardTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
  },
  urgencyPill: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  urgencyPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  secondaryPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  secondaryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  successPill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  successPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  adviceBoxDanger: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  adviceTextDanger: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 17,
  },
  adviceBoxWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  adviceTextWarning: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  adviceBoxSuccess: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#D1FAE5',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  adviceTextSuccess: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    lineHeight: 17,
  },
  adviceBold: {
    fontWeight: '700',
  },
  subjectsContainer: {
    gap: 8,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subjectInfoCol: {
    flex: 1.5,
  },
  subjectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  subjectTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.ink,
  },
  miniFlameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  miniFlameText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  subjectBreakdown: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  progressCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentLabel: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
