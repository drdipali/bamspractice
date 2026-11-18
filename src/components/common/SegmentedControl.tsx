import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { THEME } from '../../constants/theme';

interface SegmentOption<T> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  style?: ViewStyle;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.container, style]}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.segment, isSelected && styles.segmentSelected]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                isSelected && styles.segmentTextSelected,
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.bg,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: THEME.colors.line,
  },
  segmentSelected: {
    backgroundColor: THEME.colors.brand,
    borderRightColor: THEME.colors.brand,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.ink,
  },
  segmentTextSelected: {
    color: THEME.colors.brandInk,
    fontWeight: '600',
  },
});
