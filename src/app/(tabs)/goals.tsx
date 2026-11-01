import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/bits';
import { ProgressBar } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { useGoals, useInvalidate } from '@/data/hooks';
import { daysBetween, formatDay, fromISODate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, space } from '@/theme/tokens';

export default function Goals() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const goals = useGoals();
  const list = goals.data ?? [];
  const active = list.filter((g) => !g.completed_at);
  const done = list.filter((g) => g.completed_at);
  const totalSaved = list.reduce((s, g) => s + g.saved, 0);

  return (
    <Screen refreshing={goals.isRefetching} onRefresh={invalidate}>
      <View style={styles.titleRow}>
        <AppText variant="title" style={{ flex: 1 }}>
          Goals
        </AppText>
        <Button3D title="New" icon="plus" small onPress={() => router.push('/goals/edit')} />
      </View>

      {!!list.length && (
        <Card fill={palette.purple} edge={palette.purpleEdge}>
          <AppText variant="caption" upper color="rgba(255,255,255,0.85)">
            Saved across goals
          </AppText>
          <AppText variant="hero" color="#fff">
            {formatINR(totalSaved)}
          </AppText>
        </Card>
      )}

      {active.map((g) => {
        const ratio = g.saved / g.target_amount;
        const daysLeft = g.deadline ? daysBetween(new Date(), fromISODate(g.deadline)) : null;
        const remaining = Math.max(0, g.target_amount - g.saved);
        const perMonth = daysLeft && daysLeft > 0 ? remaining / Math.max(1, daysLeft / 30) : null;
        return (
          <Card key={g.id} onPress={() => router.push({ pathname: '/goals/[id]', params: { id: g.id } })} style={{ gap: space.sm }}>
            <View style={styles.goalTop}>
              <AppText style={styles.emoji}>{g.emoji}</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="heading" numberOfLines={1}>
                  {g.name}
                </AppText>
                <AppText variant="caption" muted>
                  {formatINR(g.saved)} of {formatINR(g.target_amount)}
                </AppText>
              </View>
              <AppText variant="heading" color={colors.primary}>
                {Math.min(100, Math.round(ratio * 100))}%
              </AppText>
            </View>
            <ProgressBar progress={ratio} color={colors.primary} />
            {g.deadline && (
              <AppText variant="caption" color={daysLeft != null && daysLeft < 0 ? colors.danger : colors.textMuted}>
                {daysLeft != null && daysLeft < 0
                  ? `Deadline passed (${formatDay(fromISODate(g.deadline))})`
                  : `${daysLeft} days left${perMonth ? ` · save ${formatINR(Math.ceil(perMonth))}/month to make it` : ''}`}
              </AppText>
            )}
          </Card>
        );
      })}

      {!!done.length && (
        <>
          <AppText variant="heading">Completed 🎉</AppText>
          {done.map((g) => (
            <Card key={g.id} onPress={() => router.push({ pathname: '/goals/[id]', params: { id: g.id } })} style={styles.goalTop}>
              <AppText style={styles.emoji}>{g.emoji}</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="label">{g.name}</AppText>
                <AppText variant="caption" muted>
                  {formatINR(g.target_amount)} reached
                </AppText>
              </View>
            </Card>
          ))}
        </>
      )}

      {!list.length && !goals.isLoading && (
        <EmptyState
          title="Dream big, save smart"
          subtitle="Create a goal like a new phone, a trip to Goa or an emergency fund."
          mood="happy"
          action={<Button3D title="Create a goal" onPress={() => router.push('/goals/edit')} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  emoji: { fontSize: 34, lineHeight: 42 },
});
