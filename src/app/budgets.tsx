import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { Header, IconBubble } from '@/components/bits';
import { Input } from '@/components/Input';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { budgetColor, ProgressBar } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { useBudgets, useCategories, useCopyBudgets, useSetBudget, useTransactions } from '@/data/hooks';
import type { Category } from '@/data/types';
import { useReward } from '@/gamification/Celebrations';
import { addMonths, startOfMonth } from '@/lib/dates';
import { formatINR, parseAmount } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

export default function Budgets() {
  const { colors } = useTheme();
  const reward = useReward();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [editing, setEditing] = useState<Category | null>(null);
  const [input, setInput] = useState('');

  const categories = (useCategories().data ?? []).filter((c) => c.kind === 'expense');
  const budgets = useBudgets(month);
  const txs = useTransactions({ from: month, to: addMonths(month, 1) });
  const setBudget = useSetBudget();
  const copy = useCopyBudgets();

  const spent = new Map<string, number>();
  for (const t of txs.data ?? []) if (t.kind === 'expense' && t.category_id) spent.set(t.category_id, (spent.get(t.category_id) ?? 0) + t.amount);
  const budgetByCat = new Map((budgets.data ?? []).map((b) => [b.category_id, b.amount]));

  const totalBudget = [...budgetByCat.values()].reduce((s, v) => s + v, 0);
  const totalSpentInBudgets = [...budgetByCat.keys()].reduce((s, id) => s + (spent.get(id) ?? 0), 0);

  // Budgeted categories first, most at-risk at the top
  const rows = categories
    .map((c) => ({ cat: c, budget: budgetByCat.get(c.id), spent: spent.get(c.id) ?? 0 }))
    .sort((a, b) => (b.budget ? b.spent / b.budget : -1) - (a.budget ? a.spent / a.budget : -1));

  const open = (c: Category) => {
    setEditing(c);
    setInput(budgetByCat.get(c.id) ? String(budgetByCat.get(c.id)) : '');
  };

  const onSave = async (clear = false) => {
    if (!editing) return;
    const amount = clear ? null : parseAmount(input);
    if (!clear && amount == null) return;
    const isFirst = !budgets.data?.length;
    await setBudget.mutateAsync({ categoryId: editing.id, month, amount });
    setEditing(null);
    if (amount && isFirst) reward('budget_set');
  };

  const onCopy = async () => {
    const n = await copy.mutateAsync(month);
    if (!n) Alert.alert('Nothing to copy', 'Last month had no budgets.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Budgets" />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }}>
        <MonthSwitcher month={month} onChange={setMonth} />

        {totalBudget > 0 ? (
          <Card style={{ gap: space.sm }}>
            <View style={styles.between}>
              <AppText variant="label">Total</AppText>
              <AppText variant="label">
                {formatINR(totalSpentInBudgets)} / {formatINR(totalBudget)}
              </AppText>
            </View>
            <ProgressBar progress={totalSpentInBudgets / totalBudget} color={budgetColor(totalSpentInBudgets / totalBudget)} />
            <AppText variant="caption" muted>
              {totalSpentInBudgets <= totalBudget
                ? `${formatINR(totalBudget - totalSpentInBudgets)} left to spend`
                : `${formatINR(totalSpentInBudgets - totalBudget)} over budget`}
            </AppText>
          </Card>
        ) : (
          <Card style={{ gap: space.sm }}>
            <AppText>Tap a category below to set a monthly limit.</AppText>
            <Button3D title="Copy last month" tone="outline" small icon="content-copy" onPress={onCopy} loading={copy.isPending} />
          </Card>
        )}

        {rows.map(({ cat, budget, spent: s }) => {
          const ratio = budget ? s / budget : 0;
          return (
            <Card key={cat.id} onPress={() => open(cat)} style={{ gap: space.sm }}>
              <View style={styles.row}>
                <IconBubble icon={cat.icon} color={cat.color} size={40} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{cat.name}</AppText>
                  <AppText variant="caption" muted>
                    {budget ? `${formatINR(s)} of ${formatINR(budget)}` : `Spent ${formatINR(s)} · no budget`}
                  </AppText>
                </View>
                {budget ? (
                  <AppText variant="label" color={budgetColor(ratio)}>
                    {ratio > 1 ? `${formatINR(s - budget)} over` : `${formatINR(budget - s)} left`}
                  </AppText>
                ) : (
                  <AppText variant="caption" color={colors.info} upper>
                    Set
                  </AppText>
                )}
              </View>
              {!!budget && <ProgressBar progress={ratio} color={budgetColor(ratio)} height={12} />}
            </Card>
          );
        })}
      </Screen>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText variant="heading">{editing?.name} budget</AppText>
            <Input prefix="₹" placeholder="Monthly limit" keyboardType="decimal-pad" autoFocus value={input} onChangeText={setInput} />
            <Button3D title="Save" onPress={() => onSave()} disabled={parseAmount(input) == null} loading={setBudget.isPending} />
            {editing && budgetByCat.has(editing.id) && <Button3D title="Remove budget" tone="ghost" onPress={() => onSave(true)} />}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { padding: space.xl, gap: space.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 2 },
});
