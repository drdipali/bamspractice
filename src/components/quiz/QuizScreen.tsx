import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Bookmark,
  CheckCircle,
  LayoutGrid,
  Info,
} from 'lucide-react-native';
import { THEME, DIFFICULTY_LABELS, OPTION_LABELS } from '../../constants/theme';
import { ALL_CHAPTERS, getChapterPath } from '../../constants/syllabusData';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { QuizTimer } from './QuizTimer';
import { QuestionStem } from './QuestionStem';
import { OptionList } from './OptionList';
import { QuestionPalette } from './QuestionPalette';

export const QuizScreen: React.FC = () => {
  const {
    session,
    language,
    answerQuestion,
    submitQuestion,
    toggleMarkReview,
    jumpToQuestion,
    nextQuestion,
    prevQuestion,
    finishQuiz,
  } = useApp();

  const { width } = useWindowDimensions();
  const isTablet = width >= 860;
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  if (!session) return null;

  const currentQ = session.qs[session.i];
  const chapter = currentQ ? ALL_CHAPTERS[currentQ.ch] : null;
  const isLearning = session.mode === 'learning';
  const isLocked = !!session.sub[currentQ?.id];
  const selectedAnswer = session.ans[currentQ?.id];
  const isMarked = !!session.rev[currentQ?.id];

  const totalQuestions = session.qs.length;
  const answeredCount = Object.keys(session.ans).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  const handleFinishPress = () => {
    const unattempted = totalQuestions - answeredCount;
    if (unattempted > 0) {
      Alert.alert(
        'Finish Practice Session?',
        `You have ${unattempted} unattempted question${unattempted > 1 ? 's' : ''}. Unanswered questions will count as unattempted in your final score.`,
        [
          { text: 'Keep Practicing', style: 'cancel' },
          { text: 'Finish Now', style: 'destructive', onPress: finishQuiz },
        ]
      );
    } else {
      finishQuiz();
    }
  };

  const finishButton = (
    <TouchableOpacity style={styles.finishBtn} onPress={handleFinishPress}>
      <Text style={styles.finishBtnText}>Finish &amp; Results</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header
        title={isLearning ? 'Learning Mode' : 'Test Mode'}
        subtitle={`Session started · ${totalQuestions} questions`}
        rightAction={finishButton}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentTablet,
        ]}
      >
        <View style={[styles.mainLayout, isTablet && styles.mainLayoutTablet]}>
          {/* Left Column: Active Question */}
          <View style={[styles.questionCol, isTablet && styles.questionColTablet]}>
            <View style={styles.questionCard}>
              {/* Question Metadata Row */}
              <View style={styles.metaRow}>
                <Text style={styles.qIndexText}>
                  Question {session.i + 1} of {totalQuestions}
                </Text>
                {chapter && (
                  <Text style={styles.chapterBreadcrumb} numberOfLines={1}>
                    {getChapterPath(chapter)}
                  </Text>
                )}
                <View style={styles.metaRight}>
                  <View style={styles.diffPill}>
                    <Text style={styles.diffPillText}>
                      {DIFFICULTY_LABELS[currentQ.d]}
                    </Text>
                  </View>
                  <QuizTimer startTime={session.t0} />
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent}%` },
                  ]}
                />
              </View>

              {/* Question Stem */}
              <QuestionStem question={currentQ} language={language} />

              {/* Option List */}
              <OptionList
                question={currentQ}
                language={language}
                selectedIndex={selectedAnswer}
                isLocked={isLearning && isLocked}
                onSelect={answerQuestion}
              />

              {/* Learning Mode Explanation Box */}
              {isLearning && isLocked && (
                <View
                  style={[
                    styles.explanationBox,
                    selectedAnswer === currentQ.c
                      ? styles.explanationCorrect
                      : styles.explanationIncorrect,
                  ]}
                >
                  <View style={styles.explanationHeader}>
                    <Info
                      size={16}
                      color={
                        selectedAnswer === currentQ.c
                          ? THEME.colors.ok
                          : THEME.colors.bad
                      }
                    />
                    <Text
                      style={[
                        styles.explanationTitle,
                        selectedAnswer === currentQ.c
                          ? styles.textOk
                          : styles.textBad,
                      ]}
                    >
                      {selectedAnswer === currentQ.c
                        ? 'Correct Answer!'
                        : `Incorrect. Correct answer is Option ${OPTION_LABELS[currentQ.c]}.`}
                    </Text>
                  </View>
                  <Text style={styles.explanationRef}>
                    {currentQ.r
                      ? `Authoritative Reference: ${currentQ.r}`
                      : 'Reference: Classical Samhita authentic source principle.'}
                  </Text>
                </View>
              )}

              {/* Control Action Buttons */}
              <View style={styles.controlsRow}>
                {isLearning && !isLocked ? (
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      selectedAnswer === undefined && styles.btnDisabled,
                    ]}
                    disabled={selectedAnswer === undefined}
                    onPress={submitQuestion}
                  >
                    <CheckCircle size={16} color={THEME.colors.brandInk} />
                    <Text style={styles.submitBtnText}>Submit Answer</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.navRow}>
                  <TouchableOpacity
                    style={[
                      styles.navBtn,
                      session.i === 0 && styles.btnDisabled,
                    ]}
                    disabled={session.i === 0}
                    onPress={prevQuestion}
                  >
                    <ChevronLeft size={16} color={THEME.colors.brand} />
                    <Text style={styles.navBtnText}>Previous</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.navBtn,
                      session.i === totalQuestions - 1 && styles.btnDisabled,
                    ]}
                    disabled={session.i === totalQuestions - 1}
                    onPress={nextQuestion}
                  >
                    <Text style={styles.navBtnText}>Next</Text>
                    <ChevronRight size={16} color={THEME.colors.brand} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.reviewBtn,
                      isMarked && styles.reviewBtnActive,
                    ]}
                    onPress={toggleMarkReview}
                  >
                    <Bookmark
                      size={15}
                      color={
                        isMarked
                          ? THEME.colors.accent
                          : THEME.colors.muted
                      }
                    />
                    <Text
                      style={[
                        styles.reviewBtnText,
                        isMarked && styles.reviewBtnTextActive,
                      ]}
                    >
                      {isMarked ? 'Marked' : 'Review'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Mobile Palette Toggle */}
              {!isTablet && (
                <TouchableOpacity
                  style={styles.paletteToggleBtn}
                  onPress={() => setShowMobilePalette((prev) => !prev)}
                >
                  <LayoutGrid size={16} color={THEME.colors.brand} />
                  <Text style={styles.paletteToggleText}>
                    {showMobilePalette
                      ? 'Hide Question Palette'
                      : `View Question Palette (${answeredCount}/${totalQuestions})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Mobile Expandable Palette */}
            {!isTablet && showMobilePalette && (
              <View style={styles.mobilePaletteWrapper}>
                <QuestionPalette session={session} onJump={jumpToQuestion} />
              </View>
            )}
          </View>

          {/* Right Column: Question Palette (Tablets & Desktop) */}
          {isTablet && (
            <View style={styles.paletteColTablet}>
              <QuestionPalette session={session} onJump={jumpToQuestion} />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  finishBtn: {
    backgroundColor: THEME.colors.soft,
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.md,
  },
  finishBtnText: {
    color: THEME.colors.brand,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentTablet: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  mainLayout: {
    gap: 16,
  },
  mainLayoutTablet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  questionCol: {
    flex: 1,
  },
  questionColTablet: {
    flex: 1.4,
  },
  paletteColTablet: {
    flex: 0.9,
    maxWidth: 360,
  },
  questionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    padding: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  qIndexText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  chapterBreadcrumb: {
    fontSize: 12,
    color: THEME.colors.muted,
    flex: 1,
    paddingHorizontal: 6,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  diffPill: {
    backgroundColor: THEME.colors.soft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.pill,
  },
  diffPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: THEME.colors.soft,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.brand,
  },
  explanationBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: THEME.radius.md,
    borderLeftWidth: 4,
    gap: 4,
  },
  explanationCorrect: {
    backgroundColor: THEME.colors.okSoft,
    borderLeftColor: THEME.colors.ok,
  },
  explanationIncorrect: {
    backgroundColor: THEME.colors.badSoft,
    borderLeftColor: THEME.colors.bad,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  textOk: {
    color: THEME.colors.ok,
  },
  textBad: {
    color: THEME.colors.bad,
  },
  explanationRef: {
    fontSize: 12,
    color: THEME.colors.inkLight,
    lineHeight: 18,
    marginTop: 2,
  },
  controlsRow: {
    marginTop: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    paddingTop: 14,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.brand,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  submitBtnText: {
    color: THEME.colors.brandInk,
    fontWeight: '700',
    fontSize: 14,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    backgroundColor: 'transparent',
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    backgroundColor: THEME.colors.bg,
  },
  reviewBtnActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.accentSoft,
  },
  reviewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  reviewBtnTextActive: {
    color: THEME.colors.accent,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  paletteToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.soft,
  },
  paletteToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  mobilePaletteWrapper: {
    marginTop: 14,
  },
});
