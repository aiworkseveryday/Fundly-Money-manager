import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, tint } from '@/theme/tokens';
import { AppText } from './AppText';
import type { IconName } from './Button3D';
import { Mascot, type Mood } from './Mascot';

/** Round colored icon used for categories, accounts and menu rows */
export function IconBubble({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.6,
        backgroundColor: tint(color, 0.18),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <MaterialCommunityIcons name={icon as IconName} size={size * 0.55} color={color} />
    </View>
  );
}

export function EmptyState({ title, subtitle, mood = 'sleepy', action }: { title: string; subtitle?: string; mood?: Mood; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Mascot mood={mood} size={110} />
      <AppText variant="heading" center>
        {title}
      </AppText>
      {subtitle && (
        <AppText muted center>
          {subtitle}
        </AppText>
      )}
      {action}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <AppText variant="heading">{title}</AppText>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={10}>
          <AppText variant="label" upper color={colors.info}>
            {action.label}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

/** Title bar for pushed / modal screens */
export function Header({ title, right, close }: { title: string; right?: ReactNode; close?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
        <MaterialCommunityIcons name={close ? 'close' : 'arrow-left'} size={28} color={colors.textMuted} />
      </Pressable>
      <AppText variant="heading" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

type RowProps = {
  icon: string;
  color: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
};

export function ListRow({ icon, color, title, subtitle, right, onPress }: RowProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <IconBubble icon={icon} color={color} />
      <View style={{ flex: 1 }}>
        <AppText variant="label" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      {right ?? (onPress && <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />)}
    </Pressable>
  );
}

/** Segmented control: [Expense | Income | Transfer] */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} style={{ flex: 1 }} onPress={() => onChange(o.value)}>
            <View
              style={[
                styles.segmentItem,
                active && { backgroundColor: colors.surface, borderColor: o.color ?? colors.info, borderWidth: 2 },
              ]}>
              <AppText variant="caption" upper color={active ? (o.color ?? colors.info) : colors.textMuted}>
                {o.label}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  segment: { flexDirection: 'row', borderWidth: 2, borderRadius: radius.md, padding: 4, gap: 4 },
  segmentItem: { paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
});
