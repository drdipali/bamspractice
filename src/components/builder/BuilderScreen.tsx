import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Play, ShoppingBag, ListTree } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Header } from '../common/Header';
import { ChapterTree } from './ChapterTree';
import { BasketSummary } from './BasketSummary';
import { BookmarksPanel } from './BookmarksPanel';
import { useApp } from '../../context/AppContext';
import { ALL_CHAPTERS } from '../../constants/syllabusData';
import { allocateQuestions } from '../../utils/allocator';

export const BuilderScreen: React.FC = () => {
  const { selectedChapters, config, startQuiz } = useApp();
  const { width } = useWindowDimensions();
  const isTablet = width >= 820;

  const [activeTab, setActiveTab] = useState<'tree' | 'basket'>('tree');

  const activeChapters = useMemo(() => {
    return selectedChapters
      .map((id) => ALL_CHAPTERS[id])
      .filter(Boolean);
  }, [selectedChapters]);

  const alloc = useMemo(() => {
    return allocateQuestions(activeChapters, config);
  }, [activeChapters, config]);

  return (
    <View style={styles.container}>
      <Header
        title="Build a practice test"
        subtitle="Tick chapters from any Samhita or subject."
      />

      {/* Mobile Tab Switcher */}
      {!isTablet && (
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
        {isTablet ? (
          // Tablet / Desktop: 2-column Grid
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
          // Mobile: Tab-driven view
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

      {/* Mobile Floating Bottom Bar (.bar from prototype) */}
      {!isTablet && activeTab === 'tree' && selectedChapters.length > 0 && (
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
});
