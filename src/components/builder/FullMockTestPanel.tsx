import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import {
  Play,
  Clock,
  Award,
  Layers,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useApp } from '../../context/AppContext';

export const FullMockTestPanel: React.FC = () => {
  const { mockBlueprint, startMockTest, statusMessage } = useApp();
  const [isStarting, setIsStarting] = useState(false);

  const totalQuestions = mockBlueprint.reduce(
    (sum, item) => sum + (item.weightage_questions || 0),
    0
  );
  const maxMarks = totalQuestions * 4;

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await startMockTest();
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Hero Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.ntaBadge}>
            <Award size={13} color="#FFFFFF" />
            <Text style={styles.ntaBadgeText}>NTA AIAPGET PATTERN</Text>
          </View>
          <View style={styles.statusLivePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Official 120Q Blueprint</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>Full-Syllabus AIAPGET Mock Test</Text>
        <Text style={styles.heroSubtitle}>
          Complete 120-minute examination simulating the real entrance exam with competitive marking and high-yield post-test performance diagnosis.
        </Text>

        {/* 4-Stat Metric Strip */}
        <View style={styles.metricGrid}>
          <View style={styles.metricItem}>
            <Layers size={18} color="#2563EB" />
            <Text style={styles.metricVal}>{totalQuestions}</Text>
            <Text style={styles.metricLabel}>Questions</Text>
          </View>

          <View style={styles.metricItem}>
            <Clock size={18} color="#059669" />
            <Text style={styles.metricVal}>120</Text>
            <Text style={styles.metricLabel}>Minutes</Text>
          </View>

          <View style={styles.metricItem}>
            <Award size={18} color="#D97706" />
            <Text style={styles.metricVal}>+4 / -1</Text>
            <Text style={styles.metricLabel}>Marking</Text>
          </View>

          <View style={styles.metricItem}>
            <CheckCircle2 size={18} color="#7C3AED" />
            <Text style={styles.metricVal}>{maxMarks}</Text>
            <Text style={styles.metricLabel}>Max Score</Text>
          </View>
        </View>

        {/* Big Start Exam CTA Button */}
        <TouchableOpacity
          style={[styles.startBtn, isStarting && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={isStarting}
          activeOpacity={0.85}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.startBtnText}>Start Full Mock Test</Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        {statusMessage ? (
          <Text style={styles.statusMsgText}>{statusMessage}</Text>
        ) : null}
      </View>

      {/* Blueprint & Subject Weightage Breakdown */}
      <View style={styles.blueprintCard}>
        <View style={styles.cardHeader}>
          <BookOpen size={18} color={THEME.colors.brand} />
          <Text style={styles.cardTitle}>Subject Weightage Blueprint</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Auto-generated question distribution allocated across key classical Samhitas and core BAMS subjects:
        </Text>

        <View style={styles.subjectList}>
          {mockBlueprint.map((item, idx) => (
            <View key={item.id || idx} style={styles.subjectRow}>
              <View style={styles.subjectMain}>
                <View style={styles.subjectNameRow}>
                  <Text style={styles.subjectName}>{item.subject}</Text>
                  {item.is_high_yield ? (
                    <View style={styles.highYieldBadge}>
                      <Flame size={12} color="#DC2626" />
                      <Text style={styles.highYieldText}>High Yield</Text>
                    </View>
                  ) : (
                    <View style={styles.standardBadge}>
                      <Text style={styles.standardText}>Standard</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.subjectSub}>
                  {item.weightage_questions} MCQs · {item.weightage_questions * 4} Marks
                </Text>
              </View>

              <View style={styles.weightagePill}>
                <Text style={styles.weightageNum}>{item.weightage_questions}</Text>
                <Text style={styles.weightageLabel}>Qs</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.blueprintTotalRow}>
          <Text style={styles.blueprintTotalLabel}>Total Examination Pool</Text>
          <Text style={styles.blueprintTotalVal}>{totalQuestions} Questions (100%)</Text>
        </View>
      </View>

      {/* Exam Rules & Marking Scheme */}
      <View style={styles.rulesCard}>
        <View style={styles.cardHeader}>
          <AlertTriangle size={18} color="#D97706" />
          <Text style={styles.cardTitle}>Examination Rules & Marking Guidelines</Text>
        </View>

        <View style={styles.ruleItem}>
          <CheckCircle2 size={16} color="#059669" />
          <Text style={styles.ruleText}>
            <Text style={styles.ruleHighlight}>+4 Marks</Text> awarded for each correct answer.
          </Text>
        </View>

        <View style={styles.ruleItem}>
          <AlertTriangle size={16} color="#DC2626" />
          <Text style={styles.ruleText}>
            <Text style={styles.ruleHighlightBad}>-1 Mark</Text> deducted for every wrong answer (Negative Marking).
          </Text>
        </View>

        <View style={styles.ruleItem}>
          <CheckCircle2 size={16} color="#64748B" />
          <Text style={styles.ruleText}>
            <Text style={styles.ruleHighlight}>0 Marks</Text> for unattempted or unanswered questions.
          </Text>
        </View>

        <View style={styles.ruleItem}>
          <Clock size={16} color="#2563EB" />
          <Text style={styles.ruleText}>
            120-minute timed clock runs automatically. Instant comprehensive analysis with High-Yield weak area identification upon submission.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  ntaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ntaBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statusLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  heroTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 18,
  },
  metricGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.ink,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#166534',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 10,
    shadowColor: '#166534',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  startBtnDisabled: {
    opacity: 0.7,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  statusMsgText: {
    marginTop: 10,
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
  },
  blueprintCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 17,
  },
  subjectList: {
    gap: 8,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  subjectMain: {
    flex: 1,
  },
  subjectNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  subjectName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.ink,
  },
  highYieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  highYieldText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  standardBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  standardText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  subjectSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  weightagePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    minWidth: 44,
  },
  weightageNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  weightageLabel: {
    fontSize: 9,
    color: '#60A5FA',
    fontWeight: '600',
  },
  blueprintTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  blueprintTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  blueprintTotalVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  rulesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  ruleText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    flex: 1,
  },
  ruleHighlight: {
    fontWeight: '700',
    color: '#166534',
  },
  ruleHighlightBad: {
    fontWeight: '700',
    color: '#DC2626',
  },
});
