import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { THEME, OPTION_LABELS } from '../../constants/theme';
import { Language, Question } from '../../types';
import { parseBilingualParts } from '../../utils/spreadsheetHelper';

interface OptionListProps {
  question: Question;
  language: Language;
  selectedIndex?: number;
  isLocked: boolean;
  onSelect: (index: number) => void;
}

export const OptionList: React.FC<OptionListProps> = ({
  question,
  language,
  selectedIndex,
  isLocked,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      {question.o.map((optText, idx) => {
        const isSelected = selectedIndex === idx;
        const isCorrect = idx === question.c;
        const showCorrect = isLocked && isCorrect;
        const showIncorrect = isLocked && isSelected && !isCorrect;

        let cardStyle = styles.optDefault;
        if (showCorrect) {
          cardStyle = styles.optCorrect;
        } else if (showIncorrect) {
          cardStyle = styles.optIncorrect;
        } else if (isSelected) {
          cardStyle = styles.optSelected;
        }

        // Bilingual option text
        const explicitHi = question.hi?.o?.[idx];
        const parsedOpt = parseBilingualParts(optText, explicitHi);
        let primaryText = parsedOpt.en;
        let subText: string | null = null;

        if (language === 'hi') {
          primaryText = parsedOpt.hi || parsedOpt.en;
        } else if (language === 'both') {
          primaryText = parsedOpt.en;
          if (parsedOpt.hi && parsedOpt.hi !== parsedOpt.en) {
            subText = parsedOpt.hi;
          }
        }

        return (
          <TouchableOpacity
            key={idx}
            style={[styles.optCard, cardStyle]}
            onPress={() => onSelect(idx)}
            disabled={isLocked}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.badgeLetter,
                showCorrect && styles.badgeCorrect,
                showIncorrect && styles.badgeIncorrect,
                isSelected && !isLocked && styles.badgeSelected,
              ]}
            >
              <Text
                style={[
                  styles.badgeLetterText,
                  (showCorrect || showIncorrect || (isSelected && !isLocked)) &&
                    styles.badgeLetterTextActive,
                ]}
              >
                {OPTION_LABELS[idx]}
              </Text>
            </View>

            <View style={styles.textContainer}>
              <Text
                style={[
                  styles.optionText,
                  showCorrect && styles.textCorrect,
                  showIncorrect && styles.textIncorrect,
                ]}
              >
                {primaryText}
              </Text>
              {subText ? <Text style={styles.hiSubText}>{subText}</Text> : null}
            </View>

            {showCorrect && (
              <CheckCircle2 size={18} color={THEME.colors.ok} style={styles.feedbackIcon} />
            )}
            {showIncorrect && (
              <XCircle size={18} color={THEME.colors.bad} style={styles.feedbackIcon} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginVertical: 8,
  },
  optCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    backgroundColor: THEME.colors.surface,
  },
  optDefault: {
    borderColor: THEME.colors.line,
  },
  optSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.soft,
  },
  optCorrect: {
    borderColor: THEME.colors.ok,
    backgroundColor: THEME.colors.okSoft,
  },
  optIncorrect: {
    borderColor: THEME.colors.bad,
    backgroundColor: THEME.colors.badSoft,
  },
  badgeLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.bg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  badgeSelected: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  badgeCorrect: {
    backgroundColor: THEME.colors.ok,
    borderColor: THEME.colors.ok,
  },
  badgeIncorrect: {
    backgroundColor: THEME.colors.bad,
    borderColor: THEME.colors.bad,
  },
  badgeLetterText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  badgeLetterTextActive: {
    color: THEME.colors.brandInk,
  },
  textContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 14,
    color: THEME.colors.ink,
    lineHeight: 20,
    fontWeight: '500',
  },
  textCorrect: {
    color: THEME.colors.ok,
    fontWeight: '600',
  },
  textIncorrect: {
    color: THEME.colors.bad,
  },
  hiSubText: {
    fontSize: 12,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  feedbackIcon: {
    marginLeft: 8,
  },
});
