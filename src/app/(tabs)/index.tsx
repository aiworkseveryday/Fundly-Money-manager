import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { EmptyState, IconBubble, SectionTitle } from '@/components/bits';
import { Mascot, type Mood } from '@/components/Mascot';
import { budgetColor, ProgressRing } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { TransactionItem } from '@/components/TransactionItem';
import { useAccounts, useBills, useBudgets, useCategories, useInvalidate, usePendingSms, useProfile, useTransactions } from '@/data/hooks';
import { levelFor, liveStreak } from '@/gamification/engine';
import { addDays, daysBetween, formatDay, fromISODate, startOfMonth } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { initials, shortName } from '@/lib/names';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, space, tint } from '@/theme/tokens';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const now = new Date();
  const monthStart = startOfMonth(now);

  const profile = useProfile();
  const accounts = useAccounts();
  const categories = useCategories();
  const monthTx = useTransactions({ from: monthStart });
  const budgets = useBudgets(now);
  const bills = useBills();
  const pending = usePendingSms();

  const tx = monthTx.data ?? [];
  const income = tx.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = tx.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBalance = (accounts.data ?? []).reduce((s, a) => s + a.balance, 0);
  const todaySpend = tx
    .filter((t) => t.kind === 'expense' && daysBetween(new Date(t.occurred_at), now) === 0)
    .reduce((s, t) => s + t.amount, 0);

  const spentByCat = new Map<string, number>();
  for (const t of tx) if (t.kind === 'expense' && t.category_id) spentByCat.set(t.category_id, (spentByCat.get(t.category_id) ?? 0) + t.amount);
  const catById = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const budgetRows = (budgets.data ?? [])
    .map((b) => ({ ...b, spent: spentByCat.get(b.category_id) ?? 0, cat: catById.get(b.category_id) }))
    .sort((a, b) => b.spent / b.amount - a.spent / a.amount);
  const overBudget = budgetRows.filter((b) => b.spent > b.amount);

  const upcoming = (bills.data ?? []).filter((b) => b.active && fromISODate(b.next_due_date) <= addDays(now, 7));
  const streak = profile.data ? liveStreak(profile.data) : 0;
  const level = levelFor(profile.data?.xp ?? 0);
  const loggedToday = profile.data?.last_logged_on && daysBetween(fromISODate(profile.data.last_logged_on), now) === 0;

  let mood: Mood = 'happy';
  let tip = loggedToday ? 'Nice! You have logged money today. 🎉' : 'Log one expense today to keep your streak alive!';
  if (overBudget.length) {
    mood = 'worried';
    tip = `Uh oh, ${overBudget[0].cat?.name ?? 'a category'} is over budget by ${formatINR(overBudget[0].spent - overBudget[0].amount)}.`;
  } else if (income > 0 && expense < income * 0.5) {
    tip = `You've spent only ${Math.round((expense / income) * 100)}% of this month's income. Saver mode! 💪`;
  }

  const refreshing = monthTx.isRefetching || accounts.isRefetching;
  const accountNames = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={invalidate}>
        {/* top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityLabel="Open profile"
            style={[styles.avatar, { backgroundColor: colors.primary, borderBottomColor: colors.primaryEdge }]}>
            <AppText variant="label" color="#fff">
              {initials(profile.data?.display_name)}
            </AppText>
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" muted>
              {greeting()}
            </AppText>
            <AppText variant="heading" numberOfLines={1}>
              {shortName(profile.data?.display_name)}
            </AppText>
          </View>
          <Pressable onPress={() => router.push('/achievements')} style={styles.stats}>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="fire" size={26} color={streak ? colors.streak : colors.tabInactive} />
              <AppText variant="label" color={streak ? colors.streak : colors.tabInactive}>
                {streak}
              </AppText>
            </View>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="lightning-bolt" size={24} color={colors.xp} />
              <AppText variant="label" color={palette.yellowEdge}>
                Lv {level.level}
              </AppText>
            </View>
          </Pressable>
        </View>

        {/* balance hero */}
        <Card fill={colors.primary} edge={colors.primaryEdge} onPress={() => router.push('/accounts')}>
          <AppText variant="caption" upper color="rgba(255,255,255,0.85)">
            Total balance
          </AppText>
          <AppText variant="hero" color="#fff">
            {formatINR(totalBalance)}
          </AppText>
          <View style={styles.heroRow}>
            <View style={[styles.heroStat, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <MaterialCommunityIcons name="arrow-down-bold-circle" size={20} color="#fff" />
              <View>
                <AppText variant="caption" color="rgba(255,255,255,0.85)">
                  Income
                </AppText>
                <AppText variant="label" color="#fff">
                  {formatINR(income, { compact: true })}
                </AppText>
              </View>
            </View>
            <View style={[styles.heroStat, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <MaterialCommunityIcons name="arrow-up-bold-circle" size={20} color="#fff" />
              <View>
                <AppText variant="caption" color="rgba(255,255,255,0.85)">
                  Spent
                </AppText>
                <AppText variant="label" color="#fff">
                  {formatINR(expense, { compact: true })}
                </AppText>
              </View>
            </View>
            <View style={[styles.heroStat, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <MaterialCommunityIcons name="calendar-today" size={20} color="#fff" />
              <View>
                <AppText variant="caption" color="rgba(255,255,255,0.85)">
                  Today
                </AppText>
                <AppText variant="label" color="#fff">
                  {formatINR(todaySpend, { compact: true })}
                </AppText>
              </View>
            </View>
          </View>
        </Card>

        {/* mascot tip */}
        <View style={styles.tipRow}>
          <Mascot size={70} mood={mood} />
          <View style={[styles.bubble, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <AppText variant="label">{tip}</AppText>
          </View>
        </View>

        {!!pending.data?.length && (
          <Card onPress={() => router.push('/sms-inbox')} style={styles.smsCard}>
            <IconBubble icon="message-text" color={colors.info} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">
                {pending.data.length} bank SMS to review
              </AppText>
              <AppText variant="caption" muted>
                Tap to add them in seconds (+5 XP each)
              </AppText>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={26} color={colors.textMuted} />
          </Card>
        )}

        {/* budgets */}
        <SectionTitle title="Budgets this month" action={{ label: budgetRows.length ? 'Manage' : 'Set up', onPress: () => router.push('/budgets') }} />
        {budgetRows.length ? (
          <View style={styles.rings}>
            {budgetRows.slice(0, 4).map((b) => {
              const ratio = b.spent / b.amount;
              return (
                <Pressable key={b.id} style={styles.ringItem} onPress={() => router.push('/budgets')}>
                  <ProgressRing progress={ratio} color={budgetColor(ratio)}>
                    <MaterialCommunityIcons name={(b.cat?.icon ?? 'tag') as never} size={24} color={b.cat?.color ?? colors.textMuted} />
                  </ProgressRing>
                  <AppText variant="caption" numberOfLines={1} center>
                    {b.cat?.name}
                  </AppText>
                  <AppText variant="caption" muted center>
                    {Math.round(ratio * 100)}%
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Card onPress={() => router.push('/budgets')}>
            <AppText muted>Set monthly limits per category. Fundy will cheer you on (or warn you)!</AppText>
          </Card>
        )}

        {/* bills */}
        {!!upcoming.length && (
          <>
            <SectionTitle title="Upcoming bills" action={{ label: 'All bills', onPress: () => router.push('/bills') }} />
            <Card style={{ gap: space.sm }}>
              {upcoming.map((b) => {
                const due = fromISODate(b.next_due_date);
                const overdue = daysBetween(now, due) < 0;
                return (
                  <Pressable key={b.id} onPress={() => router.push('/bills')} style={styles.billRow}>
                    <IconBubble icon="receipt" color={overdue ? colors.danger : colors.warning} size={38} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="label">{b.name}</AppText>
                      <AppText variant="caption" color={overdue ? colors.danger : colors.textMuted}>
                        {overdue ? `Overdue since ${formatDay(due)}` : `Due ${formatDay(due)}`}
                      </AppText>
                    </View>
                    <AppText variant="label">{formatINR(b.amount)}</AppText>
                  </Pressable>
                );
              })}
            </Card>
          </>
        )}

        {/* recent */}
        <SectionTitle title="Recent activity" action={tx.length ? { label: 'See all', onPress: () => router.push('/activity') } : undefined} />
        {tx.length ? (
          <Card style={{ paddingVertical: space.sm }}>
            {tx.slice(0, 6).map((t) => (
              <TransactionItem key={t.id} tx={t} accountNames={accountNames} />
            ))}
          </Card>
        ) : (
          !monthTx.isLoading && <EmptyState title="No transactions this month" subtitle="Tap the big + button to log your first one." mood="happy" />
        )}
      </Screen>

      <Pressable
        accessibilityLabel="Add transaction"
        onPress={() => router.push('/transaction')}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, borderBottomColor: colors.primaryEdge, borderBottomWidth: pressed ? 0 : 5, bottom: pressed ? 19 : 24 },
        ]}>
        <MaterialCommunityIcons name="plus" size={34} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 44, height: 44, borderRadius: 22, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: space.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heroRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: radius.sm },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bubble: { flex: 1, borderWidth: 2, borderRadius: radius.md, padding: space.md },
  smsCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderColor: tint(palette.blue, 0.5) },
  rings: { flexDirection: 'row', gap: space.md },
  ringItem: { flex: 1, alignItems: 'center', gap: 4, maxWidth: '25%' },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fab: {
    position: 'absolute',
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
