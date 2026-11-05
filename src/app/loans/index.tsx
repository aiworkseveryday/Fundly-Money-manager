import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { DebtChart } from '@/components/DebtChart';
import { EmptyState, Header } from '@/components/bits';
import { Input } from '@/components/Input';
import { ProgressBar } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { defaultAccount, useAccounts, useInvalidate, useLoanPayments, useLoans, useSaveLoan } from '@/data/hooks';
import type { Loan } from '@/data/types';
import { daysBetween, formatDay, formatMonth } from '@/lib/dates';
import { formatINR, parseAmount } from '@/lib/money';
import { loanState, outstandingFrom, simulatePrepay, STARTER_LOANS, totalOwedSeries, type LoanState } from '@/loans/loans';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Loans() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const loans = useLoans();
  const payments = useLoanPayments();
  const accounts = useAccounts();
  const save = useSaveLoan();
  const [prepay, setPrepay] = useState('53000');

  const rows = (loans.data ?? []).map((loan) => ({ loan, st: loanState(loan, payments.data ?? []) }));
  const totalOwed = rows.reduce((s, r) => s + r.st.balance, 0);
  const totalEmi = rows.reduce((s, r) => s + r.loan.emi, 0);
  const interestLeft = rows.reduce((s, r) => s + r.st.interestLeft, 0);
  const debtFree = rows.reduce<Date | null>((d, r) => (!d || r.st.debtFree > d ? r.st.debtFree : d), null);
  const paidSoFar = rows.reduce((s, r) => s + r.st.principalPaid, 0);
  const firstEmi = rows.reduce<Date | null>((d, r) => (!d || r.st.nextDue < d ? r.st.nextDue : d), null);
  const series = totalOwedSeries(rows.map((r) => ({ balance: r.st.balance, emi: r.loan.emi, annual_rate: r.loan.annual_rate })));

  const prepayAmount = parseAmount(prepay);
  const sims = prepayAmount ? rows.map((r) => ({ loan: r.loan, ...simulatePrepay(r.st.balance, r.loan.emi, r.loan.annual_rate, prepayAmount) })) : [];
  const best = sims.reduce<(typeof sims)[number] | null>((b, s) => (!b || s.interestSaved > b.interestSaved ? s : b), null);

  const addStarter = async () => {
    const idfc = accounts.data?.find((a) => a.name.trim().toLowerCase() === 'idfc');
    const accountId = idfc?.id ?? defaultAccount(accounts.data)?.id ?? null;
    try {
      for (const l of STARTER_LOANS) {
        await save.mutateAsync({
          name: l.name,
          emi: l.emi,
          annual_rate: l.annual_rate,
          outstanding: outstandingFrom(l.emi, l.annual_rate, l.months_left),
          sms_match: l.sms_match,
          color: l.color,
          account_id: accountId,
        });
      }
    } catch (e) {
      Alert.alert('Could not add loans', (e as Error).message);
    }
  };

  const loading = loans.isLoading || payments.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Loans" right={rows.length ? <Button3D title="Add" icon="plus" small onPress={() => router.push('/loans/edit')} /> : undefined} />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }} refreshing={loans.isRefetching} onRefresh={invalidate}>
        {!rows.length && !loading ? (
          <EmptyState
            title="Track your loans"
            subtitle="See what you still owe, when you'll be debt-free, and what a prepayment saves. Start with your personal and car loan (EMI, rate and months left from your plan), then set each EMI date and lender."
            mood="happy"
            action={
              <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
                <Button3D title="Add my 2 loans" icon="bank" onPress={addStarter} loading={save.isPending} />
                <Button3D title="Add a loan myself" tone="outline" onPress={() => router.push('/loans/edit')} />
              </View>
            }
          />
        ) : (
          <>
            {/* totals */}
            <Card fill={colors.info} edge={colors.infoEdge} style={{ gap: space.sm }}>
              <AppText variant="caption" upper color="rgba(255,255,255,0.85)">
                Total still owed
              </AppText>
              <AppText variant="hero" color="#fff">
                {formatINR(Math.round(totalOwed))}
              </AppText>
              <View style={styles.statRow}>
                <Stat label="EMIs / month" value={formatINR(totalEmi)} />
                <Stat label="Interest left" value={formatINR(interestLeft, { compact: true })} />
                <Stat label="Debt-free" value={debtFree ? formatMonth(debtFree) : '-'} />
              </View>
              {paidSoFar > 0 && (
                <AppText variant="caption" color="rgba(255,255,255,0.85)">
                  {formatINR(Math.round(paidSoFar))} of principal paid off since you started tracking 🎉
                </AppText>
              )}
            </Card>

            {/* chart */}
            {series.length > 1 && (
              <Card style={{ gap: space.sm }}>
                <AppText variant="heading">Total owed over time</AppText>
                <DebtChart values={series} firstEmi={firstEmi ?? undefined} />
              </Card>
            )}

            {/* each loan */}
            {rows.map(({ loan, st }) => (
              <LoanCard key={loan.id} loan={loan} st={st} />
            ))}

            {/* prepayment simulator */}
            {!!rows.length && (
              <Card style={{ gap: space.sm }}>
                <View style={styles.row}>
                  <MaterialCommunityIcons name="calculator-variant" size={24} color={colors.info} />
                  <AppText variant="heading" style={{ flex: 1 }}>
                    What if I prepay?
                  </AppText>
                </View>
                <Input label="Prepayment amount" prefix="₹" keyboardType="decimal-pad" value={prepay} onChangeText={setPrepay} />
                {sims.map((s) => (
                  <View key={s.loan.id} style={[styles.sim, { borderColor: s === best ? colors.income : colors.border }]}>
                    <View style={styles.row}>
                      <AppText variant="label" style={{ flex: 1 }}>
                        {s.loan.name}
                      </AppText>
                      {s === best && sims.length > 1 && (
                        <AppText variant="caption" color={colors.income}>
                          BEST CHOICE
                        </AppText>
                      )}
                    </View>
                    <AppText>
                      Saves <AppText variant="label">{formatINR(Math.round(s.interestSaved))}</AppText> interest and ends{' '}
                      <AppText variant="label">
                        {s.monthsSaved} month{s.monthsSaved === 1 ? '' : 's'}
                      </AppText>{' '}
                      sooner.
                    </AppText>
                  </View>
                ))}
                <AppText variant="caption" muted>
                  Assumes you keep the same EMI and the lender shortens the tenure (ask for that when you prepay). Check for a prepayment charge
                  first.
                </AppText>
              </Card>
            )}
          </>
        )}
      </Screen>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="label" color="#fff" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

function LoanCard({ loan, st }: { loan: Loan; st: LoanState }) {
  const { colors } = useTheme();
  const dueIn = daysBetween(new Date(), st.nextDue);
  // without the full tenure, show progress since tracking started
  const progress = st.progress ?? (loan.outstanding ? st.principalPaid / loan.outstanding : 0);
  return (
    <Card
      style={{ gap: space.sm, borderLeftWidth: 6, borderLeftColor: loan.color }}
      onPress={() => router.push({ pathname: '/loans/[id]', params: { id: loan.id } })}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{loan.name}</AppText>
          <AppText variant="caption" muted>
            {[loan.lender, `${loan.annual_rate}%`, `EMI ${formatINR(loan.emi)}`].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <AppText variant="heading">{formatINR(st.balance, { compact: true })}</AppText>
      </View>
      <ProgressBar progress={progress} color={loan.color} height={10} />
      <View style={styles.row}>
        <AppText variant="caption" muted style={{ flex: 1 }}>
          {st.finishes ? `${st.monthsLeft} EMIs left · debt-free ${formatMonth(st.debtFree)}` : 'EMI is below the interest: check the numbers'}
        </AppText>
        <AppText variant="caption" color={st.paidThisMonth ? colors.income : dueIn < 0 ? colors.danger : colors.textMuted}>
          {st.paidThisMonth ? '✓ Paid this month' : dueIn < 0 ? `Overdue since ${formatDay(st.nextDue)}` : `Due ${formatDay(st.nextDue)}`}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statRow: { flexDirection: 'row', gap: space.sm },
  sim: { borderWidth: 2, borderRadius: 14, padding: space.md, gap: 2 },
});
