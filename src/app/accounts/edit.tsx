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
import { useAccounts, useArchiveAccount, useSaveAccount } from '@/data/hooks';
import type { AccountType } from '@/data/types';
import { useTheme } from '@/theme/ThemeProvider';
import { ACCOUNT_TYPES } from '@/data/constants';
import { palette, space } from '@/theme/tokens';

export default function EditAccount() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const accounts = useAccounts();
  const account = accounts.data?.find((a) => a.id === id);
  const save = useSaveAccount();
  const archive = useArchiveAccount();

  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank');
  const [color, setColor] = useState(account?.color ?? palette.blue);
  const [opening, setOpening] = useState(account ? String(Math.abs(account.opening_balance)) : '');
  const [last4, setLast4] = useState(account?.sms_last4 ?? '');

  const isCredit = type === 'credit';
  const openingNum = Number(opening.replace(/,/g, '') || '0');
  const validLast4 = !last4 || /^\d{3,6}$/.test(last4);
  const canSave = name.trim().length > 0 && Number.isFinite(openingNum) && validLast4;

  const onSave = async () => {
    try {
      await save.mutateAsync({
        id,
        name: name.trim(),
        type,
        color,
        icon: ACCOUNT_TYPES.find((t) => t.value === type)!.icon,
        // A credit card's outstanding amount is money owed, so it is stored as negative.
        opening_balance: isCredit ? -Math.abs(openingNum) : openingNum,
        sms_last4: last4 || null,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
  };

  const onArchive = () =>
    Alert.alert('Remove account?', 'It will be hidden. Past transactions stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await archive.mutateAsync(id!);
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={id ? 'Edit account' : 'New account'} close />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }} footer={<Button3D title="Save account" onPress={onSave} disabled={!canSave} loading={save.isPending} />}>
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" muted upper>
            Type
          </AppText>
          <ChipRow>
            {ACCOUNT_TYPES.map((t) => (
              <Chip key={t.value} label={t.label} icon={t.icon} selected={type === t.value} color={color} onPress={() => setType(t.value)} />
            ))}
          </ChipRow>
        </View>
        <Input label="Name" placeholder={isCredit ? 'e.g. HDFC Millennia' : 'e.g. SBI Savings'} value={name} onChangeText={setName} maxLength={30} />
        <Input
          label={isCredit ? 'Current outstanding (amount you owe)' : 'Current balance'}
          prefix="₹"
          placeholder="0"
          keyboardType="decimal-pad"
          value={opening}
          onChangeText={setOpening}
        />
        {type !== 'cash' && (
          <Input
            label="Last 4 digits (for SMS matching)"
            placeholder="1234"
            keyboardType="number-pad"
            maxLength={6}
            value={last4}
            onChangeText={(t) => setLast4(t.replace(/\D/g, ''))}
          />
        )}
        <ColorPicker value={color} onChange={setColor} />
        {id && <Button3D title="Remove account" tone="ghost" onPress={onArchive} />}
      </Screen>
    </View>
  );
}
