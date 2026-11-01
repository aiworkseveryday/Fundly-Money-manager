import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption';

const variants: Record<Variant, { fontSize: number; fontFamily: string; lineHeight?: number }> = {
  hero: { fontSize: 36, fontFamily: fonts.black, lineHeight: 44 },
  title: { fontSize: 26, fontFamily: fonts.black, lineHeight: 32 },
  heading: { fontSize: 18, fontFamily: fonts.heavy, lineHeight: 24 },
  body: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22 },
  label: { fontSize: 15, fontFamily: fonts.heavy, lineHeight: 20 },
  caption: { fontSize: 13, fontFamily: fonts.bold, lineHeight: 18 },
};

export type AppTextProps = TextProps & {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  center?: boolean;
  upper?: boolean;
};

export function AppText({ variant = 'body', color, muted, center, upper, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        variants[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        center && { textAlign: 'center' },
        upper && { textTransform: 'uppercase', letterSpacing: 0.8 },
        style,
      ]}
    />
  );
}
