import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Chip, ChipRow } from '@/components/Chip';
import { ColorPicker } from '@/components/ColorPicker';
import { Header } from '@/components/bits';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useAccounts, useAdjustBalance, useArchiveAccount, useSaveAccount } from '@/data/hooks';
import { formatINR, parseAmount } from '@/lib/money';
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
  const [inTotal, setInTotal] = useState(account?.include_in_total ?? true);
  const [isDefault, setIsDefault] = useState(account?.is_default ?? false);
  const [keywords, setKeywords] = useState(account?.sms_keywords ?? '');
  const [actual, setActual] = useState('');
  const adjust = useAdjustBalance();

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
        include_in_total: inTotal,
        is_default: isDefault,
        sms_keywords: keywords.trim() || null,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    }
  };

  const onAdjust = async () => {
    const value = parseAmount(actual);
    if (!account || value == null) return;
    try {
      const diff = await adjust.mutateAsync({ account, actual: value });
      setActual('');
      Alert.alert(
        'Balance matched',
        !diff
          ? 'Fundly already had the right balance.'
          : diff > 0
            ? `Added ${formatINR(diff)} as Interest income.`
            : `Logged ${formatINR(-diff)} of untracked spends under Other.`,
      );
    } catch (e) {
      Alert.alert('Could not update', (e as Error).message);
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
          label={isCredit ? 'Starting amount owed' : 'Starting balance'}
          prefix="₹"
          placeholder="0"
          keyboardType="decimal-pad"
          value={opening}
          onChangeText={setOpening}
        />
        <AppText variant="caption" muted>
          {account
            ? 'What the account had when you added it. To fix today’s balance, use Balance check below instead.'
            : isCredit
              ? 'What you owe on the card today. Fundly tracks it from here.'
              : 'What the account has today. Fundly adds and subtracts every transaction from here.'}
        </AppText>
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
        {type !== 'cash' && (
          <Input
            label="SMS words for this account (optional)"
            placeholder="e.g. slice, nesfb"
            autoCapitalize="none"
            value={keywords}
            onChangeText={setKeywords}
            maxLength={80}
          />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">My main spending account</AppText>
            <AppText variant="caption" muted>
              Quick add and new entries use this account first.
            </AppText>
          </View>
          <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: colors.primary }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">Count in my total balance</AppText>
            <AppText variant="caption" muted>
              Turn off for savings you keep aside. Spends from it still show in your spends, but only reduce this account&apos;s balance.
            </AppText>
          </View>
          <Switch value={inTotal} onValueChange={setInTotal} trackColor={{ true: colors.primary }} />
        </View>
        <ColorPicker value={color} onChange={setColor} />
        {account && (
          <View style={{ gap: space.sm, padding: space.md, borderRadius: 16, backgroundColor: colors.surfaceAlt }}>
            <AppText variant="label">Balance check</AppText>
            <AppText variant="caption" muted>
              Fundly says {formatINR(account.balance)}. Type what your bank app shows and Fundly logs the difference: extra money as
              Interest, missing money as untracked spends.
            </AppText>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Input label="Real balance now" prefix="₹" placeholder="0" keyboardType="decimal-pad" value={actual} onChangeText={setActual} />
              </View>
              <Button3D title="Match" small onPress={onAdjust} disabled={parseAmount(actual) == null} loading={adjust.isPending} />
            </View>
          </View>
        )}
        {id && <Button3D title="Remove account" tone="ghost" onPress={onArchive} />}
      </Screen>
    </View>
  );
}
