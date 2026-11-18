import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { ChevronDown, ChevronRight, Search, X, Bookmark, Layers } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Chapter } from '../../types';
import { useApp } from '../../context/AppContext';

interface DynamicSthana {
  name: string;
  key: string;
  chapters: Chapter[];
  allChapterIds: (string | number)[];
}

interface DynamicSamhita {
  name: string;
  key: string;
  sthanas: DynamicSthana[];
  allChapterIds: (string | number)[];
}

export const ChapterTree: React.FC = () => {
  const {
    chapters,
    allQuestions,
    selectedChapters,
    toggleChapter,
    toggleGroup,
    bookmarkedIds,
  } = useApp();

  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    sam_0: true, // First Samhita open by default
    sth_0_0: true, // First Sthana open by default
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const searchTerms = useMemo(() => {
    return query.toLowerCase().split(/\s+/).filter(Boolean);
  }, [query]);

  // Filter chapters based on search query
  const matchesSearch = (c: Chapter, terms: string[]) => {
    if (terms.length === 0) return true;
    const haystack = `${c.sam} ${c.sth} ${c.name} ${c.n}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  };

  // Build dynamic hierarchy from cloud database chapters
  const dynamicSamhitas = useMemo<DynamicSamhita[]>(() => {
    const samMap: Record<string, Record<string, Chapter[]>> = {};

    chapters.forEach((c) => {
      const samName = c.sam || 'General Ayurveda';
      const sthName = c.sth || 'General';
      if (!samMap[samName]) {
        samMap[samName] = {};
      }
      if (!samMap[samName][sthName]) {
        samMap[samName][sthName] = [];
      }
      samMap[samName][sthName].push(c);
    });

    return Object.keys(samMap).map((samName, sIdx) => {
      const sthanaMap = samMap[samName];
      const sthanas: DynamicSthana[] = Object.keys(sthanaMap).map((sthName, tIdx) => {
        const sthanaChapters = sthanaMap[sthName];
        return {
          name: sthName,
          key: `sth_${sIdx}_${tIdx}`,
          chapters: sthanaChapters,
          allChapterIds: sthanaChapters.map((c) => c.id),
        };
      });

      return {
        name: samName,
        key: `sam_${sIdx}`,
        sthanas,
        allChapterIds: sthanas.flatMap((s) => s.allChapterIds),
      };
    });
  }, [chapters]);

  // Pre-calculate bookmark count per chapter
  const chapterBookmarksCount = useMemo(() => {
    const map: Record<string | number, number> = {};
    bookmarkedIds.forEach((id) => {
      const q = allQuestions[id];
      if (q) {
        const key = q.chapterName || q.ch;
        map[key] = (map[key] || 0) + 1;
      }
    });
    return map;
  }, [bookmarkedIds, allQuestions]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Choose chapters</Text>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <Search size={18} color={THEME.colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search, e.g. charaka sutra 1"
          placeholderTextColor={THEME.colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity
            style={styles.clearSearchBtn}
            onPress={() => setQuery('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={16} color={THEME.colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tree Content */}
      <View style={styles.treeContainer}>
        {chapters.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="small" color={THEME.colors.brand} />
            <Text style={styles.emptyText}>Loading cloud chapter syllabus...</Text>
          </View>
        ) : (
          dynamicSamhitas.map((samhita) => {
            // Filter matching sthanas and chapters
            const matchingSthanas = samhita.sthanas
              .map((sth) => ({
                ...sth,
                chapters: sth.chapters.filter((c) => matchesSearch(c, searchTerms)),
              }))
              .filter((sth) => sth.chapters.length > 0);

            if (matchingSthanas.length === 0) return null;

            const visibleChapterIds = matchingSthanas.flatMap((s) => s.chapters.map((c) => c.id));
            const selectedCount = visibleChapterIds.filter((id) =>
              selectedChapters.includes(id)
            ).length;
            const isAllSelected =
              visibleChapterIds.length > 0 && selectedCount === visibleChapterIds.length;
            const isPartiallySelected = selectedCount > 0 && !isAllSelected;

            const isExpanded = query.trim().length > 0 || !!openSections[samhita.key];

            return (
              <View key={samhita.key} style={styles.samhitaBlock}>
                {/* Level 1: Samhita Row */}
                <View style={styles.rowLevel1}>
                  <TouchableOpacity
                    style={styles.expandBtn}
                    onPress={() => toggleSection(samhita.key)}
                  >
                    {isExpanded ? (
                      <ChevronDown size={18} color={THEME.colors.muted} />
                    ) : (
                      <ChevronRight size={18} color={THEME.colors.muted} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.checkboxTouch}
                    onPress={() => toggleGroup(visibleChapterIds, !isAllSelected)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        (isAllSelected || isPartiallySelected) && styles.checkboxBoxActive,
                      ]}
                    >
                      {isAllSelected && <View style={styles.checkboxCheckmark} />}
                      {isPartiallySelected && <View style={styles.checkboxIndeterminate} />}
                    </View>
                    <Text style={styles.samhitaLabel} numberOfLines={1}>
                      {samhita.name}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {selectedCount}/{visibleChapterIds.length}
                    </Text>
                  </View>
                </View>

                {/* Level 2: Sthanas */}
                {isExpanded &&
                  matchingSthanas.map((sthana) => {
                    const sthanaVisibleIds = sthana.chapters.map((c) => c.id);
                    const sthanaSelectedCount = sthanaVisibleIds.filter((id) =>
                      selectedChapters.includes(id)
                    ).length;
                    const isSthanaAllSelected =
                      sthanaVisibleIds.length > 0 &&
                      sthanaSelectedCount === sthanaVisibleIds.length;
                    const isSthanaPartiallySelected =
                      sthanaSelectedCount > 0 && !isSthanaAllSelected;

                    const isSthanaExpanded =
                      query.trim().length > 0 || !!openSections[sthana.key];

                    return (
                      <View key={sthana.key} style={styles.sthanaBlock}>
                        {/* Level 2: Sthana Row */}
                        <View style={styles.rowLevel2}>
                          <TouchableOpacity
                            style={styles.expandBtn}
                            onPress={() => toggleSection(sthana.key)}
                          >
                            {isSthanaExpanded ? (
                              <ChevronDown size={16} color={THEME.colors.muted} />
                            ) : (
                              <ChevronRight size={16} color={THEME.colors.muted} />
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.checkboxTouch}
                            onPress={() => toggleGroup(sthanaVisibleIds, !isSthanaAllSelected)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.checkboxBoxSmall,
                                (isSthanaAllSelected || isSthanaPartiallySelected) &&
                                  styles.checkboxBoxActive,
                              ]}
                            >
                              {isSthanaAllSelected && <View style={styles.checkboxCheckmarkSmall} />}
                              {isSthanaPartiallySelected && (
                                <View style={styles.checkboxIndeterminateSmall} />
                              )}
                            </View>
                            <Text style={styles.sthanaLabel} numberOfLines={1}>
                              {sthana.name}
                            </Text>
                          </TouchableOpacity>

                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>
                              {sthanaSelectedCount}/{sthanaVisibleIds.length}
                            </Text>
                          </View>
                        </View>

                        {/* Level 3: Individual Chapters */}
                        {isSthanaExpanded &&
                          sthana.chapters.map((chapter) => {
                            const isChSelected = selectedChapters.includes(chapter.id);
                            const chBookmarkCount =
                              chapterBookmarksCount[chapter.id] ||
                              chapterBookmarksCount[chapter.name] ||
                              0;

                            return (
                              <TouchableOpacity
                                key={chapter.id}
                                style={[
                                  styles.rowLevel3,
                                  isChSelected && styles.rowLevel3Selected,
                                ]}
                                onPress={() => toggleChapter(chapter.id)}
                                activeOpacity={0.7}
                              >
                                <View
                                  style={[
                                    styles.checkboxBoxSmall,
                                    isChSelected && styles.checkboxBoxActive,
                                  ]}
                                >
                                  {isChSelected && <View style={styles.checkboxCheckmarkSmall} />}
                                </View>

                                <Text
                                  style={[
                                    styles.chapterLabel,
                                    isChSelected && styles.chapterLabelSelected,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {chapter.name}
                                </Text>

                                <View style={styles.chapterRightRow}>
                                  {chBookmarkCount > 0 && (
                                    <View style={styles.chapterBookmarkBadge}>
                                      <Bookmark
                                        size={9}
                                        color={THEME.colors.brandInk}
                                        fill={THEME.colors.accent}
                                      />
                                      <Text style={styles.chapterBookmarkBadgeText}>
                                        {chBookmarkCount}
                                      </Text>
                                    </View>
                                  )}

                                  <View style={styles.mcqPill}>
                                    <Text style={styles.mcqPillText}>
                                      {chapter.qs.length} MCQs
                                    </Text>
                                  </View>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                      </View>
                    );
                  })
                }
              </View>
            );
          })
        )}
      </View>
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
  },
  cardTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.ink,
    padding: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  treeContainer: {
    gap: 16,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: THEME.colors.muted,
  },
  samhitaBlock: {
    marginBottom: 4,
  },
  rowLevel1: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  expandBtn: {
    padding: 4,
    marginRight: 4,
  },
  checkboxTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: THEME.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
  },
  checkboxBoxSmall: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: THEME.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
  },
  checkboxBoxActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  checkboxCheckmark: {
    width: 8,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  checkboxCheckmarkSmall: {
    width: 6,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  checkboxIndeterminate: {
    width: 8,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  checkboxIndeterminateSmall: {
    width: 6,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  samhitaLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.ink,
    flex: 1,
  },
  countBadge: {
    backgroundColor: THEME.colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  countBadgeText: {
    fontSize: 11,
    color: THEME.colors.muted,
    fontWeight: '600',
  },
  sthanaBlock: {
    marginLeft: 16,
    marginTop: 2,
  },
  rowLevel2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sthanaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.ink,
    flex: 1,
  },
  rowLevel3: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginLeft: 24,
    borderRadius: THEME.radius.sm,
    gap: 8,
  },
  rowLevel3Selected: {
    backgroundColor: '#E6F4EA',
  },
  chapterLabel: {
    fontSize: 13,
    color: THEME.colors.ink,
    flex: 1,
  },
  chapterLabelSelected: {
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  chapterRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chapterBookmarkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chapterBookmarkBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.brandInk,
  },
  mcqPill: {
    backgroundColor: THEME.colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
  },
  mcqPillText: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
});
