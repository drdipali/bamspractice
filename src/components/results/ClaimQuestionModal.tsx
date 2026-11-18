import React, { useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { AlertCircle, Camera, Check, Upload, X } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { Question } from '../../types';
import { ALL_CHAPTERS, getChapterPath } from '../../constants/syllabusData';

interface ClaimQuestionModalProps {
  visible: boolean;
  question: Question | null;
  onClose: () => void;
  onSubmit: (questionId: number, comment: string, fileName?: string) => void;
}

export const ClaimQuestionModal: React.FC<ClaimQuestionModalProps> = ({
  visible,
  question,
  onClose,
  onSubmit,
}) => {
  const [comment, setComment] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  if (!question) return null;

  const chapter = ALL_CHAPTERS[question.ch];

  const handleFileChange = (e: any) => {
    if (e?.target?.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFileName(file.name);
    }
  };

  const handleMockUpload = () => {
    // Fallback for native/mock environments
    setFileName('charaka_samhita_page_ref.jpg');
  };

  const handleSubmit = () => {
    if (comment.trim().length === 0) {
      alert('Please enter a brief explanation or comment regarding the claim.');
      return;
    }
    onSubmit(question.id, comment.trim(), fileName || undefined);
    setComment('');
    setFileName(null);
  };

  const handleClose = () => {
    setComment('');
    setFileName(null);
    onClose();
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleGroup}>
              <AlertCircle size={20} color={THEME.colors.bad} />
              <Text style={styles.modalTitle}>Report / Claim Error</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <X size={18} color={THEME.colors.muted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.questionRef}>
            Challenging Question #{question.id}
            {chapter ? ` · ${getChapterPath(chapter)}` : ''}
          </Text>

          <ScrollView style={styles.bodyScroll}>
            {/* Question Stem preview */}
            <View style={styles.stemPreviewBox}>
              <Text style={styles.stemPreviewText} numberOfLines={2}>
                "{question.stem}"
              </Text>
            </View>

            {/* Field 1: Explanation / Comment */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Explanation / Discrepancy details <Text style={styles.req}>*</Text>
              </Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                placeholder="State why you believe this answer key or question is incorrect. Cite classical verse numbers or editions if possible..."
                placeholderTextColor={THEME.colors.muted}
                textAlignVertical="top"
              />
            </View>

            {/* Field 2: Image Upload Input (type="file" accept="image/*") */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Reference book photo evidence
              </Text>
              <Text style={styles.fieldHint}>
                Upload a clear photo of the textbook page or commentary citation.
              </Text>

              {Platform.OS === 'web' ? (
                <View style={styles.webFileInputContainer}>
                  {/* Real HTML5 file input on web platform */}
                  <input
                    type="file"
                    accept="image/*"
                    id="claim-image-upload"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      border: `1px dashed ${THEME.colors.line}`,
                      borderRadius: '8px',
                      backgroundColor: THEME.colors.bg,
                      color: THEME.colors.ink,
                      cursor: 'pointer',
                    }}
                    onChange={handleFileChange}
                  />
                  {fileName ? (
                    <View style={styles.selectedFileBadge}>
                      <Camera size={14} color={THEME.colors.brand} />
                      <Text style={styles.selectedFileName} numberOfLines={1}>
                        Selected: {fileName}
                      </Text>
                      <TouchableOpacity onPress={() => setFileName(null)}>
                        <X size={14} color={THEME.colors.muted} />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : (
                // Native mobile fallback button
                <View>
                  {fileName ? (
                    <View style={styles.selectedFileBadge}>
                      <Camera size={14} color={THEME.colors.brand} />
                      <Text style={styles.selectedFileName} numberOfLines={1}>
                        {fileName}
                      </Text>
                      <TouchableOpacity onPress={() => setFileName(null)}>
                        <X size={14} color={THEME.colors.muted} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.mockUploadBtn}
                      onPress={handleMockUpload}
                    >
                      <Upload size={16} color={THEME.colors.brand} />
                      <Text style={styles.mockUploadText}>
                        Choose photo of reference book
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={handleClose}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.submitBtn]}
              onPress={handleSubmit}
            >
              <Text style={styles.submitBtnText}>Submit Claim</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.ink,
  },
  closeBtn: {
    padding: 4,
  },
  questionRef: {
    fontSize: 12,
    color: THEME.colors.muted,
    marginBottom: 14,
  },
  bodyScroll: {
    maxHeight: 380,
  },
  stemPreviewBox: {
    backgroundColor: THEME.colors.bg,
    padding: 10,
    borderRadius: THEME.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.brand,
    marginBottom: 14,
  },
  stemPreviewText: {
    fontSize: 12,
    color: THEME.colors.ink,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.ink,
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 11,
    color: THEME.colors.muted,
    marginBottom: 8,
  },
  req: {
    color: THEME.colors.bad,
  },
  textArea: {
    backgroundColor: THEME.colors.bg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
    padding: 12,
    fontSize: 13,
    color: THEME.colors.ink,
    minHeight: 90,
  },
  webFileInputContainer: {
    gap: 8,
  },
  selectedFileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  selectedFileName: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.ink,
  },
  mockUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.soft,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
  },
  mockUploadText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    paddingTop: 14,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  cancelBtnText: {
    fontSize: 13,
    color: THEME.colors.muted,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: THEME.colors.brand,
  },
  submitBtnText: {
    fontSize: 13,
    color: THEME.colors.brandInk,
    fontWeight: '700',
  },
});
