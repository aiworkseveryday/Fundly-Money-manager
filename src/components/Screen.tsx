import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pinned below the scroll area, e.g. a Save button */
  footer?: ReactNode;
};

export function Screen({ children, scroll = true, edges = ['top'], refreshing, onRefresh, contentStyle, footer }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.bg }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            ) : undefined
          }>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
      )}
      {footer && <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 120 },
  footer: { padding: space.lg, paddingBottom: space.xl, borderTopWidth: 2 },
});
