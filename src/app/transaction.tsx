import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AmountPad } from '@/components/AmountPad';
import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Chip, ChipRow } from '@/components/Chip';
import { Header, Segmented } from '@/components/bits';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useAccounts, useCategories, useDeleteTransaction, useSaveTransaction, useTransaction } from '@/data/hooks';
import type { Transaction, TxKind } from '@/data/types';
import { useReward } from '@/gamification/Celebrations';
import { addDays, formatDay, startOfDay } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useTransaction(id);
  // When editing, wait for the row so the form starts with its values
  if (id && !existing.data) return <Header title="Edit transaction" close />;
  return <TransactionForm id={id} initial={existing.data} />;
}

function TransactionForm({ id, initial }: { id?: string; initial?: Transaction }) {
  const { colors } = useTheme();
  const reward = useReward();
  const accounts = useAccounts();
  const categories = useCategories();
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();

  const [kind, setKind] = useState<TxKind>(initial?.kind ?? 'expense');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [pickedAccountId, setAccountId] = useState<string | null>(initial?.account_id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(initial?.to_account_id ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(() => (initial ? new Date(initial.occurred_at) : new Date()));
  // Default to the first account until the user picks one
  const accountId = pickedAccountId ?? accounts.data?.[0]?.id ?? null;

  const cats = (categories.data ?? []).filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));
  const value = parseAmount(amount);
  const accentColor = kind === 'income' ? colors.income : kind === 'expense' ? colors.expense : colors.info;
  const canSave =
    value != null && !!accountId && (kind === 'transfer' ? !!toAccountId && toAccountId !== accountId : !!categoryId);

  const onSave = async () => {
    if (!canSave || value == null || !accountId) return;
    // Keep the time of day for edits; for today use "now", for other days noon
    const when = new Date(date);
    if (!id && startOfDay(date).getTime() !== startOfDay(new Date()).getTime()) when.setHours(12, 0, 0, 0);
    try {
      await save.mutateAsync({
        id,
        kind,
        amount: value,
        account_id: accountId,
        to_account_id: kind === 'transfer' ? toAccountId : null,
        category_id: kind === 'transfer' ? null : categoryId,
        note: note.trim() || null,
        occurred_at: when.toISOString(),
      });
      router.back();
      if (!id) reward('log');
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
  };

  const onDelete = () =>
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
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
      <Header
        title={id ? 'Edit transaction' : 'New transaction'}
        close
        right={
          id ? (
            <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel="Delete">
              <MaterialCommunityIcons name="trash-can-outline" size={26} color={colors.danger} />
            </Pressable>
          ) : undefined
        }
      />
      <Screen
        edges={['bottom']}
        contentStyle={{ paddingTop: 0, paddingBottom: space.xl }}
        footer={<Button3D title={id ? 'Save changes' : 'Add'} color={accentColor} onPress={onSave} disabled={!canSave} loading={save.isPending} />}>
        <Segmented
          value={kind}
          onChange={(k) => {
            setKind(k);
            setCategoryId(null);
          }}
          options={[
            { value: 'expense', label: 'Expense', color: colors.expense },
            { value: 'income', label: 'Income', color: colors.income },
            { value: 'transfer', label: 'Transfer', color: colors.info },
          ]}
        />

        <View style={styles.amountBox}>
          <AppText style={styles.amountText} color={amount ? accentColor : colors.border} numberOfLines={1} adjustsFontSizeToFit>
            ₹{amount || '0'}
          </AppText>
        </View>
        <AmountPad value={amount} onChange={setAmount} />

        {kind !== 'transfer' && (
          <View style={{ gap: space.sm }}>
            <AppText variant="caption" muted upper>
              Category
            </AppText>
            <ChipRow>
              {cats.map((c) => (
                <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
              <Chip label="New" icon="plus" onPress={() => router.push({ pathname: '/categories/edit', params: { kind } })} />
            </ChipRow>
          </View>
        )}

        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            {kind === 'transfer' ? 'From account' : 'Account'}
          </AppText>
          <ChipRow>
            {(accounts.data ?? []).map((a) => (
              <Chip key={a.id} label={a.name} icon={a.icon} color={a.color} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
            ))}
          </ChipRow>
        </View>

        {kind === 'transfer' && (
          <View style={{ gap: space.sm }}>
            <AppText variant="caption" muted upper>
              To account
            </AppText>
            <ChipRow>
              {(accounts.data ?? [])
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <Chip key={a.id} label={a.name} icon={a.icon} color={a.color} selected={toAccountId === a.id} onPress={() => setToAccountId(a.id)} />
                ))}
            </ChipRow>
            {(accounts.data?.length ?? 0) < 2 && (
              <AppText variant="caption" muted>
                Add a second account in More → Accounts to make transfers.
              </AppText>
            )}
          </View>
        )}

        <View style={styles.dateRow}>
          <Pressable onPress={() => setDate((d) => addDays(d, -1))} hitSlop={10} accessibilityLabel="Previous day">
            <MaterialCommunityIcons name="chevron-left-circle" size={34} color={colors.info} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="caption" muted upper>
              Date
            </AppText>
            <AppText variant="heading">{formatDay(date)}</AppText>
          </View>
          <Pressable
            onPress={() => setDate((d) => (addDays(d, 1) > new Date() ? d : addDays(d, 1)))}
            hitSlop={10}
            accessibilityLabel="Next day">
            <MaterialCommunityIcons name="chevron-right-circle" size={34} color={colors.info} />
          </Pressable>
        </View>

        <Input label="Note (optional)" placeholder="e.g. Lunch with friends" value={note} onChangeText={setNote} maxLength={120} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  amountBox: { alignItems: 'center', paddingVertical: space.sm },
  amountText: { fontSize: 52, lineHeight: 62, fontFamily: 'Nunito_900Black' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
