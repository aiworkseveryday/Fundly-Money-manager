import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { AppText } from './AppText';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

/** Applies a keypad press to the amount string, enforcing max 2 decimals and a sane length. */
export function pressKey(value: string, key: string): string {
  if (key === 'del') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : (value || '0') + '.';
  const [int, frac] = value.split('.');
  if (frac !== undefined && frac.length >= 2) return value;
  if (frac === undefined && int.length >= 9) return value;
  if (value === '0') return key;
  return value + key;
}

export function AmountPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          style={styles.cell}
          accessibilityLabel={k === 'del' ? 'Delete' : k}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(pressKey(value, k));
          }}
          onLongPress={() => k === 'del' && onChange('')}>
          {({ pressed }) => (
            <View
              style={[
                styles.key,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderBottomWidth: pressed ? 2 : 4,
                  marginTop: pressed ? 2 : 0,
                },
              ]}>
              {k === 'del' ? (
                <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.textMuted} />
              ) : (
                <AppText variant="title">{k}</AppText>
              )}
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  cell: { width: '33.333%', paddingHorizontal: 4 },
  key: { height: 52, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
