import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { Header, ListRow } from '@/components/bits';
import { Screen } from '@/components/Screen';
import { ACCOUNT_TYPES } from '@/data/constants';
import { useAccounts } from '@/data/hooks';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Accounts() {
  const { colors } = useTheme();
  const accounts = useAccounts();
  const list = accounts.data ?? [];
  const assets = list.filter((a) => a.type !== 'credit').reduce((s, a) => s + a.balance, 0);
  const owed = list.filter((a) => a.type === 'credit').reduce((s, a) => s + a.balance, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Accounts" right={<Button3D title="Add" icon="plus" small onPress={() => router.push('/accounts/edit')} />} />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }}>
        <Card style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" muted upper>
              You have
            </AppText>
            <AppText variant="heading" color={colors.income}>
              {formatINR(assets)}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" muted upper>
              Card dues
            </AppText>
            <AppText variant="heading" color={owed < 0 ? colors.expense : colors.text}>
              {formatINR(Math.abs(Math.min(0, owed)))}
            </AppText>
          </View>
        </Card>
        <Card style={{ paddingVertical: space.sm }}>
          {list.map((a) => (
            <ListRow
              key={a.id}
              icon={a.icon}
              color={a.color}
              title={a.name}
              subtitle={[ACCOUNT_TYPES.find((t) => t.value === a.type)?.label, a.sms_last4 && `SMS ••${a.sms_last4}`].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/accounts/edit', params: { id: a.id } })}
              right={
                <AppText variant="label" color={a.balance < 0 ? colors.expense : colors.text}>
                  {formatINR(a.balance)}
                </AppText>
              }
            />
          ))}
        </Card>
        <AppText variant="caption" muted>
          Tip: add the last 4 digits of each bank account or card so Fundy can match bank SMS to the right account automatically.
        </AppText>
      </Screen>
    </View>
  );
}
