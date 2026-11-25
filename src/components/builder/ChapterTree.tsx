import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { ChevronDown, ChevronRight, Search, X, Bookmark, Check, RefreshCw } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Chapter } from '../../types';
import { GROUPS, RAW_TREE } from '../../constants/syllabusData';
import { useApp } from '../../context/AppContext';
import { isQuestionChapterVerified, isValidQuestion } from '../../utils/chapterMapper';

export const ChapterTree: React.FC = () => {
  const {
    chapters,
    allQuestions,
    selectedChapters,
    toggleChapter,
    toggleGroup,
    bookmarkedIds,
    practiceMode,
    refreshQuestions,
    isSyncing,
    cloudSyncError,
  } = useApp();

  const [query, setQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    s0: true, // Charaka Samhita open by default
    '0-0': true, // Sutrasthana open by default
  });

  const handleManualRefresh = async () => {
    if (isSyncing || isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (refreshQuestions) {
        await refreshQuestions(true);
      }
    } catch (e) {
      console.warn('Manual refresh failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

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
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Choose chapters</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleManualRefresh}
          disabled={isRefreshing || isSyncing}
          activeOpacity={0.7}
        >
          {isRefreshing || isSyncing ? (
            <ActivityIndicator size="small" color={THEME.colors.brand} />
          ) : (
            <RefreshCw size={13} color={THEME.colors.brand} />
          )}
          <Text style={styles.refreshBtnText}>
            {isRefreshing || isSyncing ? 'Syncing...' : 'Sync Questions'}
          </Text>
        </TouchableOpacity>
      </View>

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

                    const isChapterVerifiedOnly = practiceMode === 'chapter_verified';

                    // Available chapter IDs based on practice mode
                    const availableSamhitaChapterIds = samhitaChapters
                      .filter((c) =>
                        isChapterVerifiedOnly
                          ? (c.verifiedCount !== undefined
                              ? c.verifiedCount > 0
                              : c.qs.some((q) => isQuestionChapterVerified(q) && isValidQuestion(q)))
                          : (c.totalCount !== undefined
                              ? c.totalCount > 0
                              : (c.verifiedCount !== undefined ? c.verifiedCount > 0 : c.qs.some(isValidQuestion)))
                      )
                      .map((c) => c.id);

                    const samhitaVerifiedTotal = samhitaChapters.reduce(
                      (acc, c) =>
                        acc +
                        (c.verifiedCount !== undefined
                          ? c.verifiedCount
                          : c.qs.filter((q) => isQuestionChapterVerified(q) && isValidQuestion(q)).length),
                      0
                    );

                    const samhitaTargetIds =
                      isChapterVerifiedOnly && availableSamhitaChapterIds.length > 0
                        ? availableSamhitaChapterIds
                        : samhitaChapters.map((c) => c.id);

                    const selectedCount = samhitaTargetIds.filter((id) =>
                      selectedChapters.includes(id)
                    ).length;
                    const isAllSelected =
                      samhitaTargetIds.length > 0 && selectedCount === samhitaTargetIds.length;
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
                            onPress={() => {
                              if (isChapterVerifiedOnly && availableSamhitaChapterIds.length === 0) {
                                alert(
                                  `No verified questions available in ${samhita.name} yet (Coming Soon). Switch to "Mixed & Mock Tests" at the top to access the unverified question bank.`
                                );
                                return;
                              }
                              toggleGroup(samhitaTargetIds, !isAllSelected);
                            }}
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

                          <View
                            style={[
                              styles.countBadge,
                              isChapterVerifiedOnly && samhitaVerifiedTotal > 0 && styles.countBadgeVerified,
                            ]}
                          >
                            <Text
                              style={[
                                styles.countBadgeText,
                                isChapterVerifiedOnly && samhitaVerifiedTotal > 0 && styles.countBadgeTextVerified,
                              ]}
                            >
                              {isChapterVerifiedOnly
                                ? `${samhitaVerifiedTotal} Verified Qs`
                                : `${selectedCount}/${samhitaTargetIds.length}`}
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

                            const availableSthanaChapterIds = sthanaChapters
                              .filter((c) =>
                                isChapterVerifiedOnly
                                  ? (c.verifiedCount !== undefined
                                      ? c.verifiedCount > 0
                                      : c.qs.some((q) => isQuestionChapterVerified(q) && isValidQuestion(q)))
                                  : (c.totalCount !== undefined
                                      ? c.totalCount > 0
                                      : (c.verifiedCount !== undefined ? c.verifiedCount > 0 : c.qs.some(isValidQuestion)))
                              )
                              .map((c) => c.id);

                            const sthanaVerifiedTotal = sthanaChapters.reduce(
                              (acc, c) =>
                                acc +
                                (c.verifiedCount !== undefined
                                  ? c.verifiedCount
                                  : c.qs.filter((q) => isQuestionChapterVerified(q) && isValidQuestion(q)).length),
                              0
                            );

                            const sthanaTargetIds =
                              isChapterVerifiedOnly && availableSthanaChapterIds.length > 0
                                ? availableSthanaChapterIds
                                : sthanaChapters.map((c) => c.id);

                            const sthanaSelectedCount = sthanaTargetIds.filter((id) =>
                              selectedChapters.includes(id)
                            ).length;
                            const isSthanaAllSelected =
                              sthanaTargetIds.length > 0 && sthanaSelectedCount === sthanaTargetIds.length;
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
                                    onPress={() => {
                                      if (isChapterVerifiedOnly && availableSthanaChapterIds.length === 0) {
                                        alert(
                                          `No verified questions available in ${sthana[0]} yet (Coming Soon).`
                                        );
                                        return;
                                      }
                                      toggleGroup(sthanaTargetIds, !isSthanaAllSelected);
                                    }}
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

                                  <View
                                    style={[
                                      styles.countBadge,
                                      isChapterVerifiedOnly && sthanaVerifiedTotal > 0 && styles.countBadgeVerified,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.countBadgeText,
                                        isChapterVerifiedOnly && sthanaVerifiedTotal > 0 && styles.countBadgeTextVerified,
                                      ]}
                                    >
                                      {isChapterVerifiedOnly
                                        ? `${sthanaVerifiedTotal} Qs`
                                        : `${sthanaSelectedCount}/${sthanaTargetIds.length}`}
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

                                    const verifiedQs = chapter.qs.filter(
                                      (q) => isQuestionChapterVerified(q) && isValidQuestion(q)
                                    );
                                    const allValidQs = chapter.qs.filter(isValidQuestion);
                                    const verifiedCount =
                                      chapter.verifiedCount !== undefined ? chapter.verifiedCount : verifiedQs.length;
                                    const totalCount =
                                      chapter.totalCount !== undefined
                                        ? chapter.totalCount
                                        : (chapter.verifiedCount !== undefined ? chapter.verifiedCount : allValidQs.length);
                                    const hasVerified = verifiedCount > 0;
                                    const isChapterSelectable =
                                      isChapterVerifiedOnly ? hasVerified : totalCount > 0;

                                    return (
                                      <TouchableOpacity
                                        key={chapter.id}
                                        style={[
                                          styles.rowLevel3,
                                          isChSelected && styles.rowLevel3Selected,
                                          !isChapterSelectable && styles.rowLevel3Disabled,
                                        ]}
                                        onPress={() => {
                                          if (isChapterVerifiedOnly && !hasVerified) {
                                            alert(
                                              `Chapter ${chapter.n} does not have verified questions yet (Coming Soon). Switch to "Mixed & Mock Tests" at the top to access the full question bank.`
                                            );
                                            return;
                                          }
                                          toggleChapter(chapter.id);
                                        }}
                                        activeOpacity={isChapterSelectable ? 0.7 : 0.5}
                                      >
                                        <View
                                          style={[
                                            styles.checkboxBoxSmall,
                                            isChSelected && styles.checkboxBoxActive,
                                            !isChapterSelectable && styles.checkboxBoxDisabled,
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
                                            !isChapterSelectable && styles.chapterLabelDisabled,
                                          ]}
                                          numberOfLines={1}
                                        >
                                          Chapter {chapter.n}
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

                                          {isChapterVerifiedOnly ? (
                                            hasVerified ? (
                                              <View style={styles.mcqPillVerified}>
                                                <Check size={10} color="#15803D" strokeWidth={3} />
                                                <Text style={styles.mcqPillVerifiedText}>
                                                  {verifiedCount} Verified
                                                </Text>
                                              </View>
                                            ) : (
                                              <View style={styles.mcqPillComingSoon}>
                                                <Text style={styles.mcqPillComingSoonText}>
                                                  Coming Soon
                                                </Text>
                                              </View>
                                            )
                                          ) : (
                                            <View style={styles.mcqPill}>
                                              <Text style={styles.mcqPillText}>
                                                {totalCount} MCQs
                                              </Text>
                                            </View>
                                          )}
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
                        <Text style={styles.mcqPillText}>{c.totalCount ?? c.qs.length} MCQs</Text>
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
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
  countBadgeVerified: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  countBadgeText: {
    fontSize: 11,
    color: THEME.colors.muted,
    fontWeight: '600',
  },
  countBadgeTextVerified: {
    color: '#047857',
    fontWeight: '700',
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
  rowLevel3Disabled: {
    opacity: 0.6,
  },
  checkboxBoxDisabled: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
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
  chapterLabelDisabled: {
    color: '#94A3B8',
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
  mcqPillVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
  },
  mcqPillVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  mcqPillComingSoon: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mcqPillComingSoonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
