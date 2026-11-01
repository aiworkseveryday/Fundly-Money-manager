import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Chip, ChipRow } from '@/components/Chip';
import { Header } from '@/components/bits';
import { DatePickerRow } from '@/components/DueDatePicker';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { BILL_FREQUENCIES } from '@/data/constants';
import { useAccounts, useBills, useCategories, useDeleteBill, useSaveBill } from '@/data/hooks';
import type { BillFrequency } from '@/data/types';
import { addDays, toISODate } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const REMIND_OPTIONS = [0, 1, 2, 3, 5, 7];

export default function EditBill() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const bill = useBills().data?.find((b) => b.id === id);
  const accounts = useAccounts().data ?? [];
  const categories = (useCategories().data ?? []).filter((c) => c.kind === 'expense');
  const save = useSaveBill();
  const remove = useDeleteBill();

  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState(bill ? String(bill.amount) : '');
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? 'monthly');
  const [due, setDue] = useState(bill?.next_due_date ?? toISODate(addDays(new Date(), 7)));
  const [remind, setRemind] = useState(bill?.remind_days_before ?? 2);
  const [categoryId, setCategoryId] = useState<string | null>(bill?.category_id ?? null);
  const [accountId, setAccountId] = useState<string | null>(bill?.account_id ?? null);
  const [active, setActive] = useState(bill?.active ?? true);

  const value = parseAmount(amount);
  const canSave = name.trim().length > 0 && value != null;

  const onSave = async () => {
    if (!canSave || value == null) return;
    try {
      await save.mutateAsync({
        id,
        name: name.trim(),
        amount: value,
        frequency,
        next_due_date: due,
        remind_days_before: remind,
        category_id: categoryId,
        account_id: accountId,
        active,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
  };

  const onDelete = () =>
    Alert.alert('Delete bill?', 'Its reminders will stop.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(id!);
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={id ? 'Edit bill' : 'New bill'} close />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }} footer={<Button3D title="Save bill" onPress={onSave} disabled={!canSave} loading={save.isPending} />}>
        <Input label="Name" placeholder="e.g. Rent, Netflix, Car EMI" value={name} onChangeText={setName} maxLength={40} />
        <Input label="Amount" prefix="₹" placeholder="0" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            Repeats
          </AppText>
          <ChipRow>
            {BILL_FREQUENCIES.map((f) => (
              <Chip key={f.value} label={f.label} selected={frequency === f.value} onPress={() => setFrequency(f.value)} />
            ))}
          </ChipRow>
        </View>
        <DatePickerRow label="Next due date" value={due} onChange={setDue} />
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            Remind me
          </AppText>
          <ChipRow>
            {REMIND_OPTIONS.map((d) => (
              <Chip key={d} label={d === 0 ? 'On the day' : `${d} day${d > 1 ? 's' : ''} before`} selected={remind === d} onPress={() => setRemind(d)} />
            ))}
          </ChipRow>
        </View>
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            Category
          </AppText>
          <ChipRow>
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
            ))}
          </ChipRow>
        </View>
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            Pay from
          </AppText>
          <ChipRow>
            {accounts.map((a) => (
              <Chip key={a.id} label={a.name} icon={a.icon} color={a.color} selected={accountId === a.id} onPress={() => setAccountId(accountId === a.id ? null : a.id)} />
            ))}
          </ChipRow>
        </View>
        {id && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="label">Reminders active</AppText>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary }} />
          </View>
        )}
        {id && <Button3D title="Delete bill" tone="ghost" onPress={onDelete} />}
      </Screen>
    </View>
  );
}
