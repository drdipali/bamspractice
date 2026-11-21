import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Layers, HelpCircle, Columns } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Language, Question } from '../../types';
import { extractStatementsFromStem, extractARFromStem } from '../../utils/spreadsheetHelper';

interface QuestionStemProps {
  question: Question;
  language: Language;
}

export const QuestionStem: React.FC<QuestionStemProps> = ({ question, language }) => {
  const enStem = question.stem;
  const hiStem = question.hi?.stem;
  const qType = question.questionType || 'standard';

  const renderBadge = (label: string, bg: string, color: string) => (
    <View style={[styles.typeBadge, { backgroundColor: bg }]}>
      <Layers size={13} color={color} />
      <Text style={[styles.typeBadgeText, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );

  // Assertion / Reason Rendering
  if (qType === 'assertion_reason') {
    let aText = question.assertionText;
    let rText = question.reasonText;
    if ((!aText || !rText) && question.stem) {
      const extracted = extractARFromStem(question.stem);
      aText = aText || extracted.assertion;
      rText = rText || extracted.reason;
    }

    return (
      <View style={styles.container}>
        {renderBadge('Assertion & Reason', '#FEF9C3', '#854D0E')}

        {/* Stem Prompt */}
        <Text style={styles.promptText}>
          {language === 'hi' && hiStem ? hiStem : enStem}
        </Text>

        {/* Assertion Box */}
        <View style={styles.assertionCard}>
          <View style={styles.statementBadgeA}>
            <Text style={styles.statementBadgeTextA}>Assertion (A)</Text>
          </View>
          <Text style={styles.statementContent}>
            {aText || 'Assertion statement not specified.'}
          </Text>
        </View>

        {/* Reason Box */}
        <View style={styles.reasonCard}>
          <View style={styles.statementBadgeR}>
            <Text style={styles.statementBadgeTextR}>Reason (R)</Text>
          </View>
          <Text style={styles.statementContent}>
            {rText || 'Reason statement not specified.'}
          </Text>
        </View>

        <Text style={styles.subPromptText}>
          In light of the above statements, choose the most appropriate answer from the options below:
        </Text>
      </View>
    );
  }

  // Match the Pair Rendering
  if (qType === 'match_the_pair') {
    const pairs = question.matchPairs || [];
    return (
      <View style={styles.container}>
        {renderBadge('Match the Pair', '#DBEAFE', '#1E40AF')}

        <Text style={styles.promptText}>
          {language === 'hi' && hiStem ? hiStem : enStem}
        </Text>

        {/* 2-Column Matching Table */}
        <View style={styles.matchTable}>
          <View style={styles.matchTableHeader}>
            <Text style={styles.matchTableColHeader}>List - I (Concepts)</Text>
            <View style={{ width: 24 }} />
            <Text style={styles.matchTableColHeader}>List - II (Correlations)</Text>
          </View>

          {pairs.map((pair, idx) => (
            <View key={idx} style={[styles.matchTableRow, idx % 2 === 1 && styles.matchTableRowAlt]}>
              <View style={styles.matchColLeft}>
                <Text style={styles.matchPairText}>{pair.left}</Text>
              </View>

              <View style={styles.matchArrowBox}>
                <ArrowRight size={14} color={THEME.colors.muted} />
              </View>

              <View style={styles.matchColRight}>
                <Text style={styles.matchPairText}>{pair.right}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.subPromptText}>
          Choose the correct matching code from the options given below:
        </Text>
      </View>
    );
  }

  // Statement Type Rendering
  if (qType === 'statement_type') {
    let s1 = question.statement1;
    let s2 = question.statement2;
    if ((!s1 || !s2) && question.stem) {
      const extracted = extractStatementsFromStem(question.stem);
      s1 = s1 || extracted.statement1;
      s2 = s2 || extracted.statement2;
    }

    return (
      <View style={styles.container}>
        {renderBadge('Statement Type', '#E0E7FF', '#4338CA')}

        <Text style={styles.promptText}>
          {language === 'hi' && hiStem ? hiStem : enStem}
        </Text>

        <View style={styles.assertionCard}>
          <View style={[styles.statementBadgeA, { backgroundColor: '#E0E7FF' }]}>
            <Text style={[styles.statementBadgeTextA, { color: '#3730A3' }]}>Statement I</Text>
          </View>
          <Text style={styles.statementContent}>
            {s1 || 'Statement I not specified.'}
          </Text>
        </View>

        <View style={[styles.reasonCard, { borderLeftColor: '#4338CA' }]}>
          <View style={[styles.statementBadgeR, { backgroundColor: '#EEF2FF' }]}>
            <Text style={[styles.statementBadgeTextR, { color: '#4338CA' }]}>Statement II</Text>
          </View>
          <Text style={styles.statementContent}>
            {s2 || 'Statement II not specified.'}
          </Text>
        </View>

        <Text style={styles.subPromptText}>
          In light of the above statements, choose the most appropriate answer:
        </Text>
      </View>
    );
  }

  // Standard MCQ
  return (
    <View style={styles.container}>
      {language === 'hi' && hiStem ? (
        <Text style={styles.hiStemText}>{hiStem}</Text>
      ) : language === 'both' && hiStem ? (
        <View style={styles.bilingualContainer}>
          <Text style={styles.enStemText}>{enStem}</Text>
          <View style={styles.divider} />
          <Text style={styles.hiSubStemText}>{hiStem}</Text>
        </View>
      ) : (
        <Text style={styles.enStemText}>{enStem}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    gap: 10,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  promptText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    color: THEME.colors.ink,
  },
  subPromptText: {
    fontSize: 13,
    color: THEME.colors.muted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  assertionCard: {
    backgroundColor: '#FFFDF5',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderLeftWidth: 4,
    borderLeftColor: '#CA8A04',
    borderRadius: 8,
    padding: 12,
  },
  reasonCard: {
    backgroundColor: '#FAFAF9',
    borderWidth: 1,
    borderColor: '#E7E5E4',
    borderLeftWidth: 4,
    borderLeftColor: '#78716C',
    borderRadius: 8,
    padding: 12,
  },
  statementBadgeA: {
    backgroundColor: '#FEF08A',
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  statementBadgeTextA: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854D0E',
  },
  statementBadgeR: {
    backgroundColor: '#E7E5E4',
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  statementBadgeTextR: {
    fontSize: 11,
    fontWeight: '700',
    color: '#44403C',
  },
  statementContent: {
    fontSize: 15,
    lineHeight: 22,
    color: THEME.colors.ink,
    fontWeight: '500',
  },
  matchTable: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  matchTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  matchTableColHeader: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  matchTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  matchTableRowAlt: {
    backgroundColor: '#FFFFFF',
  },
  matchColLeft: {
    flex: 1,
  },
  matchColRight: {
    flex: 1,
  },
  matchArrowBox: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchPairText: {
    fontSize: 14,
    color: THEME.colors.ink,
    fontWeight: '500',
  },
  enStemText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    lineHeight: 26,
    color: THEME.colors.ink,
    fontWeight: '600',
  },
  hiStemText: {
    fontSize: 17,
    lineHeight: 26,
    color: THEME.colors.ink,
    fontWeight: '500',
  },
  bilingualContainer: {
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.line,
    marginVertical: 4,
  },
  hiSubStemText: {
    fontSize: 15,
    lineHeight: 22,
    color: THEME.colors.muted,
  },
});
