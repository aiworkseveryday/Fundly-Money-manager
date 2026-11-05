import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { EmptyState, Header } from '@/components/bits';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { budgetColor, ProgressBar } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import {
  useInsertPlan,
  useInvalidate,
  usePlanChecks,
  usePlanItems,
  useProfile,
  useSaveQuickTemplate,
  useTogglePlanCheck,
  useTransactions,
  useUpdateProfile,
} from '@/data/hooks';
import type { PlanItem } from '@/data/types';
import { addMonths, formatMonth, startOfMonth } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { activeItems, groupMeta, isPaid, PLAN_GROUPS, planActuals, SALARY, starterRows } from '@/plan/plan';
import { useTheme } from '@/theme/ThemeProvider';
import { space, tint } from '@/theme/tokens';

const editItem = (id?: string) => router.push({ pathname: '/plan/edit', params: id ? { id } : {} });

export default function Plan() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const items = usePlanItems();
  const checks = usePlanChecks(month);
  const toggle = useTogglePlanCheck();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const insertPlan = useInsertPlan();
  const saveTemplate = useSaveQuickTemplate();
  const tx = useTransactions({ from: month, to: addMonths(month, 1) });

  const list = activeItems(items.data ?? [], month);
  const { byItem, unplanned } = planActuals(list, tx.data ?? []);
  const income = profile.data?.monthly_income ?? SALARY;
  const planned = list.reduce((s, i) => s + i.amount, 0);
  const actualTotal = list.reduce((s, i) => s + (byItem.get(i.id) ?? 0), 0) + unplanned;
  const checklist = list.filter((i) => i.is_checklist);
  const paidCount = checklist.filter((i) => isPaid(i.amount, byItem.get(i.id) ?? 0, !!checks.data?.has(i.id))).length;

  const loadStarter = async () => {
    try {
      await insertPlan.mutateAsync(starterRows());
      if (profile.data && !profile.data.monthly_income) await updateProfile.mutateAsync({ id: profile.data.id, monthly_income: SALARY });
      await saveTemplate.mutateAsync({ label: 'Tea', emoji: '☕', amount: 20 });
      await saveTemplate.mutateAsync({ label: 'Eggs', emoji: '🥚', amount: 45 });
      await saveTemplate.mutateAsync({ label: 'Milk', emoji: '🥛', amount: 20 });
    } catch (e) {
      Alert.alert('Could not load plan', (e as Error).message);
    }
  };

  const loading = items.isLoading || profile.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Monthly plan" right={list.length ? <Button3D title="Add" icon="plus" small onPress={() => editItem()} /> : undefined} />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }} refreshing={tx.isRefetching} onRefresh={invalidate}>
        <MonthSwitcher month={month} onChange={setMonth} />

        {!list.length && !loading ? (
          <EmptyState
            title="No plan yet"
            subtitle="Start from your own monthly sheet (with the tea and supplement cuts applied). You can edit every line afterwards."
            mood="happy"
            action={<Button3D title="Load my plan" icon="clipboard-list" onPress={loadStarter} loading={insertPlan.isPending} />}
          />
        ) : (
          <>
            {/* summary */}
            <Card style={{ gap: space.sm }}>
              <View style={styles.row}>
                <Stat label="Income" value={formatINR(income)} color={colors.income} />
                <Stat label="Planned" value={formatINR(planned)} />
                <Stat label="Unplanned room" value={formatINR(income - planned)} color={income - planned < 0 ? colors.danger : colors.info} />
              </View>
              <AppText variant="caption" muted>
                Used so far in {formatMonth(month)}: {formatINR(actualTotal)} of {formatINR(planned)}
              </AppText>
              <ProgressBar progress={planned ? actualTotal / planned : 0} color={budgetColor(planned ? actualTotal / planned : 0)} />
            </Card>

            {/* must-pay checklist */}
            {!!checklist.length && (
              <Card style={{ gap: space.xs }}>
                <View style={styles.row}>
                  <AppText variant="heading" style={{ flex: 1 }}>
                    Must-pay checklist
                  </AppText>
                  <AppText variant="label" color={paidCount === checklist.length ? colors.income : colors.textMuted}>
                    {paidCount}/{checklist.length} done
                  </AppText>
                </View>
                {checklist.map((i) => {
                  const actual = byItem.get(i.id) ?? 0;
                  const ticked = !!checks.data?.has(i.id);
                  const paid = isPaid(i.amount, actual, ticked);
                  const auto = paid && !ticked;
                  return (
                    <Pressable
                      key={i.id}
                      style={styles.checkRow}
                      onPress={() => !auto && toggle.mutate({ itemId: i.id, month, checked: !ticked })}
                      onLongPress={() => editItem(i.id)}>
                      <MaterialCommunityIcons
                        name={paid ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                        size={28}
                        color={paid ? colors.income : colors.border}
                      />
                      <View style={{ flex: 1 }}>
                        <AppText variant="label" style={paid ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>
                          {i.name}
                        </AppText>
                        <AppText variant="caption" muted>
                          {groupMeta(i.grp).label}
                          {auto ? ' · matched a payment' : ''}
                          {i.ends_on ? ` · until ${formatMonth(new Date(i.ends_on))}` : ''}
                        </AppText>
                      </View>
                      <AppText variant="label">{formatINR(i.amount)}</AppText>
                    </Pressable>
                  );
                })}
                <AppText variant="caption" muted>
                  Tap to tick by hand, long-press to edit. Payments whose note contains the item&apos;s words tick it automatically.
                </AppText>
              </Card>
            )}

            {/* spend groups */}
            {PLAN_GROUPS.map((g) => {
              const rows = list.filter((i) => i.grp === g.id && !i.is_checklist);
              if (!rows.length) return null;
              const gPlanned = rows.reduce((s, i) => s + i.amount, 0);
              const gActual = rows.reduce((s, i) => s + (byItem.get(i.id) ?? 0), 0);
              return (
                <Card key={g.id} style={{ gap: space.sm, borderColor: tint(g.color, 0.6) }}>
                  <View style={styles.row}>
                    <MaterialCommunityIcons name={g.icon as never} size={22} color={g.color} />
                    <AppText variant="heading" style={{ flex: 1 }}>
                      {g.label}
                    </AppText>
                    <AppText variant="label" color={gActual > gPlanned ? colors.danger : colors.textMuted}>
                      {formatINR(gActual, { compact: true })} / {formatINR(gPlanned, { compact: true })}
                    </AppText>
                  </View>
                  {rows.map((i) => (
                    <ItemRow key={i.id} item={i} actual={byItem.get(i.id) ?? 0} />
                  ))}
                </Card>
              );
            })}

            <Card style={styles.row}>
              <MaterialCommunityIcons name="help-circle-outline" size={22} color={colors.textMuted} />
              <AppText style={{ flex: 1 }}>Unplanned spends</AppText>
              <AppText variant="label" color={unplanned ? colors.expense : colors.textMuted}>
                {formatINR(unplanned)}
              </AppText>
            </Card>
          </>
        )}
      </Screen>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="caption" muted upper numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="label" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

function ItemRow({ item, actual }: { item: PlanItem; actual: number }) {
  const { colors } = useTheme();
  const ratio = actual / item.amount;
  return (
    <Pressable onPress={() => editItem(item.id)} style={{ gap: 4 }}>
      <View style={styles.row}>
        <AppText style={{ flex: 1 }} numberOfLines={1}>
          {item.name}
          {item.ends_on ? (
            <AppText variant="caption" muted>
              {'  '}until {formatMonth(new Date(item.ends_on))}
            </AppText>
          ) : null}
        </AppText>
        <AppText variant="caption" color={ratio > 1 ? colors.danger : colors.textMuted}>
          {formatINR(actual)} / {formatINR(item.amount)}
        </AppText>
      </View>
      <ProgressBar progress={Math.min(ratio, 1)} color={budgetColor(ratio)} height={8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
});
