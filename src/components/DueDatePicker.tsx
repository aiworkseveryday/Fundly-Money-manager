import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, addMonths, formatDay, fromISODate, toISODate } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { AppText } from './AppText';

/** Lightweight date stepper (no native picker needed): -1 month / -1 day / +1 day / +1 month. */
export function DatePickerRow({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
}) {
  const { colors } = useTheme();
  const date = fromISODate(value);
  const set = (d: Date) => {
    const iso = toISODate(d);
    if (min && iso < min) return;
    onChange(iso);
  };
  const btn = (icon: string, onPress: () => void, a11y: string) => (
    <Pressable onPress={onPress} hitSlop={6} accessibilityLabel={a11y} style={[styles.btn, { borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon as never} size={22} color={colors.info} />
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" muted upper>
        {label}
      </AppText>
      <View style={styles.row}>
        {btn('chevron-double-left', () => set(addMonths(date, -1)), 'Previous month')}
        {btn('chevron-left', () => set(addDays(date, -1)), 'Previous day')}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <AppText variant="heading">{formatDay(date)}</AppText>
          <AppText variant="caption" muted>
            {value}
          </AppText>
        </View>
        {btn('chevron-right', () => set(addDays(date, 1)), 'Next day')}
        {btn('chevron-double-right', () => set(addMonths(date, 1)), 'Next month')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  btn: { borderWidth: 2, borderRadius: radius.sm, padding: 6 },
});
