import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { DebtChart } from '@/components/DebtChart';
import { Header } from '@/components/bits';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useAccounts, useDeleteLoanPayment, useLoanPayments, useLoans, useRecordLoanPayment } from '@/data/hooks';
import { formatDay, formatMonth, fromISODate } from '@/lib/dates';
import { formatINR, parseAmount } from '@/lib/money';
import { loanState, simulatePrepay, totalOwedSeries } from '@/loans/loans';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function LoanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const loans = useLoans();
  const payments = useLoanPayments();
  const accounts = useAccounts();
  const record = useRecordLoanPayment();
  const remove = useDeleteLoanPayment();
  const [prepay, setPrepay] = useState('');
  const [fromId, setFromId] = useState<string | null>(null);

  const loan = loans.data?.find((l) => l.id === id);
  if (!loan) return <Header title="Loan" />;

  const st = loanState(loan, payments.data ?? []);
  const history = (payments.data ?? []).filter((p) => p.loan_id === loan.id).reverse();
  const prepayValue = parseAmount(prepay);
  const sim = prepayValue ? simulatePrepay(st.balance, loan.emi, loan.annual_rate, prepayValue) : null;
  const payFrom = fromId ?? loan.account_id;
  const prepaysLeft = loan.prepay_per_year - st.prepaysThisYear;

  const markEmi = () =>
    Alert.alert(
      `Mark ${formatMonth(st.nextDue)} EMI paid?`,
      `${formatINR(loan.emi)} will be logged as a spend${loan.account_id ? ` from ${accounts.data?.find((a) => a.id === loan.account_id)?.name ?? 'the paying account'}` : ''}. If the bank SMS comes later, adding it from the SMS inbox simply replaces this entry.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: () => record.mutate({ loan, kind: 'emi', amount: loan.emi, paidOn: new Date(), accountId: loan.account_id }),
        },
      ],
    );

  const savePrepay = async () => {
    if (!prepayValue) return;
    try {
      await record.mutateAsync({ loan, kind: 'prepay', amount: prepayValue, paidOn: new Date(), accountId: payFrom });
      setPrepay('');
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title={loan.name}
        right={
          <Pressable onPress={() => router.push({ pathname: '/loans/edit', params: { id: loan.id } })} hitSlop={10} accessibilityLabel="Edit loan">
            <MaterialCommunityIcons name="pencil" size={24} color={colors.textMuted} />
          </Pressable>
        }
      />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }}>
        <Card style={{ gap: space.md, borderLeftWidth: 6, borderLeftColor: loan.color }}>
          <View style={styles.grid}>
            <Stat label="Still owed" value={formatINR(Math.round(st.balance))} />
            <Stat label="Interest left" value={formatINR(Math.round(st.interestLeft))} />
            <Stat label="EMIs left" value={st.finishes ? String(st.monthsLeft) : '∞'} />
            <Stat label="Debt-free" value={formatMonth(st.debtFree)} />
          </View>
          {(st.principalPaid > 0 || st.interestPaid > 0) && (
            <AppText variant="caption" muted>
              Since tracking: {formatINR(Math.round(st.principalPaid))} principal and {formatINR(Math.round(st.interestPaid))} interest paid.
            </AppText>
          )}
          <DebtChart values={totalOwedSeries([{ balance: st.balance, emi: loan.emi, annual_rate: loan.annual_rate }])} firstEmi={st.nextDue} />
        </Card>

        {/* this month's EMI */}
        <Card style={styles.row}>
          <MaterialCommunityIcons
            name={st.paidThisMonth ? 'check-circle' : 'calendar-clock'}
            size={28}
            color={st.paidThisMonth ? colors.income : colors.warning}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="label">
              {st.paidThisMonth ? 'This month’s EMI is paid' : `EMI ${formatINR(loan.emi)} due ${formatDay(st.nextDue)}`}
            </AppText>
            <AppText variant="caption" muted>
              {st.paidThisMonth ? `Next one ${formatDay(st.nextDue)}` : 'Ticks itself when the bank SMS is added from the SMS inbox'}
            </AppText>
          </View>
          {!st.paidThisMonth && <Button3D title="Paid" small onPress={markEmi} loading={record.isPending} />}
        </Card>

        {/* prepayment */}
        <Card style={{ gap: space.sm }}>
          <AppText variant="heading">Record a prepayment</AppText>
          <AppText variant="caption" muted>
            {prepaysLeft > 0
              ? `${prepaysLeft} of ${loan.prepay_per_year} prepayments left this year.`
              : `You've used all ${loan.prepay_per_year} prepayments allowed this year.`}
          </AppText>
          <Input label="Amount" prefix="₹" placeholder="53000" keyboardType="decimal-pad" value={prepay} onChangeText={setPrepay} />
          {sim && (
            <AppText color={colors.income}>
              This saves {formatINR(Math.round(sim.interestSaved))} interest and {sim.monthsSaved} EMI{sim.monthsSaved === 1 ? '' : 's'}.
            </AppText>
          )}
          <AppText variant="caption" muted upper>
            Paid from
          </AppText>
          <ChipRow>
            {(accounts.data ?? []).map((a) => (
              <Chip key={a.id} label={a.name} color={a.color} selected={payFrom === a.id} onPress={() => setFromId(a.id)} />
            ))}
          </ChipRow>
          <Button3D title="Save prepayment" icon="cash-fast" onPress={savePrepay} disabled={!prepayValue} loading={record.isPending} />
        </Card>

        {/* history */}
        {!!history.length && (
          <Card style={{ gap: space.xs }}>
            <AppText variant="heading">Payments</AppText>
            {history.map((p) => (
              <Pressable
                key={p.id}
                style={styles.histRow}
                onLongPress={() =>
                  Alert.alert(
                    'Delete this payment?',
                    'The loan balance goes back up. A spend logged with it is removed too, unless it came from a bank SMS.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(p) },
                    ],
                  )
                }>
                <MaterialCommunityIcons
                  name={p.kind === 'emi' ? 'calendar-check' : 'rocket-launch'}
                  size={22}
                  color={p.kind === 'emi' ? colors.info : colors.income}
                />
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{p.kind === 'emi' ? 'EMI' : 'Prepayment'}</AppText>
                  <AppText variant="caption" muted>
                    {formatDay(fromISODate(p.paid_on))}
                  </AppText>
                </View>
                <AppText variant="label">{formatINR(p.amount)}</AppText>
              </Pressable>
            ))}
            <AppText variant="caption" muted>
              Long-press a payment to delete it.
            </AppText>
          </Card>
        )}
      </Screen>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: '50%', paddingVertical: 4 }}>
      <AppText variant="caption" muted upper>
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
});
