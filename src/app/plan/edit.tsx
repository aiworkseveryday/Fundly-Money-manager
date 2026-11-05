import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Chip, ChipRow } from '@/components/Chip';
import { DatePickerRow } from '@/components/DueDatePicker';
import { Header } from '@/components/bits';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useCategories, useDeletePlanItem, usePlanItems, useSavePlanItem } from '@/data/hooks';
import type { PlanGroup } from '@/data/types';
import { addMonths, monthKey, toISODate } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { PLAN_GROUPS } from '@/plan/plan';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function EditPlanItem() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const items = usePlanItems();
  const item = items.data?.find((i) => i.id === id);
  // When editing, wait for the row so the form starts with its values
  if (id && !item) return <Header title="Edit plan item" close />;
  return <PlanItemForm key={item?.id ?? 'new'} id={id} initial={item} />;
}

function PlanItemForm({ id, initial }: { id?: string; initial?: NonNullable<ReturnType<typeof usePlanItems>['data']>[number] }) {
  const { colors } = useTheme();
  const categories = useCategories();
  const save = useSavePlanItem();
  const remove = useDeletePlanItem();

  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [grp, setGrp] = useState<PlanGroup>(initial?.grp ?? 'misc');
  const [checklist, setChecklist] = useState(initial?.is_checklist ?? false);
  const [match, setMatch] = useState(initial?.match_text ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [endsOn, setEndsOn] = useState<string | null>(initial?.ends_on ?? null);

  const value = parseAmount(amount);
  const canSave = name.trim().length > 0 && value != null;
  const expenseCats = (categories.data ?? []).filter((c) => c.kind === 'expense');

  const onSave = async () => {
    if (!canSave || value == null) return;
    try {
      await save.mutateAsync({
        id,
        name: name.trim(),
        amount: value,
        grp,
        is_checklist: checklist,
        match_text: match.trim() || null,
        category_id: categoryId,
        ends_on: endsOn,
        ...(id ? {} : { starts_on: monthKey(new Date()) }),
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
  };

  const onDelete = () =>
    Alert.alert('Remove from plan?', 'Past months will no longer show it either.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(id!);
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={id ? 'Edit plan item' : 'New plan item'} close />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }} footer={<Button3D title="Save" onPress={onSave} disabled={!canSave} loading={save.isPending} />}>
        <Input label="Name" placeholder="e.g. Gym membership" value={name} onChangeText={setName} maxLength={40} />
        <Input label="Monthly amount" prefix="₹" placeholder="0" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            Group
          </AppText>
          <ChipRow>
            {PLAN_GROUPS.map((g) => (
              <Chip key={g.id} label={g.label} icon={g.icon} color={g.color} selected={grp === g.id} onPress={() => setGrp(g.id)} />
            ))}
          </ChipRow>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">One payment a month</AppText>
            <AppText variant="caption" muted>
              Shows in the must-pay checklist (EMIs, rent, bills) instead of as a spending bar.
            </AppText>
          </View>
          <Switch value={checklist} onValueChange={setChecklist} trackColor={{ true: colors.primary }} />
        </View>

        <Input
          label="Match words (comma separated)"
          placeholder="e.g. tea, chai"
          autoCapitalize="none"
          value={match}
          onChangeText={setMatch}
          maxLength={80}
        />
        <AppText variant="caption" muted>
          A transaction whose note contains one of these words counts towards this item.
        </AppText>

        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            Or count a whole category
          </AppText>
          <ChipRow>
            <Chip label="None" selected={!categoryId} onPress={() => setCategoryId(null)} />
            {expenseCats.map((c) => (
              <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </ChipRow>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">Ends on a date</AppText>
            <AppText variant="caption" muted>
              For things with an end, like a 6-month treatment.
            </AppText>
          </View>
          <Switch
            value={!!endsOn}
            onValueChange={(on) => setEndsOn(on ? toISODate(addMonths(new Date(), 6)) : null)}
            trackColor={{ true: colors.primary }}
          />
        </View>
        {endsOn && <DatePickerRow label="Last day" value={endsOn} onChange={setEndsOn} min={toISODate(new Date())} />}

        {id && <Button3D title="Remove from plan" tone="ghost" onPress={onDelete} />}
      </Screen>
    </View>
  );
}
