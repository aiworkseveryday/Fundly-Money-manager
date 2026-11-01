import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Solid colored card (e.g. hero balance) instead of outlined */
  fill?: string;
  edge?: string;
};

/** Outlined card with a thicker bottom border, matching the 3D buttons. */
export function Card({ children, onPress, style, fill, edge }: Props) {
  const { colors } = useTheme();
  const body = (pressed: boolean) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: fill ?? colors.surface,
          borderColor: fill ?? colors.border,
          borderBottomColor: edge ?? colors.border,
          borderBottomWidth: pressed ? 2 : 4,
          marginTop: pressed ? 2 : 0,
        },
        style,
      ]}>
      {children}
    </View>
  );
  if (!onPress) return body(false);
  return <Pressable onPress={onPress}>{({ pressed }) => body(pressed)}</Pressable>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: radius.lg, padding: space.lg },
});
