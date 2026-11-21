import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {
  Layers,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  Info,
  Award,
} from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { MockBlueprintItem } from '../../types';
import { DEFAULT_MOCK_BLUEPRINT } from '../../services/backend';

export const AdminMockBlueprint: React.FC = () => {
  const { mockBlueprint, updateMockBlueprint } = useApp();
  const [items, setItems] = useState<MockBlueprintItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mockBlueprint && mockBlueprint.length > 0) {
      setItems(JSON.parse(JSON.stringify(mockBlueprint)));
    } else {
      setItems(JSON.parse(JSON.stringify(DEFAULT_MOCK_BLUEPRINT)));
    }
  }, [mockBlueprint]);

  const totalQuestions = items.reduce(
    (sum, item) => sum + (Number(item.weightage_questions) || 0),
    0
  );
  const isBalanced = totalQuestions === 120;

  const handleWeightageChange = (index: number, valStr: string) => {
    const num = parseInt(valStr.replace(/[^0-9]/g, ''), 10) || 0;
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], weightage_questions: num };
      return copy;
    });
  };

  const handleStepWeightage = (index: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const cur = Number(copy[index].weightage_questions) || 0;
      copy[index] = { ...copy[index], weightage_questions: Math.max(0, cur + delta) };
      return copy;
    });
  };

  const handleToggleHighYield = (index: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], is_high_yield: !copy[index].is_high_yield };
      return copy;
    });
  };

  const handleSubjectNameChange = (index: number, text: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], subject: text };
      return copy;
    });
  };

  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    const newItem: MockBlueprintItem = {
      id: `bp_custom_${Date.now()}`,
      subject: 'New Subject / Topic',
      weightage_questions: 10,
      is_high_yield: false,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleResetDefault = () => {
    setItems(JSON.parse(JSON.stringify(DEFAULT_MOCK_BLUEPRINT)));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMockBlueprint(items);
      setSuccessMessage('Mock Blueprint saved and synced successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Info Banner */}
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleGroup}>
            <Layers size={20} color={THEME.colors.brand} />
            <Text style={styles.headerTitle}>Full-Syllabus Mock Exam Blueprint</Text>
          </View>
          <View style={styles.badgeNTA}>
            <Award size={13} color="#FFFFFF" />
            <Text style={styles.badgeNTAText}>120 Questions · 480 Marks</Text>
          </View>
        </View>

        <Text style={styles.headerSubtitle}>
          Configure the exact distribution of questions for the timed AIAPGET Mock Test.
          Questions are dynamically pulled from the question bank matching each subject's weightage.
          Mark subjects as High-Yield to highlight critical weak areas during post-test review.
        </Text>

        {/* Balance Status Banner */}
        <View style={[styles.statusBanner, isBalanced ? styles.bannerBalanced : styles.bannerImbalanced]}>
          {isBalanced ? (
            <CheckCircle2 size={18} color="#047857" />
          ) : (
            <AlertTriangle size={18} color="#B45309" />
          )}
          <View style={styles.statusTextGroup}>
            <Text style={[styles.statusTitle, isBalanced ? styles.statusTitleOk : styles.statusTitleWarn]}>
              {isBalanced
                ? 'Blueprint Perfectly Balanced: Exactly 120 Questions'
                : `Blueprint Imbalanced: Currently ${totalQuestions} / 120 Questions`}
            </Text>
            <Text style={styles.statusSub}>
              {isBalanced
                ? 'The 120-minute mock generator is set up to pull 100% of its target exam pool.'
                : totalQuestions < 120
                ? `You need ${120 - totalQuestions} more questions to reach 120.`
                : `You have ${totalQuestions - 120} questions over the 120 limit.`}
            </Text>
          </View>
        </View>
      </View>

      {/* Success Notification */}
      {successMessage ? (
        <View style={styles.successToast}>
          <CheckCircle2 size={16} color="#047857" />
          <Text style={styles.successToastText}>{successMessage}</Text>
        </View>
      ) : null}

      {/* Blueprint Table */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={[styles.thText, styles.thSubject]}>Subject / Topic Name</Text>
          <Text style={[styles.thText, styles.thWeightage]}>Weightage (Qs)</Text>
          <Text style={[styles.thText, styles.thHighYield]}>High-Yield</Text>
          <Text style={[styles.thText, styles.thActions]}>Action</Text>
        </View>

        {items.map((item, index) => (
          <View key={item.id || index} style={styles.tableRow}>
            {/* Subject Name Input */}
            <View style={styles.colSubject}>
              <TextInput
                style={styles.subjectInput}
                value={item.subject}
                onChangeText={(txt) => handleSubjectNameChange(index, txt)}
                placeholder="Subject Name..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Weightage Number Stepper */}
            <View style={styles.colWeightage}>
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleStepWeightage(index, -1)}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.weightageInput}
                  value={String(item.weightage_questions)}
                  keyboardType="numeric"
                  onChangeText={(val) => handleWeightageChange(index, val)}
                />

                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => handleStepWeightage(index, 1)}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* High Yield Toggle */}
            <View style={styles.colHighYield}>
              <TouchableOpacity
                style={[
                  styles.highYieldToggle,
                  item.is_high_yield && styles.highYieldToggleActive,
                ]}
                onPress={() => handleToggleHighYield(index)}
                activeOpacity={0.8}
              >
                <Flame
                  size={14}
                  color={item.is_high_yield ? '#DC2626' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.highYieldToggleText,
                    item.is_high_yield && styles.highYieldToggleTextActive,
                  ]}
                >
                  {item.is_high_yield ? 'High Yield' : 'Standard'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Delete Row Action */}
            <View style={styles.colActions}>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteItem(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Table Footer with Live Sum */}
        <View style={styles.tableFooter}>
          <Text style={styles.tableFooterLabel}>Total Allocated Questions:</Text>
          <Text
            style={[
              styles.tableFooterTotal,
              isBalanced ? styles.textOk : styles.textWarn,
            ]}
          >
            {totalQuestions} / 120 Qs ({totalQuestions * 4} Marks)
          </Text>
        </View>
      </View>

      {/* Action Buttons Toolbar */}
      <View style={styles.actionsToolbar}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.addBtn} onPress={handleAddItem}>
            <Plus size={15} color={THEME.colors.brand} />
            <Text style={styles.addBtnText}>Add Subject</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetBtn} onPress={handleResetDefault}>
            <RotateCcw size={14} color="#64748B" />
            <Text style={styles.resetBtnText}>Reset to AIAPGET Default</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Save size={16} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save Blueprint</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Guide Note Box */}
      <View style={styles.guideBox}>
        <Info size={16} color="#2563EB" />
        <Text style={styles.guideText}>
          <Text style={styles.guideBold}>How it works: </Text>
          When students click "Start Full Mock Test", the exam engine samples questions from the question bank matching the defined weightage. If a specific subject has fewer questions than its weightage, the engine automatically backfills from the general pool so students always receive a complete 120-question paper.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  badgeNTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeNTAText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  bannerBalanced: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  bannerImbalanced: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusTextGroup: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusTitleOk: {
    color: '#065F46',
  },
  statusTitleWarn: {
    color: '#92400E',
  },
  statusSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  successToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    borderRadius: 8,
  },
  successToastText: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thSubject: {
    flex: 2,
  },
  thWeightage: {
    flex: 1.2,
    textAlign: 'center',
  },
  thHighYield: {
    flex: 1.2,
    textAlign: 'center',
  },
  thActions: {
    width: 50,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  colSubject: {
    flex: 2,
    paddingRight: 10,
  },
  subjectInput: {
    fontSize: 13,
    color: THEME.colors.ink,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: '500',
  },
  colWeightage: {
    flex: 1.2,
    alignItems: 'center',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  weightageInput: {
    width: 44,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
  },
  colHighYield: {
    flex: 1.2,
    alignItems: 'center',
  },
  highYieldToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  highYieldToggleActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  highYieldToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  highYieldToggleTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  colActions: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: 6,
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
  },
  tableFooterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  tableFooterTotal: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  textOk: {
    color: '#059669',
  },
  textWarn: {
    color: '#D97706',
  },
  actionsToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.brand,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: THEME.colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  guideBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 14,
    borderRadius: 10,
  },
  guideText: {
    flex: 1,
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  guideBold: {
    fontWeight: '700',
  },
});
