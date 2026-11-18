import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { Language } from '../../types';
import { SegmentedControl } from './SegmentedControl';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Build a practice test',
  subtitle = 'Tick chapters from any Samhita or subject.',
  rightAction,
}) => {
  const { language, setLanguage } = useApp();

  const langOptions: { value: Language; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'हिन्दी' },
    { value: 'both', label: 'Both' },
  ];

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightAction ? (
          <View style={styles.rightActionArea}>{rightAction}</View>
        ) : (
          <View style={styles.langArea}>
            <SegmentedControl
              options={langOptions}
              value={language}
              onChange={setLanguage}
              style={styles.langSegment}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  titleArea: {
    flex: 1,
    minWidth: 180,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  langArea: {
    minWidth: 180,
  },
  langSegment: {
    width: '100%',
  },
  rightActionArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
