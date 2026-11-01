import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, tint } from '@/theme/tokens';
import { AppText } from './AppText';
import type { IconName } from './Button3D';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: string;
};

export function Chip({ label, selected, onPress, color, icon }: Props) {
  const { colors } = useTheme();
  const accent = color ?? colors.info;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      <View
        style={[
          styles.chip,
          {
            borderColor: selected ? accent : colors.border,
            backgroundColor: selected ? tint(accent, 0.15) : colors.surface,
          },
        ]}>
        {icon && <MaterialCommunityIcons name={icon as IconName} size={18} color={selected ? accent : colors.textMuted} />}
        <AppText variant="caption" color={selected ? accent : colors.textMuted}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Wrapping row of chips */
export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
