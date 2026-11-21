import React, { useState } from 'react';
import {
  Alert,
  Modal,
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
  AlertCircle,
  XCircle,
  HelpCircle,
} from 'lucide-react-native';
import { THEME, DIFFICULTY_LABELS, OPTION_LABELS } from '../../constants/theme';
import { getChapterPath } from '../../constants/syllabusData';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { QuizTimer } from './QuizTimer';
import { QuestionStem } from './QuestionStem';
import { OptionList } from './OptionList';
import { QuestionPalette } from './QuestionPalette';
import { isPlaceholderCitation } from '../../utils/chapterMapper';

export const QuizScreen: React.FC = () => {
  const {
    session,
    chapters,
    language,
    answerQuestion,
    unattemptQuestion,
    submitQuestion,
    toggleMarkReview,
    jumpToQuestion,
    nextQuestion,
    prevQuestion,
    finishQuiz,
    toggleBookmark,
    isBookmarked,
  } = useApp();

  const { width } = useWindowDimensions();
  const isTablet = width >= 860;
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);

  if (!session) return null;

  const currentQ = session.qs[session.i];
  const chapter = currentQ
    ? chapters.find((c) => c.id === currentQ.ch || c.name === currentQ.ch)
    : null;
  const isLearning = session.mode === 'learning';
  const isLocked = !!session.sub[currentQ?.id];
  const selectedAnswer = session.ans[currentQ?.id];
  const isMarked = !!session.rev[currentQ?.id];
  const isCurrentBookmarked = currentQ ? isBookmarked(currentQ.id) : false;

  const totalQuestions = session.qs.length;
  const answeredCount = Object.keys(session.ans).length;
  const unattemptedCount = totalQuestions - answeredCount;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  const handleFinishPress = () => {
    // If all questions are answered, proceed directly to Results screen.
    // If there are unanswered questions, show confirmation modal.
    if (unattemptedCount > 0) {
      setShowWarningModal(true);
    } else {
      finishQuiz();
    }
  };

  const finishButton = (
    <TouchableOpacity
      style={styles.finishBtn}
      onPress={handleFinishPress}
      activeOpacity={0.7}
    >
      <Text style={styles.finishBtnText}>Finish &amp; see results</Text>
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
                <Text style={styles.chapterBreadcrumb} numberOfLines={1}>
                  {currentQ.chapterName || (chapter ? getChapterPath(chapter) : `Chapter ${currentQ.ch}`)}
                </Text>
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
                      : selectedAnswer === undefined
                      ? styles.explanationUnattempted
                      : styles.explanationIncorrect,
                  ]}
                >
                  <View style={styles.explanationHeader}>
                    <Info
                      size={16}
                      color={
                        selectedAnswer === currentQ.c
                          ? THEME.colors.ok
                          : selectedAnswer === undefined
                          ? THEME.colors.accent
                          : THEME.colors.bad
                      }
                    />
                    <Text
                      style={[
                        styles.explanationTitle,
                        selectedAnswer === currentQ.c
                          ? styles.textOk
                          : selectedAnswer === undefined
                          ? styles.textAccent
                          : styles.textBad,
                      ]}
                    >
                      {selectedAnswer === currentQ.c
                        ? 'Correct Answer! (+4 marks)'
                        : selectedAnswer === undefined
                        ? `Unattempted (0 marks). Correct answer is Option ${OPTION_LABELS[currentQ.c]}.`
                        : `Incorrect (-1 mark). Correct answer is Option ${OPTION_LABELS[currentQ.c]}.`}
                    </Text>
                  </View>
                  <Text style={styles.explanationRef}>
                    {currentQ.r && !isPlaceholderCitation(currentQ.r, currentQ.chapterName)
                      ? `Authoritative Reference: ${currentQ.r}`
                      : 'Reference: Classical Samhita authentic source principle.'}
                  </Text>
                </View>
              )}

              {/* Control Action Buttons */}
              <View style={styles.controlsRow}>
                {/* Learning Mode Question Actions */}
                {isLearning && !isLocked && (
                  <View style={styles.submitSection}>
                    {selectedAnswer !== undefined ? (
                      <>
                        <TouchableOpacity
                          style={styles.submitBtn}
                          onPress={submitQuestion}
                        >
                          <CheckCircle size={16} color={THEME.colors.brandInk} />
                          <Text style={styles.submitBtnText}>Submit Answer</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.clearChoiceBtn}
                          onPress={unattemptQuestion}
                        >
                          <XCircle size={14} color={THEME.colors.muted} />
                          <Text style={styles.clearChoiceText}>
                            Clear selection / Leave unattempted
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={styles.skipUnattemptBtn}
                        onPress={submitQuestion}
                      >
                        <HelpCircle size={16} color={THEME.colors.brand} />
                        <Text style={styles.skipUnattemptBtnText}>
                          Submit as Unattempted & Reveal Answer
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Test Mode Clear Option */}
                {!isLearning && selectedAnswer !== undefined && (
                  <TouchableOpacity
                    style={styles.clearChoiceBtn}
                    onPress={unattemptQuestion}
                  >
                    <XCircle size={14} color={THEME.colors.muted} />
                    <Text style={styles.clearChoiceText}>
                      Clear selection (Leave unattempted for 0 marks)
                    </Text>
                  </TouchableOpacity>
                )}

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

                  {session.i === totalQuestions - 1 ? (
                    <TouchableOpacity
                      style={styles.finishNavBtn}
                      onPress={handleFinishPress}
                      activeOpacity={0.8}
                    >
                      <CheckCircle size={15} color={THEME.colors.brandInk} />
                      <Text style={styles.finishNavBtnText}>Finish Exam</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.navBtn}
                      onPress={nextQuestion}
                    >
                      <Text style={styles.navBtnText}>Next</Text>
                      <ChevronRight size={16} color={THEME.colors.brand} />
                    </TouchableOpacity>
                  )}

                  {/* Persistent Revision Bookmark Button */}
                  <TouchableOpacity
                    style={[
                      styles.bookmarkBtn,
                      isCurrentBookmarked && styles.bookmarkBtnActive,
                    ]}
                    onPress={() => currentQ && toggleBookmark(currentQ.id)}
                    activeOpacity={0.7}
                  >
                    <Bookmark
                      size={15}
                      color={
                        isCurrentBookmarked
                          ? '#16241F'
                          : THEME.colors.accent
                      }
                      fill={isCurrentBookmarked ? THEME.colors.accent : 'none'}
                    />
                    <Text
                      style={[
                        styles.bookmarkBtnText,
                        isCurrentBookmarked && styles.bookmarkBtnTextActive,
                      ]}
                    >
                      {isCurrentBookmarked ? 'Bookmarked 🔖' : 'Bookmark 🔖'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.reviewBtn,
                      isMarked && styles.reviewBtnActive,
                    ]}
                    onPress={toggleMarkReview}
                  >
                    <Bookmark
                      size={14}
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

      {/* Unattempted Questions Warning Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showWarningModal}
        onRequestClose={() => setShowWarningModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.warningModalCard}>
            <View style={styles.warningHeaderRow}>
              <AlertCircle size={22} color={THEME.colors.accent} />
              <Text style={styles.warningModalTitle}>Submit Exam Early?</Text>
            </View>

            <Text style={styles.warningModalMessage}>
              You have{' '}
              <Text style={styles.warningBoldHighlight}>
                {unattemptedCount}
              </Text>{' '}
              unattempted question{unattemptedCount > 1 ? 's' : ''}. Unattempted questions will receive{' '}
              <Text style={{ fontWeight: '700' }}>0 marks</Text> with no negative penalty.
            </Text>

            <View style={styles.warningMetricsRow}>
              <View style={styles.warningMetricBox}>
                <Text style={styles.warningMetricNum}>{answeredCount}</Text>
                <Text style={styles.warningMetricLabel}>Attempted</Text>
              </View>
              <View style={[styles.warningMetricBox, styles.warningMetricBoxUnattempted]}>
                <Text style={[styles.warningMetricNum, { color: THEME.colors.accent }]}>
                  {unattemptedCount}
                </Text>
                <Text style={styles.warningMetricLabel}>Unattempted (0)</Text>
              </View>
              <View style={styles.warningMetricBox}>
                <Text style={styles.warningMetricNum}>{totalQuestions}</Text>
                <Text style={styles.warningMetricLabel}>Total Questions</Text>
              </View>
            </View>

            <View style={styles.warningActionsRow}>
              <TouchableOpacity
                style={[styles.warningBtn, styles.warningCancelBtn]}
                onPress={() => setShowWarningModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.warningCancelBtnText}>Return to Quiz</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.warningBtn, styles.warningSubmitBtn]}
                onPress={() => {
                  setShowWarningModal(false);
                  finishQuiz();
                }}
                activeOpacity={0.8}
              >
                <CheckCircle size={15} color={THEME.colors.brandInk} style={{ marginRight: 4 }} />
                <Text style={styles.warningSubmitBtnText}>Yes, Submit Exam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  explanationUnattempted: {
    backgroundColor: THEME.colors.accentSoft,
    borderLeftColor: THEME.colors.accent,
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
  textAccent: {
    color: THEME.colors.accent,
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
  submitSection: {
    gap: 8,
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
  skipUnattemptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1.5,
    borderColor: THEME.colors.brand,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  skipUnattemptBtnText: {
    color: THEME.colors.brand,
    fontWeight: '700',
    fontSize: 14,
  },
  clearChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  clearChoiceText: {
    fontSize: 12,
    color: THEME.colors.muted,
    fontWeight: '500',
    textDecorationLine: 'underline',
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
  finishNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.brand,
  },
  finishNavBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.brandInk,
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
  bookmarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.bg,
  },
  bookmarkBtnActive: {
    backgroundColor: THEME.colors.accent,
    borderColor: THEME.colors.accent,
  },
  bookmarkBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  bookmarkBtnTextActive: {
    color: '#16241F',
    fontWeight: '800',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  warningModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  warningModalTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  warningModalMessage: {
    fontSize: 14,
    lineHeight: 22,
    color: THEME.colors.ink,
    marginBottom: 16,
  },
  warningBoldHighlight: {
    fontWeight: '800',
    color: THEME.colors.bad,
  },
  warningMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  warningMetricBox: {
    flex: 1,
    backgroundColor: THEME.colors.soft,
    borderRadius: THEME.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  warningMetricBoxBad: {
    backgroundColor: THEME.colors.badSoft,
  },
  warningMetricBoxUnattempted: {
    backgroundColor: THEME.colors.accentSoft,
  },
  warningMetricNum: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  warningMetricLabel: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  warningActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  warningBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
  },
  warningCancelBtn: {
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  warningCancelBtnText: {
    fontSize: 13,
    color: THEME.colors.muted,
    fontWeight: '600',
  },
  warningSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.brand,
  },
  warningSubmitBtnText: {
    fontSize: 13,
    color: THEME.colors.brandInk,
    fontWeight: '700',
  },
});
