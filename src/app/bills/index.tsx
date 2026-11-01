import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { EmptyState, Header, IconBubble } from '@/components/bits';
import { Screen } from '@/components/Screen';
import { BILL_FREQUENCIES } from '@/data/constants';
import { insertTransaction, nextDueDate, useAccounts, useBills, useInvalidate, useSaveBill } from '@/data/hooks';
import type { Bill } from '@/data/types';
import { useReward } from '@/gamification/Celebrations';
import { daysBetween, formatDay, fromISODate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Bills() {
  const { colors } = useTheme();
  const reward = useReward();
  const invalidate = useInvalidate();
  const bills = useBills();
  const accounts = useAccounts();
  const saveBill = useSaveBill();
  const list = bills.data ?? [];
  const active = list.filter((b) => b.active);
  const monthlyTotal = active.reduce((s, b) => {
    const perMonth = b.frequency === 'weekly' ? b.amount * 4.33 : b.frequency === 'yearly' ? b.amount / 12 : b.frequency === 'monthly' ? b.amount : 0;
    return s + perMonth;
  }, 0);

  const markPaid = (bill: Bill) => {
    const accountId = bill.account_id ?? accounts.data?.[0]?.id;
    if (!accountId) return;
    const accountName = accounts.data?.find((a) => a.id === accountId)?.name;
    Alert.alert(`Mark ${bill.name} paid?`, `Logs ${formatINR(bill.amount)} from ${accountName} and moves the due date forward.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Paid',
        onPress: async () => {
          try {
            await insertTransaction({
              kind: 'expense',
              amount: bill.amount,
              account_id: accountId,
              to_account_id: null,
              category_id: bill.category_id,
              note: bill.name,
              occurred_at: new Date().toISOString(),
              source: 'bill',
            });
            const next = nextDueDate(bill);
            await saveBill.mutateAsync({ ...bill, next_due_date: next ?? bill.next_due_date, active: next != null });
            invalidate();
            reward('bill_paid');
          } catch (e) {
            Alert.alert('Could not mark paid', (e as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Bills & reminders" right={<Button3D title="Add" icon="plus" small onPress={() => router.push('/bills/edit')} />} />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }}>
        {!!active.length && (
          <Card>
            <AppText variant="caption" muted upper>
              Recurring bills per month
            </AppText>
            <AppText variant="title">{formatINR(Math.round(monthlyTotal))}</AppText>
          </Card>
        )}
        {list.map((b) => {
          const due = fromISODate(b.next_due_date);
          const days = daysBetween(new Date(), due);
          const status = !b.active ? 'Paused' : days < 0 ? `Overdue by ${-days} day${days === -1 ? '' : 's'}` : days === 0 ? 'Due today' : `Due ${formatDay(due)}`;
          const statusColor = !b.active ? colors.textMuted : days < 0 ? colors.danger : days <= 3 ? colors.warning : colors.textMuted;
          return (
            <Card key={b.id} onPress={() => router.push({ pathname: '/bills/edit', params: { id: b.id } })} style={{ gap: space.md }}>
              <View style={styles.row}>
                <IconBubble icon="receipt" color={b.active ? colors.warning : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{b.name}</AppText>
                  <AppText variant="caption" color={statusColor}>
                    {status} · {BILL_FREQUENCIES.find((f) => f.value === b.frequency)?.label}
                  </AppText>
                </View>
                <AppText variant="heading">{formatINR(b.amount)}</AppText>
              </View>
              {b.active && days <= 7 && <Button3D title="Mark as paid" small icon="check" onPress={() => markPaid(b)} />}
            </Card>
          );
        })}
        {!list.length && !bills.isLoading && (
          <EmptyState
            title="Never miss a due date"
            subtitle="Add rent, EMIs, phone recharges or subscriptions. Fundy will remind you before they are due."
            mood="happy"
            action={<Button3D title="Add a bill" onPress={() => router.push('/bills/edit')} />}
          />
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
