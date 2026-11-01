import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { addMonths, formatMonth, startOfMonth } from '@/lib/dates';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

export function MonthSwitcher({ month, onChange }: { month: Date; onChange: (d: Date) => void }) {
  const { colors } = useTheme();
  const isCurrent = startOfMonth(month).getTime() >= startOfMonth(new Date()).getTime();
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange(addMonths(month, -1))} hitSlop={10} accessibilityLabel="Previous month">
        <MaterialCommunityIcons name="chevron-left" size={30} color={colors.info} />
      </Pressable>
      <AppText variant="heading" style={{ minWidth: 110, textAlign: 'center' }}>
        {formatMonth(month)}
      </AppText>
      <Pressable
        onPress={() => !isCurrent && onChange(addMonths(month, 1))}
        hitSlop={10}
        disabled={isCurrent}
        accessibilityLabel="Next month">
        <MaterialCommunityIcons name="chevron-right" size={30} color={isCurrent ? colors.border : colors.info} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
