import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { GROUPS, RAW_TREE, ALL_CHAPTERS } from '../../constants/syllabusData';
import { Chapter } from '../../types';
import { useApp } from '../../context/AppContext';

export const ChapterTree: React.FC = () => {
  const { selectedChapters, toggleChapter, toggleGroup } = useApp();
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    s0: true, // Charaka Samhita open by default
    '0-0': true, // Sutrasthana open by default
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter chapters based on search query
  const matchesSearch = (c: Chapter, searchTerms: string[]) => {
    if (searchTerms.length === 0) return true;
    const haystack = `${c.sam} ${c.sth} chapter ${c.n}`.toLowerCase();
    return searchTerms.every((term) => haystack.includes(term));
  };

  const searchTerms = useMemo(() => {
    return query.toLowerCase().split(/\s+/).filter(Boolean);
  }, [query]);

  // Pre-index chapters by Samhita and Sthana
  const chaptersBySamhitaAndSthana = useMemo(() => {
    const map: Record<string, Chapter[]> = {};
    ALL_CHAPTERS.forEach((c) => {
      const key = `${c.si}-${c.key.split('-')[1]}`;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, []);

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
          placeholder="Search, e.g. charaka chikitsa 30"
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
        {GROUPS.map((groupName, groupIdx) => {
          const samhitasInGroup = RAW_TREE.filter(
            (s) => s.groupIndex === groupIdx
          );

          // Check if any chapter in this group matches
          const hasMatchesInGroup = samhitasInGroup.some((s) => {
            const si = RAW_TREE.indexOf(s);
            return ALL_CHAPTERS.filter(
              (c) => c.si === si && matchesSearch(c, searchTerms)
            ).length > 0;
          });

          if (!hasMatchesInGroup) return null;

          return (
            <View key={groupName} style={styles.groupBlock}>
              <Text style={styles.groupHeader}>{groupName.toUpperCase()}</Text>

              {samhitasInGroup.map((samhita) => {
                const si = RAW_TREE.indexOf(samhita);
                const samhitaChapters = ALL_CHAPTERS.filter(
                  (c) => c.si === si && matchesSearch(c, searchTerms)
                );

                if (samhitaChapters.length === 0) return null;

                const samhitaChapterIds = samhitaChapters.map((c) => c.id);
                const selectedCount = samhitaChapterIds.filter((id) =>
                  selectedChapters.includes(id)
                ).length;
                const isAllSelected =
                  samhitaChapterIds.length > 0 &&
                  selectedCount === samhitaChapterIds.length;
                const isPartiallySelected =
                  selectedCount > 0 && !isAllSelected;

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
                        onPress={() =>
                          toggleGroup(samhitaChapterIds, !isAllSelected)
                        }
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.checkboxBox,
                            (isAllSelected || isPartiallySelected) &&
                              styles.checkboxBoxActive,
                          ]}
                        >
                          {isAllSelected && (
                            <View style={styles.checkboxCheckmark} />
                          )}
                          {isPartiallySelected && (
                            <View style={styles.checkboxIndeterminate} />
                          )}
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
                        const sthanaChapters = (
                          chaptersBySamhitaAndSthana[sthanaKey] || []
                        ).filter((c) => matchesSearch(c, searchTerms));

                        if (sthanaChapters.length === 0) return null;

                        const sthanaIds = sthanaChapters.map((c) => c.id);
                        const sthanaSelectedCount = sthanaIds.filter((id) =>
                          selectedChapters.includes(id)
                        ).length;
                        const isSthanaAllSelected =
                          sthanaIds.length > 0 &&
                          sthanaSelectedCount === sthanaIds.length;
                        const isSthanaPartiallySelected =
                          sthanaSelectedCount > 0 && !isSthanaAllSelected;

                        const isSthanaExpanded =
                          query.trim().length > 0 ||
                          !!openSections[sthanaKey];

                        return (
                          <View key={sthana[0]} style={styles.sthanaBlock}>
                            {/* Level 2 Row */}
                            <View style={styles.rowLevel2}>
                              <TouchableOpacity
                                style={styles.expandBtn}
                                onPress={() => toggleSection(sthanaKey)}
                              >
                                {isSthanaExpanded ? (
                                  <ChevronDown
                                    size={16}
                                    color={THEME.colors.muted}
                                  />
                                ) : (
                                  <ChevronRight
                                    size={16}
                                    color={THEME.colors.muted}
                                  />
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
                                    (isSthanaAllSelected ||
                                      isSthanaPartiallySelected) &&
                                      styles.checkboxBoxActive,
                                  ]}
                                >
                                  {isSthanaAllSelected && (
                                    <View style={styles.checkboxCheckmarkSmall} />
                                  )}
                                  {isSthanaPartiallySelected && (
                                    <View
                                      style={styles.checkboxIndeterminateSmall}
                                    />
                                  )}
                                </View>
                                <Text
                                  style={styles.sthanaLabel}
                                  numberOfLines={1}
                                >
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
                                const isChSelected = selectedChapters.includes(
                                  chapter.id
                                );
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
                                        isChSelected &&
                                          styles.checkboxBoxActive,
                                      ]}
                                    >
                                      {isChSelected && (
                                        <View
                                          style={
                                            styles.checkboxCheckmarkSmall
                                          }
                                        />
                                      )}
                                    </View>
                                    <Text
                                      style={[
                                        styles.chapterLabel,
                                        isChSelected &&
                                          styles.chapterLabelSelected,
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
                                    <View style={styles.mcqPill}>
                                      <Text style={styles.mcqPillText}>
                                        {chapter.qs.length} MCQs
                                      </Text>
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    padding: 16,
    marginBottom: 16,
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
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    paddingHorizontal: 10,
    height: 42,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: THEME.colors.ink,
  },
  clearSearchBtn: {
    padding: 4,
  },
  treeContainer: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    paddingTop: 8,
  },
  groupBlock: {
    marginBottom: 14,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.muted,
    letterSpacing: 0.8,
    marginVertical: 6,
    paddingHorizontal: 4,
  },
  samhitaBlock: {
    marginBottom: 4,
  },
  rowLevel1: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: THEME.radius.sm,
  },
  expandBtn: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: THEME.colors.line,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
  },
  checkboxBoxSmall: {
    width: 16,
    height: 16,
    borderRadius: 3.5,
    borderWidth: 1.5,
    borderColor: THEME.colors.line,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
  },
  checkboxBoxActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  checkboxCheckmark: {
    width: 6,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: THEME.colors.brandInk,
    transform: [{ rotate: '45deg' }, { translateY: -1 }],
  },
  checkboxCheckmarkSmall: {
    width: 5,
    height: 8,
    borderBottomWidth: 1.8,
    borderRightWidth: 1.8,
    borderColor: THEME.colors.brandInk,
    transform: [{ rotate: '45deg' }, { translateY: -1 }],
  },
  checkboxIndeterminate: {
    width: 8,
    height: 2,
    backgroundColor: THEME.colors.brandInk,
  },
  checkboxIndeterminateSmall: {
    width: 6,
    height: 2,
    backgroundColor: THEME.colors.brandInk,
  },
  samhitaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.ink,
    flex: 1,
  },
  countBadge: {
    backgroundColor: THEME.colors.soft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.radius.pill,
    marginLeft: 6,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  sthanaBlock: {
    marginLeft: 14,
    marginVertical: 2,
  },
  rowLevel2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: THEME.radius.sm,
  },
  sthanaLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.ink,
    flex: 1,
  },
  rowLevel3: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingLeft: 28,
    paddingRight: 6,
    marginVertical: 1,
    borderRadius: THEME.radius.sm,
  },
  rowLevel3Selected: {
    backgroundColor: THEME.colors.soft,
  },
  chapterLabel: {
    fontSize: 13,
    color: THEME.colors.ink,
    flex: 1,
  },
  chapterLabelSelected: {
    fontWeight: '500',
    color: THEME.colors.brand,
  },
  realTag: {
    fontSize: 11,
    color: THEME.colors.brand,
    fontWeight: '600',
  },
  mcqPill: {
    backgroundColor: THEME.colors.soft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radius.pill,
  },
  mcqPillText: {
    fontSize: 11,
    color: THEME.colors.muted,
  },
});
