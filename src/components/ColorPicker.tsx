import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, swatches, tint } from '@/theme/tokens';
import { AppText } from './AppText';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" muted upper>
        Color
      </AppText>
      <View style={styles.row}>
        {swatches.map((c) => (
          <Pressable key={c} onPress={() => onChange(c)} accessibilityLabel={`Color ${c}`} style={[styles.swatch, { backgroundColor: c }]}>
            {value === c && <MaterialCommunityIcons name="check-bold" size={20} color="#fff" />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function IconPicker({ icons, value, color, onChange }: { icons: string[]; value: string; color: string; onChange: (i: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" muted upper>
        Icon
      </AppText>
      <View style={styles.row}>
        {icons.map((i) => (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            accessibilityLabel={i}
            style={[styles.icon, { borderColor: value === i ? color : colors.border, backgroundColor: value === i ? tint(color, 0.15) : colors.surface }]}>
            <MaterialCommunityIcons name={i as never} size={24} color={value === i ? color : colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
