import React, { useState, useMemo, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Play, ShoppingBag, ListTree, BookOpen, Layers, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Header } from '../common/Header';
import { ChapterTree } from './ChapterTree';
import { BasketSummary } from './BasketSummary';
import { BookmarksPanel } from './BookmarksPanel';
import { FullMockTestPanel } from './FullMockTestPanel';
import { useApp } from '../../context/AppContext';
import { Chapter } from '../../types';
import { allocateQuestions } from '../../utils/allocator';
import { isQuestionChapterVerified, isValidQuestion } from '../../utils/chapterMapper';

export const BuilderScreen: React.FC = () => {
  const {
    chapters,
    selectedChapters,
    config,
    startQuiz,
    practiceMode,
    setPracticeMode,
    refreshQuestions,
    cloudSyncError,
    isSyncing,
  } = useApp();
  const { width } = useWindowDimensions();
  const isTablet = width >= 820;

  useEffect(() => {
    if (refreshQuestions) refreshQuestions();
  }, []);

  const [activeTab, setActiveTab] = useState<'tree' | 'basket'>('tree');

  const activeChapters = useMemo(() => {
    return selectedChapters
      .map((id) => chapters.find((c) => c.id === id || c.name === id))
      .filter((c): c is Chapter => c !== undefined)
      .map((c) => ({
        ...c,
        qs: c.qs.filter((q) =>
          practiceMode === 'chapter_verified'
            ? isQuestionChapterVerified(q) && isValidQuestion(q)
            : isValidQuestion(q)
        ),
      }));
  }, [selectedChapters, chapters, practiceMode]);

  const alloc = useMemo(() => {
    return allocateQuestions(activeChapters, config, practiceMode === 'chapter_verified');
  }, [activeChapters, config, practiceMode]);

  return (
    <View style={styles.container}>
      <Header
        title={practiceMode === 'chapter_verified' ? 'Chapter-Wise Practice' : 'Mixed Practice & Mock Tests'}
        subtitle={
          practiceMode === 'chapter_verified'
            ? 'Practicing strictly verified, chapter-accurate questions.'
            : 'Access full-syllabus AIAPGET weighted mock tests and practice pools.'
        }
      />

      {/* Practice Mode Switcher: Chapter-Wise Verified vs Mixed / Mock Practice */}
      <View style={styles.practiceModeContainer}>
        <View style={styles.practiceModeSegment}>
          <TouchableOpacity
            style={[
              styles.modeSegmentBtn,
              practiceMode === 'chapter_verified' && styles.modeSegmentBtnActiveVerified,
            ]}
            onPress={() => setPracticeMode('chapter_verified')}
            activeOpacity={0.8}
          >
            <View style={styles.modeIconTitleRow}>
              <BookOpen
                size={16}
                color={practiceMode === 'chapter_verified' ? '#047857' : THEME.colors.muted}
              />
              <Text
                style={[
                  styles.modeSegmentTitle,
                  practiceMode === 'chapter_verified' && styles.modeSegmentTitleActiveVerified,
                ]}
              >
                Chapter-Wise Practice
              </Text>
            </View>
            <Text style={styles.modeSegmentSub}>✓ Verified accurate questions only</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeSegmentBtn,
              practiceMode === 'mixed_mock' && styles.modeSegmentBtnActiveMock,
            ]}
            onPress={() => setPracticeMode('mixed_mock')}
            activeOpacity={0.8}
          >
            <View style={styles.modeIconTitleRow}>
              <Layers
                size={16}
                color={practiceMode === 'mixed_mock' ? '#1D4ED8' : THEME.colors.muted}
              />
              <Text
                style={[
                  styles.modeSegmentTitle,
                  practiceMode === 'mixed_mock' && styles.modeSegmentTitleActiveMock,
                ]}
              >
                Mixed &amp; Mock Tests
              </Text>
            </View>
            <Text style={styles.modeSegmentSub}>Full-Syllabus Mock Engine</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mobile Tab Switcher - Only shown in Chapter-Wise Practice mode */}
      {!isTablet && practiceMode === 'chapter_verified' && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'tree' && styles.tabBtnActive]}
            onPress={() => setActiveTab('tree')}
          >
            <ListTree
              size={16}
              color={
                activeTab === 'tree'
                  ? THEME.colors.brand
                  : THEME.colors.muted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'tree' && styles.tabTextActive,
              ]}
            >
              Chapters ({selectedChapters.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'basket' && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab('basket')}
          >
            <ShoppingBag
              size={16}
              color={
                activeTab === 'basket'
                  ? THEME.colors.brand
                  : THEME.colors.muted
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'basket' && styles.tabTextActive,
              ]}
            >
              Basket & Config ({alloc.finalCount} Qs)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content Area */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          !isTablet && styles.scrollContentMobile,
        ]}
      >
        {/* Visible Cloud DB Error Banner with Retry button */}
        {cloudSyncError && (
          <View style={styles.errorBanner}>
            <View style={styles.errorBannerLeft}>
              <AlertCircle size={18} color="#DC2626" style={{ marginTop: 2 }} />
              <View style={styles.errorBannerTextCol}>
                <Text style={styles.errorBannerTitle}>Cloud Question Sync Notice</Text>
                <Text style={styles.errorBannerMsg}>{cloudSyncError}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.retryBannerBtn}
              onPress={() => refreshQuestions && refreshQuestions(true)}
              disabled={isSyncing}
              activeOpacity={0.7}
            >
              <RefreshCw size={13} color="#FFFFFF" />
              <Text style={styles.retryBannerBtnText}>
                {isSyncing ? 'Retrying...' : 'Retry'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {practiceMode === 'mixed_mock' ? (
          // Full-Syllabus AIAPGET Mock Test View
          <FullMockTestPanel />
        ) : isTablet ? (
          // Tablet / Desktop: 2-column Grid for Chapter-Wise Practice
          <View style={styles.grid}>
            <View style={styles.leftCol}>
              <BookmarksPanel />
              <ChapterTree />
            </View>
            <View style={styles.rightCol}>
              <BasketSummary />
            </View>
          </View>
        ) : (
          // Mobile: Tab-driven view for Chapter-Wise Practice
          <View>
            {activeTab === 'tree' ? (
              <>
                <BookmarksPanel />
                <ChapterTree />
              </>
            ) : (
              <BasketSummary />
            )}
          </View>
        )}
      </ScrollView>

      {/* Mobile Floating Bottom Bar - Only shown in Chapter-Wise Practice mode */}
      {!isTablet &&
        practiceMode === 'chapter_verified' &&
        activeTab === 'tree' &&
        selectedChapters.length > 0 && (
          <View style={styles.floatingBar}>
            <View style={styles.barInfo}>
              <Text style={styles.barCount}>
                {selectedChapters.length} chapters · {alloc.totalEligible} MCQs
              </Text>
              <Text style={styles.barSub}>
                {alloc.finalCount} test questions configured
              </Text>
            </View>

            <TouchableOpacity
              style={styles.reviewBasketBtn}
              onPress={() => setActiveTab('basket')}
            >
              <ShoppingBag size={15} color={THEME.colors.brandInk} />
              <Text style={styles.reviewBasketText}>Review basket</Text>
            </TouchableOpacity>
          </View>
        )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  practiceModeContainer: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
  },
  practiceModeSegment: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  modeSegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  modeSegmentBtnActiveVerified: {
    backgroundColor: '#FFFFFF',
    borderColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  modeSegmentBtnActiveMock: {
    backgroundColor: '#FFFFFF',
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  modeIconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeSegmentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.muted,
  },
  modeSegmentTitleActiveVerified: {
    color: '#047857',
  },
  modeSegmentTitleActiveMock: {
    color: '#1D4ED8',
  },
  modeSegmentSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: THEME.colors.brand,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  tabTextActive: {
    color: THEME.colors.brand,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContentMobile: {
    paddingBottom: 90, // Space for floating bottom bar
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  leftCol: {
    flex: 1.1,
  },
  rightCol: {
    flex: 1,
  },
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
  barInfo: {
    flex: 1,
  },
  barCount: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  barSub: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginTop: 1,
  },
  reviewBasketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
  },
  reviewBasketText: {
    color: THEME.colors.brandInk,
    fontWeight: '700',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: THEME.radius.md,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  errorBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  errorBannerTextCol: {
    flex: 1,
  },
  errorBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  errorBannerMsg: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 16,
  },
  retryBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  retryBannerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
