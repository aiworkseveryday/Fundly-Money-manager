import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Chip, ChipRow } from '@/components/Chip';
import { ColorPicker } from '@/components/ColorPicker';
import { Header } from '@/components/bits';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useAccounts, useCloseLoan, useLoans, useSaveLoan } from '@/data/hooks';
import type { Loan } from '@/data/types';
import { addDays, toISODate } from '@/lib/dates';
import { formatINR, parseAmount } from '@/lib/money';
import { outstandingFrom } from '@/loans/loans';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, space } from '@/theme/tokens';

export default function EditLoan() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const loans = useLoans();
  const loan = loans.data?.find((l) => l.id === id);
  // When editing, wait for the row so the form starts with its values
  if (id && !loan) return <Header title="Edit loan" close />;
  return <LoanForm key={loan?.id ?? 'new'} initial={loan} />;
}

const toInt = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);
const toRate = (s: string) => (/^\d+(\.\d{1,2})?$/.test(s.trim()) ? Number(s.trim()) : null);

function LoanForm({ initial }: { initial?: Loan }) {
  const { colors } = useTheme();
  const accounts = useAccounts();
  const save = useSaveLoan();
  const close = useCloseLoan();

  const [name, setName] = useState(initial?.name ?? '');
  const [lender, setLender] = useState(initial?.lender ?? '');
  const [emi, setEmi] = useState(initial ? String(initial.emi) : '');
  const [rate, setRate] = useState(initial ? String(initial.annual_rate) : '');
  const [monthsLeft, setMonthsLeft] = useState('');
  const [exact, setExact] = useState('');
  const [emiDay, setEmiDay] = useState(String(initial?.emi_day ?? 5));
  const [totalMonths, setTotalMonths] = useState(initial?.total_months ? String(initial.total_months) : '');
  const [accountId, setAccountId] = useState<string | null>(initial?.account_id ?? null);
  const [smsMatch, setSmsMatch] = useState(initial?.sms_match ?? '');
  const [prepays, setPrepays] = useState(String(initial?.prepay_per_year ?? 2));
  const [color, setColor] = useState(initial?.color ?? palette.red);

  const emiNum = parseAmount(emi);
  const rateNum = toRate(rate);
  const monthsNum = toInt(monthsLeft);
  const exactNum = parseAmount(exact);
  const dayNum = toInt(emiDay);
  // what is owed: the lender's exact figure wins, else work it out from months left
  const computed = exactNum ?? (emiNum && rateNum != null && monthsNum ? outstandingFrom(emiNum, rateNum, monthsNum) : null);
  const canSave =
    name.trim().length > 0 && !!emiNum && rateNum != null && !!dayNum && dayNum >= 1 && dayNum <= 31 && (initial ? true : computed != null);

  const onSave = async () => {
    if (!canSave || !emiNum || rateNum == null || !dayNum) return;
    const balanceChanged = computed != null;
    try {
      await save.mutateAsync({
        id: initial?.id,
        name: name.trim(),
        lender: lender.trim() || null,
        emi: emiNum,
        annual_rate: rateNum,
        outstanding: computed ?? initial!.outstanding,
        // a new figure already includes everything paid up to today, so only later payments count on top
        ...(balanceChanged ? { as_of: toISODate(initial ? addDays(new Date(), 1) : new Date()) } : {}),
        emi_day: dayNum,
        total_months: toInt(totalMonths),
        account_id: accountId,
        sms_match: smsMatch.trim() || null,
        prepay_per_year: toInt(prepays) ?? 2,
        color,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
  };

  const onClose = () =>
    Alert.alert('Mark this loan as closed?', 'It disappears from the dashboard. Do this once it is fully repaid.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close loan',
        style: 'destructive',
        onPress: async () => {
          await close.mutateAsync(initial!.id);
          router.dismissTo('/loans');
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={initial ? 'Edit loan' : 'New loan'} close />
      <Screen
        edges={['bottom']}
        contentStyle={{ paddingTop: 0 }}
        footer={<Button3D title="Save loan" onPress={onSave} disabled={!canSave} loading={save.isPending} />}>
        <Input label="Name" placeholder="e.g. Car loan" value={name} onChangeText={setName} maxLength={30} />
        <Input label="Lender (optional)" placeholder="e.g. HDFC Bank" value={lender} onChangeText={setLender} maxLength={30} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Input label="EMI" prefix="₹" keyboardType="decimal-pad" value={emi} onChangeText={setEmi} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Interest % a year" placeholder="10.5" keyboardType="decimal-pad" value={rate} onChangeText={setRate} />
          </View>
        </View>

        <View style={{ gap: space.sm, padding: space.md, borderRadius: 16, backgroundColor: colors.surfaceAlt }}>
          <AppText variant="label">How much is still owed?</AppText>
          {initial && (
            <AppText variant="caption" muted>
              Fundly started from {formatINR(Math.round(initial.outstanding))}. Leave both boxes empty to keep tracking from there.
            </AppText>
          )}
          <Input
            label="EMIs left (including the next one)"
            placeholder="44"
            keyboardType="number-pad"
            value={monthsLeft}
            onChangeText={setMonthsLeft}
          />
          <Input
            label="Or the exact amount from your lender's app"
            prefix="₹"
            placeholder="optional"
            keyboardType="decimal-pad"
            value={exact}
            onChangeText={setExact}
          />
          {computed != null && <AppText color={colors.info}>Still owed: {formatINR(Math.round(computed))}</AppText>}
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Input label="EMI date (day)" keyboardType="number-pad" maxLength={2} value={emiDay} onChangeText={setEmiDay} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Prepayments / year" keyboardType="number-pad" maxLength={2} value={prepays} onChangeText={setPrepays} />
          </View>
        </View>
        <Input
          label="Full tenure in months (optional, for % paid)"
          placeholder="e.g. 60"
          keyboardType="number-pad"
          value={totalMonths}
          onChangeText={setTotalMonths}
        />

        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            EMI is paid from
          </AppText>
          <ChipRow>
            {(accounts.data ?? []).map((a) => (
              <Chip key={a.id} label={a.name} color={a.color} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
            ))}
          </ChipRow>
        </View>
        <Input
          label="Words in the EMI SMS (comma separated)"
          placeholder="e.g. car loan, bajaj"
          autoCapitalize="none"
          value={smsMatch}
          onChangeText={setSmsMatch}
          maxLength={80}
        />
        <AppText variant="caption" muted>
          An SMS debit that mentions one of these words, or matches the EMI amount, is suggested as this loan&apos;s EMI.
        </AppText>
        <ColorPicker value={color} onChange={setColor} />
        {initial && <Button3D title="Loan fully repaid: close it" tone="ghost" onPress={onClose} />}
      </Screen>
    </View>
  );
}
