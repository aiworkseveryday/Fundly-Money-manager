import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { EmptyState, IconBubble, SectionTitle } from '@/components/bits';
import { Mascot, type Mood } from '@/components/Mascot';
import { ProgressBar } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { TransactionItem } from '@/components/TransactionItem';
import {
  defaultAccount,
  ensureCategory,
  insertTransaction,
  useAccounts,
  useBills,
  useCategories,
  useLoanPayments,
  useLoans,
  useInvalidate,
  usePendingCount,
  usePlanChecks,
  usePlanItems,
  useProfile,
  useQuickTemplates,
  useTransactions,
} from '@/data/hooks';
import type { QuickTemplate } from '@/data/types';
import { useReward } from '@/gamification/Celebrations';
import { levelFor, liveStreak } from '@/gamification/engine';
import { addDays, daysBetween, formatDay, formatMonth, fromISODate, startOfMonth } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { initials } from '@/lib/names';
import { loanState } from '@/loans/loans';
import { activeItems, isPaid, planActuals } from '@/plan/plan';
import { guessCategory } from '@/sms/categorize';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, space, tint } from '@/theme/tokens';

/** How long the balance stays visible after unlocking it */
const REVEAL_MS = 15_000;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Balance stays hidden on Home; the eye asks for fingerprint / screen lock and shows it briefly. */
function useBalanceReveal() {
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const toggle = async () => {
    if (shown) {
      setShown(false);
      return;
    }
    const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
    if (hw && enrolled) {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Show balance',
      });
      if (!res.success) return;
    }
    setShown(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), REVEAL_MS);
  };
  return { shown, toggle };
}

export default function Home() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const reward = useReward();
  const now = new Date();
  const monthStart = startOfMonth(now);

  const profile = useProfile();
  const accounts = useAccounts();
  const categories = useCategories();
  const monthTx = useTransactions({ from: monthStart });
  const bills = useBills();
  const pendingCount = usePendingCount();
  const plan = usePlanItems();
  const checks = usePlanChecks(monthStart);
  const templates = useQuickTemplates();
  const loans = useLoans();
  const loanPayments = useLoanPayments();
  const balance = useBalanceReveal();

  const tx = monthTx.data ?? [];
  const income = tx.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = tx.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  // Savings kept aside never show here; only accounts counted in the total
  const totalBalance = (accounts.data ?? []).filter((a) => a.include_in_total).reduce((s, a) => s + a.balance, 0);
  const todaySpend = tx.filter((t) => t.kind === 'expense' && daysBetween(new Date(t.occurred_at), now) === 0).reduce((s, t) => s + t.amount, 0);

  // plan: spending items only (savings/prepay are transfers, not spends)
  const planItems = activeItems(plan.data ?? [], now);
  const plannedSpend = planItems.filter((i) => i.grp !== 'saving').reduce((s, i) => s + i.amount, 0);
  const { byItem } = planActuals(planItems, tx);
  const checklist = planItems.filter((i) => i.is_checklist);
  const paid = checklist.filter((i) => isPaid(i.amount, byItem.get(i.id) ?? 0, !!checks.data?.has(i.id))).length;

  // loans card shows dates only, no amounts, so Home stays private
  const loanStates = (loans.data ?? []).map((l) => loanState(l, loanPayments.data ?? [], now));
  const debtFree = loanStates.reduce<Date | null>((d, st) => (!d || st.debtFree > d ? st.debtFree : d), null);
  const emisDue = loanStates.filter((st) => !st.paidThisMonth).length;

  const upcoming = (bills.data ?? []).filter((b) => b.active && fromISODate(b.next_due_date) <= addDays(now, 7));
  const streak = profile.data ? liveStreak(profile.data) : 0;
  const level = levelFor(profile.data?.xp ?? 0);
  const loggedToday = profile.data?.last_logged_on && daysBetween(fromISODate(profile.data.last_logged_on), now) === 0;

  let mood: Mood = 'happy';
  let tip = loggedToday ? 'Nice! You have logged money today. 🎉' : 'Log one expense today to keep your streak alive!';
  if (plannedSpend && expense > plannedSpend) {
    mood = 'worried';
    tip = `You're ${formatINR(expense - plannedSpend)} over this month's plan. Check the plan for the leak.`;
  } else if (income > 0 && expense < income * 0.5) {
    tip = `You've spent only ${Math.max(1, Math.round((expense / income) * 100))}% of this month's income. Saver mode! 💪`;
  }

  const refreshing = monthTx.isRefetching || accounts.isRefetching;
  const accountNames = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));

  const [logging, setLogging] = useState<string | null>(null);
  const quickLog = async (q: QuickTemplate) => {
    const accountId = q.account_id ?? defaultAccount(accounts.data)?.id;
    if (!accountId || logging) return;
    setLogging(q.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const categoryId =
        q.category_id ??
        guessCategory(q.label, 'expense', categories.data ?? []) ??
        (await ensureCategory('Other', 'expense', 'dots-horizontal', '#AFAFAF'));
      await insertTransaction({
        kind: 'expense',
        amount: q.amount,
        account_id: accountId,
        to_account_id: null,
        category_id: categoryId,
        note: q.label,
        occurred_at: new Date().toISOString(),
      });
      invalidate();
      reward('log');
    } catch (e) {
      Alert.alert('Could not log', (e as Error).message);
    } finally {
      setLogging(null);
    }
  };

  const heroText = 'rgba(255,255,255,0.85)';
  const spentRatio = plannedSpend ? expense / plannedSpend : 0;

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={invalidate}>
        {/* top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityLabel="Open profile"
            style={[
              styles.avatar,
              {
                backgroundColor: colors.primary,
                borderBottomColor: colors.primaryEdge,
              },
            ]}>
            <AppText variant="label" color="#fff">
              {initials(profile.data?.display_name)}
            </AppText>
          </Pressable>
          <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
            {greeting()} 👋
          </AppText>
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

        {/* spending hero: shows this month's spends, never balances */}
        <Card fill={colors.primary} edge={colors.primaryEdge} onPress={() => router.push('/plan')}>
          <AppText variant="caption" upper color={heroText}>
            Spent this month
          </AppText>
          <AppText variant="hero" color="#fff">
            {formatINR(expense)}
          </AppText>
          {plannedSpend > 0 && (
            <View style={{ gap: 4, marginTop: 2 }}>
              <ProgressBar progress={Math.min(spentRatio, 1)} color={spentRatio > 1 ? palette.red : '#fff'} height={10} />
              <AppText variant="caption" color={heroText}>
                {spentRatio > 1 ? `${formatINR(expense - plannedSpend)} over` : `${formatINR(plannedSpend - expense)} left`} of{' '}
                {formatINR(plannedSpend)} planned
              </AppText>
            </View>
          )}
          <View style={styles.heroRow}>
            <View style={[styles.heroStat, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <MaterialCommunityIcons name="calendar-today" size={20} color="#fff" />
              <View>
                <AppText variant="caption" color={heroText}>
                  Today
                </AppText>
                <AppText variant="label" color="#fff">
                  {formatINR(todaySpend, { compact: true })}
                </AppText>
              </View>
            </View>
            <Pressable
              onPress={balance.toggle}
              accessibilityLabel={balance.shown ? 'Hide balance' : 'Show balance'}
              style={[styles.heroStat, { backgroundColor: 'rgba(255,255,255,0.18)', flex: 1.4 }]}>
              <MaterialCommunityIcons name={balance.shown ? 'eye-off' : 'eye'} size={20} color="#fff" />
              <View style={{ flex: 1 }}>
                <AppText variant="caption" color={heroText}>
                  Balance
                </AppText>
                <AppText variant="label" color="#fff" numberOfLines={1}>
                  {balance.shown ? formatINR(totalBalance) : '₹ ••••••'}
                </AppText>
              </View>
            </Pressable>
          </View>
        </Card>

        {/* quick add */}
        <View style={styles.quickRow}>
          {(templates.data ?? []).map((q) => (
            <Pressable
              key={q.id}
              onPress={() => quickLog(q)}
              onLongPress={() => router.push({ pathname: '/quick-edit', params: { id: q.id } })}
              style={({ pressed }) => [
                styles.quick,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: logging === q.id ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}>
              <AppText style={{ fontSize: 18 }}>{q.emoji}</AppText>
              <AppText variant="label">
                {q.label} {formatINR(q.amount)}
              </AppText>
            </Pressable>
          ))}
          <Pressable
            onPress={() => router.push('/quick-edit')}
            accessibilityLabel="New quick button"
            style={[styles.quick, { borderColor: colors.border, borderStyle: 'dashed' }]}>
            <MaterialCommunityIcons name="plus" size={18} color={colors.textMuted} />
            {!templates.data?.length && (
              <AppText variant="label" muted>
                Quick button
              </AppText>
            )}
          </Pressable>
        </View>

        {/* plan + loans */}
        <View style={styles.pair}>
          {/* a pressable Card ignores flex, so the wrapper splits the row */}
          <View style={{ flex: 1 }}>
            <Card style={styles.mini} onPress={() => router.push('/plan')}>
              <MaterialCommunityIcons name="clipboard-check" size={26} color={palette.blue} />
              <AppText variant="label">Monthly plan</AppText>
              <AppText variant="caption" muted>
                {checklist.length ? `Must-pay ${paid}/${checklist.length} done` : 'Load your plan'}
              </AppText>
            </Card>
          </View>
          <View style={{ flex: 1 }}>
            <Card style={styles.mini} onPress={() => router.push('/loans')}>
              <MaterialCommunityIcons name="bank" size={26} color={palette.red} />
              <AppText variant="label">Loans</AppText>
              <AppText variant="caption" muted>
                {debtFree
                  ? `${emisDue ? `${emisDue} EMI${emisDue > 1 ? 's' : ''} due` : 'EMIs paid ✓'} · free ${formatMonth(debtFree)}`
                  : 'Track your loans'}
              </AppText>
            </Card>
          </View>
        </View>

        {/* mascot tip */}
        <View style={styles.tipRow}>
          <Mascot size={70} mood={mood} />
          <View style={[styles.bubble, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <AppText variant="label">{tip}</AppText>
          </View>
        </View>

        {!!pendingCount && (
          <Card onPress={() => router.push('/sms-inbox')} style={styles.smsCard}>
            <IconBubble icon="message-text" color={colors.info} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">{pendingCount} bank SMS to review</AppText>
              <AppText variant="caption" muted>
                Tap to add them in seconds (+5 XP each)
              </AppText>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={26} color={colors.textMuted} />
          </Card>
        )}

        {/* bills */}
        {!!upcoming.length && (
          <>
            <SectionTitle
              title="Upcoming bills"
              action={{
                label: 'All bills',
                onPress: () => router.push('/bills'),
              }}
            />
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
          {
            backgroundColor: colors.primary,
            borderBottomColor: colors.primaryEdge,
            borderBottomWidth: pressed ? 0 : 5,
            bottom: pressed ? 19 : 24,
          },
        ]}>
        <MaterialCommunityIcons name="plus" size={34} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: space.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heroRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  heroStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: radius.sm,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  pair: { flexDirection: 'row', gap: space.md },
  mini: { gap: 2, flexGrow: 1 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bubble: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: space.md,
  },
  smsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderColor: tint(palette.blue, 0.5),
  },
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
