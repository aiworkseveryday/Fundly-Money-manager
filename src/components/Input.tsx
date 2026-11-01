import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useState } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius } from '@/theme/tokens';
import { AppText } from './AppText';

type Props = TextInputProps & { label?: string; prefix?: string };

export function Input({ label, prefix, style, onFocus, onBlur, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <AppText variant="caption" muted upper>
          {label}
        </AppText>
      )}
      <View
        style={[
          styles.box,
          { backgroundColor: colors.surfaceAlt, borderColor: focused ? colors.info : colors.border },
        ]}>
        {prefix && (
          <AppText variant="heading" muted>
            {prefix}
          </AppText>
        )}
        <TextInput
          placeholderTextColor={colors.textMuted}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: colors.text }, style]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: { flex: 1, fontFamily: fonts.bold, fontSize: 17, paddingVertical: 13 },
});
