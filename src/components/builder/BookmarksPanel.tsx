import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bookmark, Play, Trash2, Sparkles } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { QuizMode } from '../../types';
import { useApp } from '../../context/AppContext';
import { SegmentedControl } from '../common/SegmentedControl';

export const BookmarksPanel: React.FC = () => {
  const { bookmarkedIds, clearAllBookmarks, startQuiz } = useApp();
  const [revisionMode, setRevisionMode] = useState<QuizMode>('learning');

  const count = bookmarkedIds.length;

  const handleClear = () => {
    if (count === 0) return;
    Alert.alert(
      'Clear Revision Bookmarks',
      `Are you sure you want to clear all ${count} bookmarked question${count > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => clearAllBookmarks(),
        },
      ]
    );
  };

  const handleStartRevision = () => {
    if (count === 0) return;
    startQuiz(bookmarkedIds, revisionMode);
  };

  const modeOptions: { value: QuizMode; label: string }[] = [
    { value: 'learning', label: 'Learning' },
    { value: 'test', label: 'Competitive' },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Bookmark size={18} color={THEME.colors.accent} fill={THEME.colors.accent} />
          <Text style={styles.title}>My Bookmarks & Revision</Text>
        </View>
        <View style={[styles.badge, count > 0 && styles.badgeActive]}>
          <Text style={[styles.badgeText, count > 0 && styles.badgeTextActive]}>
            {count} {count === 1 ? 'MCQ' : 'MCQs'}
          </Text>
        </View>
      </View>

      {count === 0 ? (
        <View style={styles.emptyBox}>
          <Sparkles size={20} color={THEME.colors.muted} style={{ marginBottom: 6 }} />
          <Text style={styles.emptyTitle}>No saved revision questions</Text>
          <Text style={styles.emptyText}>
            While solving quizzes or reviewing exam results, tap the <Text style={{ fontWeight: '700' }}>🔖 Bookmark</Text> button on tricky questions to collect them here for fast revision.
          </Text>
        </View>
      ) : (
        <View style={styles.activeContainer}>
          <Text style={styles.descText}>
            Launch a targeted revision drill containing only your {count} saved question{count > 1 ? 's' : ''}.
          </Text>

          <View style={styles.modeSection}>
            <Text style={styles.modeLabel}>Revision Mode</Text>
            <SegmentedControl
              options={modeOptions}
              value={revisionMode}
              onChange={(m) => setRevisionMode(m)}
            />
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={handleStartRevision}
              accessibilityLabel="Start revision quiz"
            >
              <Play size={16} color={THEME.colors.brandInk} />
              <Text style={styles.startBtnText}>
                Start Revision Quiz ({count})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClear}
              accessibilityLabel="Clear all bookmarks"
            >
              <Trash2 size={16} color={THEME.colors.bad} />
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.bg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  badgeActive: {
    backgroundColor: THEME.colors.accentSoft,
    borderColor: THEME.colors.accent,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  badgeTextActive: {
    color: THEME.colors.brandInk,
  },
  emptyBox: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.bg,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.ink,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: THEME.colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  activeContainer: {
    gap: 12,
  },
  descText: {
    fontSize: 13,
    color: THEME.colors.ink,
    lineHeight: 18,
  },
  modeSection: {
    gap: 6,
  },
  modeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.accent,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
  },
  startBtnText: {
    color: THEME.colors.brandInk,
    fontWeight: '700',
    fontSize: 13,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.bad,
    backgroundColor: 'transparent',
  },
  clearBtnText: {
    color: THEME.colors.bad,
    fontWeight: '600',
    fontSize: 13,
  },
});
