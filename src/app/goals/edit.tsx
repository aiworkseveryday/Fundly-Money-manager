import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Header } from '@/components/bits';
import { DatePickerRow } from '@/components/DueDatePicker';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useGoals, useSaveGoal } from '@/data/hooks';
import { addMonths, todayISO, toISODate } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, tint } from '@/theme/tokens';

const EMOJIS = ['🎯', '📱', '💻', '✈️', '🏖️', '🚗', '🏍️', '🏠', '💍', '🎓', '🛟', '🎁', '🎮', '📷', '🐶', '💰'];

export default function EditGoal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const goal = useGoals().data?.find((g) => g.id === id);
  const save = useSaveGoal();

  const [name, setName] = useState(goal?.name ?? '');
  const [emoji, setEmoji] = useState(goal?.emoji ?? '🎯');
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : '');
  const [deadline, setDeadline] = useState<string | null>(goal?.deadline ?? null);

  const amount = parseAmount(target);
  const canSave = name.trim().length > 0 && amount != null;

  const onSave = async () => {
    if (!canSave || amount == null) return;
    try {
      await save.mutateAsync({ id, name: name.trim(), emoji, target_amount: amount, deadline });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={id ? 'Edit goal' : 'New goal'} close />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }} footer={<Button3D title="Save goal" onPress={onSave} disabled={!canSave} loading={save.isPending} />}>
        <View style={styles.emojiGrid}>
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              style={[
                styles.emojiCell,
                { borderColor: emoji === e ? colors.info : colors.border, backgroundColor: emoji === e ? tint(colors.info, 0.12) : colors.surface },
              ]}>
              <AppText style={{ fontSize: 26, lineHeight: 34 }}>{e}</AppText>
            </Pressable>
          ))}
        </View>
        <Input label="Goal name" placeholder="e.g. New iPhone" value={name} onChangeText={setName} maxLength={40} />
        <Input label="Target amount" prefix="₹" placeholder="50,000" keyboardType="decimal-pad" value={target} onChangeText={setTarget} />
        {deadline ? (
          <>
            <DatePickerRow label="Target date" value={deadline} onChange={setDeadline} min={todayISO()} />
            <Button3D title="Remove deadline" tone="ghost" small onPress={() => setDeadline(null)} />
          </>
        ) : (
          <Button3D title="Add a target date" tone="outline" icon="calendar" onPress={() => setDeadline(toISODate(addMonths(new Date(), 6)))} />
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  emojiCell: { width: 52, height: 52, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
