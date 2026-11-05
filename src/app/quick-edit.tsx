import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Chip, ChipRow } from '@/components/Chip';
import { Header } from '@/components/bits';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useAccounts, useCategories, useDeleteQuickTemplate, useQuickTemplates, useSaveQuickTemplate } from '@/data/hooks';
import type { QuickTemplate } from '@/data/types';
import { parseAmount } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function QuickEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const templates = useQuickTemplates();
  const template = templates.data?.find((t) => t.id === id);
  if (id && !template) return <Header title="Edit quick button" close />;
  return <QuickForm key={template?.id ?? 'new'} id={id} initial={template} />;
}

function QuickForm({ id, initial }: { id?: string; initial?: QuickTemplate }) {
  const { colors } = useTheme();
  const categories = useCategories();
  const accounts = useAccounts();
  const save = useSaveQuickTemplate();
  const remove = useDeleteQuickTemplate();

  const [label, setLabel] = useState(initial?.label ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '⚡');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [accountId, setAccountId] = useState<string | null>(initial?.account_id ?? null);

  const value = parseAmount(amount);
  const canSave = label.trim().length > 0 && value != null;

  const onSave = async () => {
    if (!canSave || value == null) return;
    try {
      await save.mutateAsync({ id, label: label.trim(), emoji: emoji.trim() || '⚡', amount: value, category_id: categoryId, account_id: accountId });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
  };

  const onDelete = async () => {
    await remove.mutateAsync(id!);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={id ? 'Edit quick button' : 'New quick button'} close />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }} footer={<Button3D title="Save" onPress={onSave} disabled={!canSave} loading={save.isPending} />}>
        <AppText muted>One tap on Home logs this spend, for things you buy often, like tea.</AppText>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ width: 90 }}>
            <Input label="Emoji" value={emoji} onChangeText={setEmoji} maxLength={4} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Name" placeholder="e.g. Tea" value={label} onChangeText={setLabel} maxLength={20} />
          </View>
        </View>
        <Input label="Amount" prefix="₹" placeholder="20" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            Category
          </AppText>
          <ChipRow>
            <Chip label="Auto" selected={!categoryId} onPress={() => setCategoryId(null)} />
            {(categories.data ?? [])
              .filter((c) => c.kind === 'expense')
              .map((c) => (
                <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
          </ChipRow>
        </View>

        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            Pay from
          </AppText>
          <ChipRow>
            <Chip label="Main account" selected={!accountId} onPress={() => setAccountId(null)} />
            {(accounts.data ?? []).map((a) => (
              <Chip key={a.id} label={a.name} color={a.color} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
            ))}
          </ChipRow>
        </View>

        {id && <Button3D title="Delete quick button" tone="ghost" onPress={onDelete} />}
      </Screen>
    </View>
  );
}
