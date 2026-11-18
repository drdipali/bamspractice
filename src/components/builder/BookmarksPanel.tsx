import React, { useState, useMemo } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Bookmark,
  Play,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Check,
  RotateCcw,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Chapter, QuizMode } from '../../types';
import { useApp } from '../../context/AppContext';
import { SegmentedControl } from '../common/SegmentedControl';
import { ALL_QUESTIONS, ALL_CHAPTERS, getChapterPath } from '../../constants/syllabusData';

interface ChapterBookmarkGroup {
  chapter: Chapter;
  ids: number[];
}

export const BookmarksPanel: React.FC = () => {
  const {
    bookmarkedIds,
    clearAllBookmarks,
    clearChapterBookmarks,
    startQuiz,
  } = useApp();

  const [revisionMode, setRevisionMode] = useState<QuizMode>('learning');
  const [showChapterBreakdown, setShowChapterBreakdown] = useState(true);
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([]);

  const totalCount = bookmarkedIds.length;

  // Group bookmarked questions chapter-wise
  const chapterGroups = useMemo<ChapterBookmarkGroup[]>(() => {
    const map: Record<number, ChapterBookmarkGroup> = {};
    bookmarkedIds.forEach((id) => {
      const q = ALL_QUESTIONS[id];
      if (q) {
        const ch = ALL_CHAPTERS[q.ch];
        if (ch) {
          if (!map[ch.id]) {
            map[ch.id] = { chapter: ch, ids: [] };
          }
          map[ch.id].ids.push(id);
        }
      }
    });
    return Object.values(map).sort((a, b) => a.chapter.id - b.chapter.id);
  }, [bookmarkedIds]);

  // Which questions are targeted by current chapter selection filter
  const targetQuestions = useMemo(() => {
    if (selectedChapterIds.length === 0) {
      return bookmarkedIds;
    }
    return bookmarkedIds.filter((id) => {
      const q = ALL_QUESTIONS[id];
      return q && selectedChapterIds.includes(q.ch);
    });
  }, [bookmarkedIds, selectedChapterIds]);

  const toggleChapterFilter = (chId: number) => {
    setSelectedChapterIds((prev) =>
      prev.includes(chId) ? prev.filter((id) => id !== chId) : [...prev, chId]
    );
  };

  const handleClearAll = () => {
    if (totalCount === 0) return;
    Alert.alert(
      'Clear All Revision Bookmarks',
      `Are you sure you want to clear all ${totalCount} bookmarked question${totalCount > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            setSelectedChapterIds([]);
            clearAllBookmarks();
          },
        },
      ]
    );
  };

  const handleClearChapter = (group: ChapterBookmarkGroup) => {
    Alert.alert(
      'Clear Chapter Bookmarks',
      `Remove ${group.ids.length} bookmark${group.ids.length > 1 ? 's' : ''} from "${getChapterPath(group.chapter)}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            clearChapterBookmarks(group.chapter.id);
            setSelectedChapterIds((prev) =>
              prev.filter((id) => id !== group.chapter.id)
            );
          },
        },
      ]
    );
  };

  const handleStartRevision = (idsToUse?: number[]) => {
    const ids = idsToUse || targetQuestions;
    if (ids.length === 0) return;
    startQuiz(ids, revisionMode);
  };

  const modeOptions: { value: QuizMode; label: string }[] = [
    { value: 'learning', label: 'Learning' },
    { value: 'test', label: 'Competitive' },
  ];

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Bookmark
            size={18}
            color={THEME.colors.accent}
            fill={THEME.colors.accent}
          />
          <Text style={styles.title}>My Bookmarks &amp; Revision</Text>
        </View>
        <View style={[styles.badge, totalCount > 0 && styles.badgeActive]}>
          <Text
            style={[styles.badgeText, totalCount > 0 && styles.badgeTextActive]}
          >
            {totalCount} {totalCount === 1 ? 'MCQ' : 'MCQs'} in{' '}
            {chapterGroups.length}{' '}
            {chapterGroups.length === 1 ? 'Chapter' : 'Chapters'}
          </Text>
        </View>
      </View>

      {totalCount === 0 ? (
        <View style={styles.emptyBox}>
          <Sparkles
            size={20}
            color={THEME.colors.muted}
            style={{ marginBottom: 6 }}
          />
          <Text style={styles.emptyTitle}>No saved revision questions</Text>
          <Text style={styles.emptyText}>
            While solving quizzes or reviewing exam results, tap the{' '}
            <Text style={{ fontWeight: '700' }}>🔖 Bookmark</Text> button on
            tricky questions. They will automatically be saved and organized here{' '}
            <Text style={{ fontWeight: '700' }}>chapter-wise</Text> for
            focused revision.
          </Text>
        </View>
      ) : (
        <View style={styles.activeContainer}>
          <Text style={styles.descText}>
            Saved questions are automatically organized by chapter. Practice all
            saved questions or drill down into a single chapter.
          </Text>

          {/* Mode Selector */}
          <View style={styles.modeSection}>
            <Text style={styles.modeLabel}>Revision Mode</Text>
            <SegmentedControl
              options={modeOptions}
              value={revisionMode}
              onChange={(m) => setRevisionMode(m)}
            />
          </View>

          {/* Chapter-wise Breakdown Accordion */}
          <View style={styles.chapterSection}>
            <TouchableOpacity
              style={styles.chapterSectionHeader}
              onPress={() => setShowChapterBreakdown((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={styles.chapterSectionTitleRow}>
                {showChapterBreakdown ? (
                  <ChevronDown size={16} color={THEME.colors.ink} />
                ) : (
                  <ChevronRight size={16} color={THEME.colors.ink} />
                )}
                <Text style={styles.chapterSectionTitle}>
                  Chapter-wise Bookmarks ({chapterGroups.length})
                </Text>
              </View>
              {selectedChapterIds.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSelectedChapterIds([])}
                  style={styles.resetFilterBtn}
                >
                  <RotateCcw size={11} color={THEME.colors.brand} />
                  <Text style={styles.resetFilterText}>Select All</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {showChapterBreakdown && (
              <View style={styles.chapterList}>
                {chapterGroups.map((group) => {
                  const isFiltered = selectedChapterIds.includes(
                    group.chapter.id
                  );
                  const isSelectActive =
                    selectedChapterIds.length === 0 || isFiltered;

                  return (
                    <View key={group.chapter.id} style={styles.chapterCard}>
                      <TouchableOpacity
                        style={styles.chapterCardLeft}
                        onPress={() => toggleChapterFilter(group.chapter.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.checkboxSmall,
                            isSelectActive && styles.checkboxSmallActive,
                          ]}
                        >
                          {isSelectActive && (
                            <Check size={11} color={THEME.colors.brandInk} />
                          )}
                        </View>
                        <View style={styles.chapterTextCol}>
                          <Text
                            style={styles.chapterPathText}
                            numberOfLines={1}
                          >
                            {getChapterPath(group.chapter)}
                          </Text>
                          <Text style={styles.chapterCountSub}>
                            {group.ids.length}{' '}
                            {group.ids.length === 1 ? 'MCQ' : 'MCQs'} saved
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.chapterCardActions}>
                        <TouchableOpacity
                          style={styles.singleReviseBtn}
                          onPress={() => handleStartRevision(group.ids)}
                          activeOpacity={0.8}
                          accessibilityLabel={`Revise ${group.chapter.n}`}
                        >
                          <Play size={11} color={THEME.colors.brandInk} />
                          <Text style={styles.singleReviseText}>
                            Revise ({group.ids.length})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.chapterDeleteBtn}
                          onPress={() => handleClearChapter(group)}
                          activeOpacity={0.7}
                          accessibilityLabel="Delete chapter bookmarks"
                        >
                          <Trash2 size={13} color={THEME.colors.bad} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Main Action Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => handleStartRevision()}
              accessibilityLabel="Start revision quiz"
            >
              <Play size={16} color={THEME.colors.brandInk} />
              <Text style={styles.startBtnText}>
                {selectedChapterIds.length > 0
                  ? `Start Revision Quiz (${targetQuestions.length} Selected)`
                  : `Start Revision Quiz (${totalCount})`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClearAll}
              accessibilityLabel="Clear all bookmarks"
            >
              <Trash2 size={16} color={THEME.colors.bad} />
              <Text style={styles.clearBtnText}>Clear All</Text>
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
    flexWrap: 'wrap',
    gap: 8,
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
  chapterSection: {
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.bg,
    overflow: 'hidden',
  },
  chapterSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
    backgroundColor: THEME.colors.soft,
  },
  chapterSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chapterSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME.colors.surface,
  },
  resetFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  chapterList: {
    padding: 8,
    gap: 6,
  },
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    gap: 8,
  },
  chapterCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxSmall: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: THEME.colors.line,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSmallActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  chapterTextCol: {
    flex: 1,
  },
  chapterPathText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.ink,
  },
  chapterCountSub: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginTop: 1,
  },
  chapterCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  singleReviseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.accent,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  singleReviseText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.brandInk,
  },
  chapterDeleteBtn: {
    padding: 6,
    borderRadius: 4,
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
    backgroundColor: THEME.colors.brand,
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
