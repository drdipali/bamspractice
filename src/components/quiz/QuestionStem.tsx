import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../../constants/theme';
import { Language, Question } from '../../types';

interface QuestionStemProps {
  question: Question;
  language: Language;
}

export const QuestionStem: React.FC<QuestionStemProps> = ({ question, language }) => {
  const enStem = question.stem;
  const hiStem = question.hi?.stem;

  const renderContent = () => {
    if (language === 'hi' && hiStem) {
      return <Text style={styles.hiStemText}>{hiStem}</Text>;
    }

    if (language === 'both' && hiStem) {
      return (
        <View style={styles.bilingualContainer}>
          <Text style={styles.enStemText}>{enStem}</Text>
          <View style={styles.divider} />
          <Text style={styles.hiSubStemText}>{hiStem}</Text>
        </View>
      );
    }

    return <Text style={styles.enStemText}>{enStem}</Text>;
  };

  return <View style={styles.container}>{renderContent()}</View>;
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
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
