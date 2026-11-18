import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { ChevronDown, ChevronRight, Search, X, Bookmark } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Chapter } from '../../types';
import { GROUPS, RAW_TREE } from '../../constants/syllabusData';
import { useApp } from '../../context/AppContext';

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
    s0: true, // Charaka Samhita open by default
    '0-0': true, // Sutrasthana open by default
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
    const haystack = `${c.sam} ${c.sth} chapter ${c.n} ${c.name}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  };

  // Pre-index chapters by Samhita and Sthana from dynamic chapters list
  const chaptersBySamhitaAndSthana = useMemo(() => {
    const map: Record<string, Chapter[]> = {};
    chapters.forEach((c) => {
      const key = `${c.sam}:::${c.sth}`;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [chapters]);

  // Pre-calculate bookmark count per chapter
  const chapterBookmarksCount = useMemo(() => {
    const map: Record<string | number, number> = {};
    bookmarkedIds.forEach((id) => {
      const q = allQuestions[id];
      if (q) {
        const key = q.ch ?? q.chapterName;
        if (key !== undefined) {
          map[key] = (map[key] || 0) + 1;
        }
      }
    });
    return map;
  }, [bookmarkedIds, allQuestions]);

  // Identify any custom chapters added by admin outside the base RAW_TREE
  const standardSamhitaNames = useMemo(() => new Set(RAW_TREE.map((s) => s.name)), []);
  const customChapters = useMemo(() => {
    return chapters.filter((c) => !standardSamhitaNames.has(c.sam));
  }, [chapters, standardSamhitaNames]);

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
          <>
            {GROUPS.map((groupName, groupIdx) => {
              const samhitasInGroup = RAW_TREE.filter((s) => s.groupIndex === groupIdx);

              // Check if any chapter in this group matches search
              const hasMatchesInGroup = samhitasInGroup.some((samhita) => {
                const samChapters = chapters.filter((c) => c.sam === samhita.name);
                return samChapters.some((c) => matchesSearch(c, searchTerms));
              });

              if (!hasMatchesInGroup) return null;

              return (
                <View key={groupName} style={styles.groupBlock}>
                  <Text style={styles.groupHeader}>{groupName.toUpperCase()}</Text>

                  {samhitasInGroup.map((samhita) => {
                    const si = RAW_TREE.indexOf(samhita);
                    const samhitaChapters = chapters.filter(
                      (c) => c.sam === samhita.name && matchesSearch(c, searchTerms)
                    );

                    if (samhitaChapters.length === 0) return null;

                    const samhitaChapterIds = samhitaChapters.map((c) => c.id);
                    const selectedCount = samhitaChapterIds.filter((id) =>
                      selectedChapters.includes(id)
                    ).length;
                    const isAllSelected =
                      samhitaChapterIds.length > 0 && selectedCount === samhitaChapterIds.length;
                    const isPartiallySelected = selectedCount > 0 && !isAllSelected;

                    const samhitaKey = `s${si}`;
                    const isExpanded = query.trim().length > 0 || !!openSections[samhitaKey];

                    return (
                      <View key={samhita.name} style={styles.samhitaBlock}>
                        {/* Level 1: Samhita Row */}
                        <View style={styles.rowLevel1}>
                          <TouchableOpacity
                            style={styles.expandBtn}
                            onPress={() => toggleSection(samhitaKey)}
                          >
                            {isExpanded ? (
                              <ChevronDown size={18} color={THEME.colors.muted} />
                            ) : (
                              <ChevronRight size={18} color={THEME.colors.muted} />
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.checkboxTouch}
                            onPress={() => toggleGroup(samhitaChapterIds, !isAllSelected)}
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
                              {selectedCount}/{samhitaChapterIds.length}
                            </Text>
                          </View>
                        </View>

                        {/* Level 2: Sthanas */}
                        {isExpanded &&
                          samhita.sthanas.map((sthana, ti) => {
                            const sthanaKey = `${si}-${ti}`;
                            const lookupKey = `${samhita.name}:::${sthana[0]}`;
                            const sthanaChapters = (
                              chaptersBySamhitaAndSthana[lookupKey] || []
                            ).filter((c) => matchesSearch(c, searchTerms));

                            if (sthanaChapters.length === 0) return null;

                            const sthanaIds = sthanaChapters.map((c) => c.id);
                            const sthanaSelectedCount = sthanaIds.filter((id) =>
                              selectedChapters.includes(id)
                            ).length;
                            const isSthanaAllSelected =
                              sthanaIds.length > 0 && sthanaSelectedCount === sthanaIds.length;
                            const isSthanaPartiallySelected =
                              sthanaSelectedCount > 0 && !isSthanaAllSelected;

                            const isSthanaExpanded =
                              query.trim().length > 0 || !!openSections[sthanaKey];

                            return (
                              <View key={sthana[0]} style={styles.sthanaBlock}>
                                {/* Level 2: Sthana Row */}
                                <View style={styles.rowLevel2}>
                                  <TouchableOpacity
                                    style={styles.expandBtn}
                                    onPress={() => toggleSection(sthanaKey)}
                                  >
                                    {isSthanaExpanded ? (
                                      <ChevronDown size={16} color={THEME.colors.muted} />
                                    ) : (
                                      <ChevronRight size={16} color={THEME.colors.muted} />
                                    )}
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={styles.checkboxTouch}
                                    onPress={() =>
                                      toggleGroup(sthanaIds, !isSthanaAllSelected)
                                    }
                                    activeOpacity={0.7}
                                  >
                                    <View
                                      style={[
                                        styles.checkboxBoxSmall,
                                        (isSthanaAllSelected || isSthanaPartiallySelected) &&
                                          styles.checkboxBoxActive,
                                      ]}
                                    >
                                      {isSthanaAllSelected && (
                                        <View style={styles.checkboxCheckmarkSmall} />
                                      )}
                                      {isSthanaPartiallySelected && (
                                        <View style={styles.checkboxIndeterminateSmall} />
                                      )}
                                    </View>
                                    <Text style={styles.sthanaLabel} numberOfLines={1}>
                                      {sthana[0]}
                                    </Text>
                                  </TouchableOpacity>

                                  <View style={styles.countBadge}>
                                    <Text style={styles.countBadgeText}>
                                      {sthanaSelectedCount}/{sthanaIds.length}
                                    </Text>
                                  </View>
                                </View>

                                {/* Level 3: Individual Chapters */}
                                {isSthanaExpanded &&
                                  sthanaChapters.map((chapter) => {
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
                                          {isChSelected && (
                                            <View style={styles.checkboxCheckmarkSmall} />
                                          )}
                                        </View>

                                        <Text
                                          style={[
                                            styles.chapterLabel,
                                            isChSelected && styles.chapterLabelSelected,
                                          ]}
                                          numberOfLines={1}
                                        >
                                          Chapter {chapter.n}
                                          {chapter.id === 0 && (
                                            <Text style={styles.realTag}>
                                              {' '}
                                              · 90 real MCQs
                                            </Text>
                                          )}
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
                          })}
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* Custom Admin Chapters if any */}
            {customChapters.length > 0 && (
              <View style={styles.groupBlock}>
                <Text style={styles.groupHeader}>CUSTOM CHAPTERS & CMS</Text>
                {customChapters.map((c) => {
                  const isChSelected = selectedChapters.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.rowLevel3, isChSelected && styles.rowLevel3Selected]}
                      onPress={() => toggleChapter(c.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[styles.checkboxBoxSmall, isChSelected && styles.checkboxBoxActive]}
                      >
                        {isChSelected && <View style={styles.checkboxCheckmarkSmall} />}
                      </View>
                      <Text style={[styles.chapterLabel, isChSelected && styles.chapterLabelSelected]}>
                        {c.sam} › {c.sth} › {c.name}
                      </Text>
                      <View style={styles.mcqPill}>
                        <Text style={styles.mcqPillText}>{c.qs.length} MCQs</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
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
  groupBlock: {
    gap: 6,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.brandInk,
    letterSpacing: 0.5,
    marginBottom: 4,
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
  realTag: {
    fontSize: 11,
    color: THEME.colors.brand,
    fontWeight: '500',
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
