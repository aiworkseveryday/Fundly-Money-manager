import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { Header } from '@/components/bits';
import { Input } from '@/components/Input';
import { ProgressRing } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { useContribute, useDeleteGoal, useGoalContributions, useGoals, useSaveGoal } from '@/data/hooks';
import { useReward } from '@/gamification/Celebrations';
import { formatDay } from '@/lib/dates';
import { formatINR, parseAmount } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const reward = useReward();
  const goal = useGoals().data?.find((g) => g.id === id);
  const history = useGoalContributions(id);
  const contribute = useContribute();
  const saveGoal = useSaveGoal();
  const deleteGoal = useDeleteGoal();
  const [amount, setAmount] = useState('');
  const [withdraw, setWithdraw] = useState(false);

  if (!goal) return <Header title="" />;

  const ratio = goal.saved / goal.target_amount;
  const remaining = Math.max(0, goal.target_amount - goal.saved);
  const value = parseAmount(amount);

  const onAdd = async () => {
    if (value == null) return;
    const delta = withdraw ? -Math.min(value, goal.saved) : value;
    if (delta === 0) return;
    await contribute.mutateAsync({ goalId: goal.id, amount: delta });
    setAmount('');
    if (!withdraw) {
      const reached = !goal.completed_at && goal.saved + delta >= goal.target_amount;
      if (reached) {
        await saveGoal.mutateAsync({ id: goal.id, name: goal.name, target_amount: goal.target_amount, completed_at: new Date().toISOString() });
        await reward('goal_complete');
      } else {
        await reward('goal_contribution');
      }
    }
  };

  const onDelete = () =>
    Alert.alert('Delete goal?', 'Its savings history will be removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal.mutateAsync(goal.id);
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title={goal.name}
        right={
          <View style={{ flexDirection: 'row', gap: space.lg }}>
            <Pressable onPress={() => router.push({ pathname: '/goals/edit', params: { id: goal.id } })} hitSlop={8} accessibilityLabel="Edit goal">
              <MaterialCommunityIcons name="pencil" size={24} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel="Delete goal">
              <MaterialCommunityIcons name="trash-can-outline" size={24} color={colors.danger} />
            </Pressable>
          </View>
        }
      />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }}>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <ProgressRing progress={ratio} size={180} stroke={16} color={colors.primary}>
            <AppText style={{ fontSize: 54, lineHeight: 64 }}>{goal.emoji}</AppText>
          </ProgressRing>
          <AppText variant="title">{formatINR(goal.saved)}</AppText>
          <AppText muted>
            of {formatINR(goal.target_amount)} · {goal.completed_at ? 'Goal reached! 🎉' : `${formatINR(remaining)} to go`}
          </AppText>
        </View>

        <Card style={{ gap: space.md }}>
          <ChipRow>
            <Chip label="Add money" icon="plus" selected={!withdraw} color={colors.primary} onPress={() => setWithdraw(false)} />
            <Chip label="Withdraw" icon="minus" selected={withdraw} color={colors.warning} onPress={() => setWithdraw(true)} />
          </ChipRow>
          <Input prefix="₹" placeholder="Amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          {!withdraw && remaining > 0 && (
            <ChipRow>
              {[500, 1000, 5000].filter((v) => v < remaining).map((v) => (
                <Chip key={v} label={`+${formatINR(v)}`} onPress={() => setAmount(String(v))} />
              ))}
              <Chip label={`All ${formatINR(remaining)}`} onPress={() => setAmount(String(remaining))} />
            </ChipRow>
          )}
          <Button3D
            title={withdraw ? 'Withdraw' : 'Add to goal'}
            tone={withdraw ? 'warning' : 'primary'}
            onPress={onAdd}
            disabled={value == null}
            loading={contribute.isPending}
          />
        </Card>

        <AppText variant="heading">History</AppText>
        {(history.data ?? []).map((c) => (
          <View key={c.id} style={styles.histRow}>
            <MaterialCommunityIcons
              name={c.amount > 0 ? 'arrow-up-circle' : 'arrow-down-circle'}
              size={26}
              color={c.amount > 0 ? colors.income : colors.warning}
            />
            <AppText style={{ flex: 1 }}>{formatDay(new Date(c.contributed_at))}</AppText>
            <AppText variant="label" color={c.amount > 0 ? colors.income : colors.warning}>
              {formatINR(c.amount, { signed: true })}
            </AppText>
          </View>
        ))}
        {!history.data?.length && <AppText muted>No savings yet. Add your first amount above!</AppText>}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  histRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
