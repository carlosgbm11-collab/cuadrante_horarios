import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SHIFT_COLORS, SHIFT_LABELS, ShiftType } from '../lib/types';

interface Props {
  shift: ShiftType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ShiftBadge({ shift, size = 'md', showLabel = false }: Props) {
  const colors = SHIFT_COLORS[shift];
  const fontSize = size === 'sm' ? 10 : size === 'lg' ? 16 : 13;
  const paddingV = size === 'sm' ? 2 : size === 'lg' ? 6 : 3;
  const paddingH = size === 'sm' ? 5 : size === 'lg' ? 12 : 7;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
        },
      ]}
    >
      <Text style={[styles.text, { color: colors.text, fontSize }]}>
        {showLabel ? SHIFT_LABELS[shift] : shift === 'vacation' ? 'VAC' : shift}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
