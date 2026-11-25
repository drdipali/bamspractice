import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { Trash2, Play, BookOpen, Layers, CheckCircle2, Plus, Minus } from 'lucide-react-native';
import { THEME, DIFFICULTY_LABELS } from '../../constants/theme';
import { getChapterPath } from '../../constants/syllabusData';
import { Chapter, Difficulty, DistributionType, QuizMode, SavedPracticeSet } from '../../types';
import { useApp } from '../../context/AppContext';
import { allocateQuestions } from '../../utils/allocator';
import { isQuestionChapterVerified, isValidQuestion } from '../../utils/chapterMapper';
import { SegmentedControl } from '../common/SegmentedControl';
import { SaveSetModal } from './SaveSetModal';

export const BasketSummary: React.FC = () => {
  const {
    chapters,
    selectedChapters,
    toggleChapter,
    clearSelection,
    config,
    updateConfig,
    setManualCount,
    toggleDifficulty,
    savedSets,
    saveCurrentSet,
    loadSet,
    deleteSet,
    startQuiz,
    statusMessage,
    practiceMode,
  } = useApp();

  const [modalVisible, setModalVisible] = useState(false);

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

  // Unique sources
  const sourceCount = useMemo(() => {
    const set = new Set(activeChapters.map((c) => c.sam));
    return set.size;
  }, [activeChapters]);

  // Allocation metrics
  const alloc = useMemo(() => {
    return allocateQuestions(activeChapters, config, practiceMode === 'chapter_verified');
  }, [activeChapters, config, practiceMode]);

  // Distribution options
  const distOptions: { value: DistributionType; label: string }[] = [
    { value: 'pooled', label: 'Pooled' },
    { value: 'equal', label: 'Equal' },
    { value: 'proportional', label: 'Proportional' },
    { value: 'manual', label: 'Manual' },
  ];

  // Mode options
  const modeOptions: { value: QuizMode; label: string }[] = [
    { value: 'learning', label: 'Learning' },
    { value: 'test', label: 'Test' },
  ];

  // Local state for smooth numeric input editing
  const [totalStr, setTotalStr] = useState<string>(String(config.total));

  useEffect(() => {
    setTotalStr(String(config.total));
  }, [config.total]);

  const handleTotalChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setTotalStr(clean);
    if (clean !== '') {
      const val = parseInt(clean, 10);
      if (!isNaN(val) && val > 0) {
        updateConfig({ total: Math.min(500, val) });
      }
    }
  };

  const handleTotalBlur = () => {
    if (!totalStr || parseInt(totalStr, 10) < 1) {
      setTotalStr('1');
      updateConfig({ total: 1 });
    } else {
      const val = Math.max(1, Math.min(500, parseInt(totalStr, 10)));
      setTotalStr(String(val));
      updateConfig({ total: val });
    }
  };

  const stepTotal = (delta: number) => {
    const cur = parseInt(totalStr, 10) || config.total || 1;
    const next = Math.max(1, Math.min(500, cur + delta));
    setTotalStr(String(next));
    updateConfig({ total: next });
  };

  const setPresetTotal = (count: number) => {
    const next = Math.max(1, Math.min(500, count));
    setTotalStr(String(next));
    updateConfig({ total: next });
  };

  const handleManualCountChange = (chapterId: string | number, text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    const val = clean === '' ? 0 : parseInt(clean, 10);
    setManualCount(chapterId, isNaN(val) ? 0 : val);
  };

  const confirmDeleteSet = (set: SavedPracticeSet) => {
    Alert.alert(
      'Delete Practice Set',
      `Are you sure you want to delete "${set.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSet(set.id),
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Your practice basket</Text>

      {/* Stats Counter Row */}
      <View style={styles.statRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{activeChapters.length}</Text>
          <Text style={styles.statLabel}>chapters</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{sourceCount}</Text>
          <Text style={styles.statLabel}>sources</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{alloc.totalEligible}</Text>
          <Text style={styles.statLabel}>eligible MCQs</Text>
        </View>
      </View>

      {/* Selected Chapters Chips Area */}
      {activeChapters.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No chapters yet. Select chapters on the left to start building your test.
          </Text>
        </View>
      ) : (
        <View style={styles.chipsSection}>
          <View style={styles.chipsContainer}>
            {activeChapters.map((chapter) => (
              <View key={chapter.id} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {chapter.sam.slice(0, 10)} · Ch {chapter.n}
                </Text>
                <TouchableOpacity
                  style={styles.chipRemoveBtn}
                  onPress={() => toggleChapter(chapter.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.chipRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.clearBtn} onPress={clearSelection}>
            <Text style={styles.clearBtnText}>Clear all chapters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Configuration Controls */}
      <View style={styles.cfgGrid}>
        {/* Total Questions with Stepper & Quick Presets */}
        <View style={styles.cfgItem}>
          <View style={styles.cfgLabelRow}>
            <Text style={styles.cfgLabel}>Total questions</Text>
            {config.dist !== 'manual' && (
              <Text style={styles.cfgSubLabel}>
                Eligible: {alloc.totalEligible}
              </Text>
            )}
          </View>

          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={[
                styles.stepperBtn,
                (config.total <= 1 || config.dist === 'manual') &&
                  styles.stepperBtnDisabled,
              ]}
              onPress={() => stepTotal(-1)}
              disabled={config.total <= 1 || config.dist === 'manual'}
              accessibilityLabel="Decrease question count"
            >
              <Minus
                size={18}
                color={
                  config.total <= 1 || config.dist === 'manual'
                    ? THEME.colors.muted
                    : THEME.colors.ink
                }
              />
            </TouchableOpacity>

            <TextInput
              style={[
                styles.inInput,
                styles.inInputCenter,
                config.dist === 'manual' && styles.inInputDisabled,
              ]}
              keyboardType="number-pad"
              value={totalStr}
              onChangeText={handleTotalChange}
              onBlur={handleTotalBlur}
              editable={config.dist !== 'manual'}
              placeholder="1"
              placeholderTextColor={THEME.colors.muted}
            />

            <TouchableOpacity
              style={[
                styles.stepperBtn,
                (config.total >= 500 || config.dist === 'manual') &&
                  styles.stepperBtnDisabled,
              ]}
              onPress={() => stepTotal(1)}
              disabled={config.total >= 500 || config.dist === 'manual'}
              accessibilityLabel="Increase question count"
            >
              <Plus
                size={18}
                color={
                  config.total >= 500 || config.dist === 'manual'
                    ? THEME.colors.muted
                    : THEME.colors.ink
                }
              />
            </TouchableOpacity>
          </View>

          {/* Quick Preset Buttons */}
          {config.dist !== 'manual' && (
            <View style={styles.presetsContainer}>
              <Text style={styles.presetsHeading}>Quick select:</Text>
              <View style={styles.presetsList}>
                {[2, 5, 10, 20, 50].map((presetCount) => (
                  <TouchableOpacity
                    key={presetCount}
                    style={[
                      styles.presetChip,
                      config.total === presetCount && styles.presetChipActive,
                    ]}
                    onPress={() => setPresetTotal(presetCount)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        config.total === presetCount && styles.presetChipTextActive,
                      ]}
                    >
                      {presetCount} Qs
                    </Text>
                  </TouchableOpacity>
                ))}
                {alloc.totalEligible > 0 &&
                  ![2, 5, 10, 20, 50].includes(alloc.totalEligible) && (
                    <TouchableOpacity
                      style={[
                        styles.presetChip,
                        config.total === alloc.totalEligible &&
                          styles.presetChipActive,
                      ]}
                      onPress={() => setPresetTotal(alloc.totalEligible)}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          config.total === alloc.totalEligible &&
                            styles.presetChipTextActive,
                        ]}
                      >
                        All ({alloc.totalEligible})
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>
            </View>
          )}
        </View>

        {/* Distribution Selection */}
        <View style={styles.cfgItem}>
          <Text style={styles.cfgLabel}>Distribution</Text>
          <SegmentedControl
            options={distOptions}
            value={config.dist}
            onChange={(d) => updateConfig({ dist: d })}
          />
        </View>

        {/* Difficulty Multiselect */}
        <View style={styles.cfgItem}>
          <Text style={styles.cfgLabel}>Difficulty (Tap to toggle)</Text>
          <View style={styles.diffRow}>
            {([0, 1, 2] as Difficulty[]).map((d) => {
              const active = config.diffs.includes(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.diffBtn, active && styles.diffBtnActive]}
                  onPress={() => toggleDifficulty(d)}
                >
                  <Text
                    style={[
                      styles.diffBtnText,
                      active && styles.diffBtnTextActive,
                    ]}
                  >
                    {DIFFICULTY_LABELS[d]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Mode Toggle */}
        <View style={styles.cfgItem}>
          <Text style={styles.cfgLabel}>Practice mode</Text>
          <SegmentedControl
            options={modeOptions}
            value={config.mode}
            onChange={(m) => updateConfig({ mode: m })}
          />
        </View>
      </View>

      {/* Allocation Breakdown Table */}
      {activeChapters.length > 0 && (
        <View style={styles.tableCard}>
          <Text style={styles.tableHeaderTitle}>Distribution Breakdown</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.thText, { flex: 2 }]}>Chapter</Text>
            <Text style={[styles.thText, styles.thRight, { flex: 1 }]}>
              Pool
            </Text>
            <Text style={[styles.thText, styles.thRight, { flex: 1.4 }]}>
              {config.dist === 'manual' ? 'Custom' : 'Draw'}
            </Text>
          </View>

          {activeChapters.map((chapter, idx) => {
            const available = alloc.available[idx];
            const allocatedCount = alloc.allocated
              ? alloc.allocated[idx]
              : 'random';

            return (
              <View key={chapter.id} style={styles.tableRow}>
                <Text style={[styles.tdText, { flex: 2 }]} numberOfLines={1}>
                  {getChapterPath(chapter)}
                </Text>
                <Text style={[styles.tdText, styles.tdRight, { flex: 1 }]}>
                  {available}
                </Text>
                <View style={[styles.tdRightContainer, { flex: 1.4 }]}>
                  {config.dist === 'manual' ? (
                    <View style={styles.manualStepperRow}>
                      <TouchableOpacity
                        style={styles.miniStepperBtn}
                        onPress={() => {
                          const cur = config.manual[chapter.id] || 0;
                          setManualCount(chapter.id, Math.max(0, cur - 1));
                        }}
                        accessibilityLabel="Minus one MCQ"
                      >
                        <Minus size={12} color={THEME.colors.ink} />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.manualInput}
                        keyboardType="number-pad"
                        value={String(config.manual[chapter.id] ?? 0)}
                        onChangeText={(val) =>
                          handleManualCountChange(chapter.id, val)
                        }
                      />
                      <TouchableOpacity
                        style={styles.miniStepperBtn}
                        onPress={() => {
                          const cur = config.manual[chapter.id] || 0;
                          setManualCount(
                            chapter.id,
                            Math.min(available, cur + 1)
                          );
                        }}
                        accessibilityLabel="Plus one MCQ"
                      >
                        <Plus size={12} color={THEME.colors.ink} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[styles.tdText, styles.tdRight]}>
                      {allocatedCount}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Helper Note */}
      {activeChapters.length > 0 && (
        <Text
          style={[
            styles.noteText,
            config.total > alloc.totalEligible &&
              config.dist !== 'manual' &&
              styles.warnText,
          ]}
        >
          {config.dist === 'manual'
            ? `Test will draw ${alloc.finalCount} questions configured manually.`
            : config.total > alloc.totalEligible
            ? `Only ${alloc.totalEligible} questions match your difficulty filter, so the test will have ${alloc.finalCount}.`
            : `Test will have ${alloc.finalCount} questions, drawn only from these ${activeChapters.length} chapters.`}
        </Text>
      )}

      {statusMessage ? (
        <View style={styles.statusBox}>
          <CheckCircle2 size={16} color={THEME.colors.ok} />
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Main Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            (activeChapters.length === 0 || alloc.finalCount === 0) &&
              styles.btnDisabled,
          ]}
          disabled={activeChapters.length === 0 || alloc.finalCount === 0}
          onPress={() => startQuiz()}
        >
          <Play size={18} color={THEME.colors.brandInk} />
          <Text style={styles.primaryBtnText}>
            Generate practice test ({alloc.finalCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryBtn,
            activeChapters.length === 0 && styles.btnDisabled,
          ]}
          disabled={activeChapters.length === 0}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.secondaryBtnText}>Save as preset</Text>
        </TouchableOpacity>
      </View>

      {/* Saved Sets Section */}
      <View style={styles.savedSetsSection}>
        <Text style={styles.savedSetsTitle}>My Practice Sets</Text>
        {savedSets.length === 0 ? (
          <View style={styles.emptySavedBox}>
            <Text style={styles.emptySavedText}>
              Saved chapter combinations appear here for one-tap reuse anytime.
            </Text>
          </View>
        ) : (
          savedSets.map((set) => (
            <View key={set.id} style={styles.setItem}>
              <View style={styles.setItemInfo}>
                <Text style={styles.setItemName} numberOfLines={1}>
                  {set.name}
                </Text>
                <Text style={styles.setItemDetails}>
                  {set.sel.length} chapters · {set.cfg.total} Qs · {set.cfg.dist}
                </Text>
              </View>
              <View style={styles.setItemActions}>
                <TouchableOpacity
                  style={styles.setLoadBtn}
                  onPress={() => loadSet(set)}
                >
                  <Text style={styles.setLoadBtnText}>Load</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.setStartBtn}
                  onPress={() => {
                    loadSet(set);
                    startQuiz();
                  }}
                >
                  <Play size={13} color={THEME.colors.brandInk} />
                  <Text style={styles.setStartBtnText}>Start</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.setDeleteBtn}
                  onPress={() => confirmDeleteSet(set)}
                >
                  <Trash2 size={15} color={THEME.colors.bad} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Save Modal */}
      <SaveSetModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={saveCurrentSet}
        defaultName={`Set ${savedSets.length + 1}`}
      />
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
    marginBottom: 20,
  },
  cardTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statBox: {
    minWidth: 80,
  },
  statNumber: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    fontWeight: '700',
    color: THEME.colors.ink,
    lineHeight: 30,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.colors.muted,
  },
  emptyBox: {
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
    marginBottom: 16,
  },
  emptyText: {
    color: THEME.colors.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  chipsSection: {
    marginBottom: 16,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.soft,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    color: THEME.colors.ink,
    maxWidth: 160,
  },
  chipRemoveBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  chipRemoveText: {
    fontSize: 14,
    color: THEME.colors.muted,
    lineHeight: 16,
  },
  clearBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  clearBtnText: {
    fontSize: 12,
    color: THEME.colors.brand,
    fontWeight: '600',
  },
  cfgGrid: {
    gap: 14,
    marginBottom: 16,
  },
  cfgItem: {
    gap: 6,
  },
  cfgLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  cfgLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  cfgSubLabel: {
    fontSize: 12,
    color: THEME.colors.muted,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  inInput: {
    backgroundColor: THEME.colors.bg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: THEME.colors.ink,
  },
  inInputCenter: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    height: 44,
  },
  inInputDisabled: {
    opacity: 0.5,
  },
  presetsContainer: {
    marginTop: 4,
    gap: 6,
  },
  presetsHeading: {
    fontSize: 11,
    color: THEME.colors.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  presetChipActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.ink,
  },
  presetChipTextActive: {
    color: THEME.colors.brandInk,
  },
  diffRow: {
    flexDirection: 'row',
    gap: 8,
  },
  diffBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    backgroundColor: THEME.colors.bg,
  },
  diffBtnActive: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  diffBtnText: {
    fontSize: 13,
    color: THEME.colors.ink,
    fontWeight: '500',
  },
  diffBtnTextActive: {
    color: THEME.colors.brandInk,
    fontWeight: '600',
  },
  tableCard: {
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
    padding: 10,
    backgroundColor: THEME.colors.bg,
    marginBottom: 12,
  },
  tableHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
    paddingBottom: 6,
    marginBottom: 6,
  },
  thText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.muted,
  },
  thRight: {
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tdText: {
    fontSize: 12,
    color: THEME.colors.ink,
  },
  tdRight: {
    textAlign: 'right',
  },
  tdRightContainer: {
    alignItems: 'flex-end',
  },
  manualStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualInput: {
    width: 44,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
    fontSize: 12,
    textAlign: 'center',
    color: THEME.colors.ink,
  },
  noteText: {
    fontSize: 12,
    color: THEME.colors.muted,
    marginBottom: 14,
    lineHeight: 16,
  },
  warnText: {
    color: THEME.colors.bad,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.okSoft,
    padding: 10,
    borderRadius: THEME.radius.md,
    marginBottom: 14,
  },
  statusText: {
    fontSize: 13,
    color: THEME.colors.ok,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  primaryBtn: {
    flex: 2,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
  },
  primaryBtnText: {
    color: THEME.colors.brandInk,
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
  },
  secondaryBtnText: {
    color: THEME.colors.brand,
    fontWeight: '600',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  savedSetsSection: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    paddingTop: 16,
  },
  savedSetsTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 10,
  },
  emptySavedBox: {
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
  },
  emptySavedText: {
    fontSize: 12,
    color: THEME.colors.muted,
    textAlign: 'center',
  },
  setItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
    gap: 10,
  },
  setItemInfo: {
    flex: 1,
  },
  setItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.ink,
  },
  setItemDetails: {
    fontSize: 12,
    color: THEME.colors.muted,
    marginTop: 2,
  },
  setItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setLoadBtn: {
    borderWidth: 1,
    borderColor: THEME.colors.line,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.sm,
  },
  setLoadBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.ink,
  },
  setStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.brand,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.sm,
  },
  setStartBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.brandInk,
  },
  setDeleteBtn: {
    padding: 6,
  },
});
