import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RotateCcw, ArrowLeft, Trophy, CheckCircle2, X } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { Scorecard } from './Scorecard';
import { ChapterAccuracyList } from './ChapterAccuracyList';
import { IncorrectReviewList } from './IncorrectReviewList';
import { ClaimQuestionModal } from './ClaimQuestionModal';
import { Question } from '../../types';

export const ResultsScreen: React.FC = () => {
  const { results, session, language, reattemptIncorrect, backToBuilder } =
    useApp();

  const [activeClaimQuestion, setActiveClaimQuestion] = useState<Question | null>(null);
  const [claimedQuestions, setClaimedQuestions] = useState<Record<number, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (!results || !session) return null;

  const modeTitle =
    session.mode === 'learning' ? 'Learning Mode' : 'Test Mode';

  const handleClaimPress = (question: Question) => {
    setActiveClaimQuestion(question);
  };

  const handleClaimSubmit = (questionId: number, comment: string, fileName?: string) => {
    // Record claim
    setClaimedQuestions((prev) => ({ ...prev, [questionId]: true }));
    setActiveClaimQuestion(null);
    setToastMessage('Your claim has been submitted for review.');
  };

  return (
    <View style={styles.container}>
      <Header
        title="Session Results"
        subtitle={`${modeTitle} · ${results.total} questions`}
        rightAction={
          <TouchableOpacity style={styles.backTopBtn} onPress={backToBuilder}>
            <ArrowLeft size={16} color={THEME.colors.brand} />
            <Text style={styles.backTopBtnText}>Builder</Text>
          </TouchableOpacity>
        }
      />

      {/* Floating Success Toast */}
      {toastMessage && (
        <View style={styles.toast}>
          <CheckCircle2 size={18} color={THEME.colors.ok} />
          <Text style={styles.toastText}>{toastMessage}</Text>
          <TouchableOpacity
            onPress={() => setToastMessage(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} color={THEME.colors.muted} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrapper}>
          {/* Main Results Panel */}
          <View style={styles.panel}>
            <View style={styles.trophyRow}>
              <Trophy size={24} color={THEME.colors.accent} />
              <Text style={styles.panelTitle}>Performance Summary</Text>
            </View>

            {/* Scorecard with Competitive Scoring */}
            <Scorecard results={results} />

            {/* Accuracy by Chapter */}
            <ChapterAccuracyList statsByChapter={results.byChapter} />

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  results.wrongQuestions.length === 0 && styles.btnDisabled,
                ]}
                disabled={results.wrongQuestions.length === 0}
                onPress={reattemptIncorrect}
              >
                <RotateCcw size={16} color={THEME.colors.brandInk} />
                <Text style={styles.primaryBtnText}>
                  Reattempt {results.wrongQuestions.length} incorrect
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={backToBuilder}
              >
                <ArrowLeft size={16} color={THEME.colors.brand} />
                <Text style={styles.secondaryBtnText}>Back to builder</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Detailed Incorrect Questions Review with Claim / Report Error Feature */}
          <IncorrectReviewList
            wrongQuestions={results.wrongQuestions}
            session={session}
            language={language}
            claimedQuestions={claimedQuestions}
            onClaimPress={handleClaimPress}
          />
        </View>
      </ScrollView>

      {/* Claim / Report Question Modal */}
      <ClaimQuestionModal
        visible={activeClaimQuestion !== null}
        question={activeClaimQuestion}
        onClose={() => setActiveClaimQuestion(null)}
        onSubmit={handleClaimSubmit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.okSoft,
    borderWidth: 1,
    borderColor: THEME.colors.ok,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.ok,
  },
  backTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.soft,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.md,
  },
  backTopBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  contentWrapper: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  panel: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    padding: 16,
    marginBottom: 16,
  },
  trophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  panelTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  primaryBtn: {
    flex: 1.5,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
  },
  primaryBtnText: {
    color: THEME.colors.brandInk,
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
  },
  secondaryBtnText: {
    color: THEME.colors.brand,
    fontWeight: '600',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
