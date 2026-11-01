import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, shade } from '@/theme/tokens';
import { AppText } from './AppText';

type Tone = 'primary' | 'info' | 'danger' | 'warning' | 'ghost' | 'outline';
export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const EDGE = 4;

type Props = {
  title: string;
  onPress?: () => void;
  tone?: Tone;
  /** Overrides the tone with any color (edge is derived) */
  color?: string;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Chunky button that sinks into its darker bottom edge when pressed. */
export function Button3D({ title, onPress, tone = 'primary', color, icon, loading, disabled, small, style }: Props) {
  const { colors } = useTheme();

  const tones: Record<Tone, { bg: string; edge: string; fg: string; outlined?: boolean }> = {
    primary: { bg: colors.primary, edge: colors.primaryEdge, fg: palette.white },
    info: { bg: colors.info, edge: colors.infoEdge, fg: palette.white },
    danger: { bg: colors.danger, edge: colors.dangerEdge, fg: palette.white },
    warning: { bg: palette.orange, edge: palette.orangeEdge, fg: palette.white },
    ghost: { bg: 'transparent', edge: 'transparent', fg: colors.info },
    outline: { bg: colors.surface, edge: colors.border, fg: colors.textMuted, outlined: true },
  };
  const t = color ? { bg: color, edge: shade(color), fg: palette.white, outlined: false } : tones[tone];
  const inactive = disabled || loading;
  const dim = inactive && tone !== 'ghost';
  const bg = dim ? colors.border : t.bg;
  const edge = dim ? colors.border : t.edge;
  const fg = dim ? colors.textMuted : t.fg;
  const restEdge = tone === 'ghost' ? 0 : EDGE;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={inactive}
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      style={style}>
      {({ pressed }) => (
        <View
          style={[
            styles.base,
            small && styles.small,
            {
              backgroundColor: bg,
              borderWidth: t.outlined ? 2 : 0,
              borderColor: t.outlined ? colors.border : bg,
              borderBottomColor: edge,
              borderBottomWidth: pressed ? (t.outlined ? 2 : 0) : restEdge,
              marginTop: pressed ? restEdge - (t.outlined ? 2 : 0) : 0,
            },
          ]}>
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <>
              {icon && <MaterialCommunityIcons name={icon} size={small ? 18 : 22} color={fg} />}
              <AppText variant="label" upper color={fg}>
                {title}
              </AppText>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  small: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.sm + 2 },
});
