import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { THEME } from '../../constants/theme';

interface SaveSetModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName: string;
}

export const SaveSetModal: React.FC<SaveSetModalProps> = ({
  visible,
  onClose,
  onSave,
  defaultName,
}) => {
  const [name, setName] = useState(defaultName);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      onClose();
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>Save Practice Set</Text>
          <Text style={styles.description}>
            Save your selected chapters and configuration for one-tap practice anytime.
          </Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Charaka Nidana & Chikitsa Revision"
            placeholderTextColor={THEME.colors.muted}
            autoFocus
            selectTextOnFocus
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onClose}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.saveBtn]}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>Save Preset</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.ink,
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: THEME.colors.muted,
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    backgroundColor: THEME.colors.bg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.colors.ink,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: THEME.radius.md,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: THEME.colors.line,
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    fontSize: 14,
    color: THEME.colors.muted,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: THEME.colors.brand,
  },
  saveBtnText: {
    fontSize: 14,
    color: THEME.colors.brandInk,
    fontWeight: '600',
  },
});
