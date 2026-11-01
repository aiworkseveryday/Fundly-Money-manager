import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { EmptyState, Header } from '@/components/bits';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { insertTransaction, useAccounts, useCategories, useInvalidate, usePendingSms, useSetSmsStatus } from '@/data/hooks';
import type { AccountWithBalance, Category, SmsPending } from '@/data/types';
import { useReward } from '@/gamification/Celebrations';
import { formatDay, formatTime } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { guessCategory } from '@/sms/categorize';
import { hasSmsPermission, requestSmsPermission, smsSupported, syncSms } from '@/sms/sync';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

function SmsCard({ sms, accounts, categories }: { sms: SmsPending; accounts: AccountWithBalance[]; categories: Category[] }) {
  const { colors } = useTheme();
  const reward = useReward();
  const invalidate = useInvalidate();
  const setStatus = useSetSmsStatus();
  const matched = accounts.find((a) => sms.account_last4 && a.sms_last4 && a.sms_last4.endsWith(sms.account_last4.slice(-4)));
  const [accountId, setAccountId] = useState(matched?.id ?? accounts.find((a) => a.type !== 'cash')?.id ?? accounts[0]?.id);
  const [categoryId, setCategoryId] = useState(() => guessCategory(`${sms.merchant ?? ''} ${sms.body}`, sms.kind, categories));
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const cats = categories.filter((c) => c.kind === sms.kind);
  const d = new Date(sms.occurred_at);

  const accept = async () => {
    if (!accountId || !categoryId) return;
    setBusy(true);
    try {
      await insertTransaction({
        kind: sms.kind,
        amount: sms.amount,
        account_id: accountId,
        to_account_id: null,
        category_id: categoryId,
        note: sms.merchant,
        occurred_at: sms.occurred_at,
        source: 'sms',
        sms_hash: sms.sms_hash,
      });
      // Remember the card/account digits so future SMS match automatically
      const acct = accounts.find((a) => a.id === accountId);
      if (acct && !acct.sms_last4 && sms.account_last4 && acct.type !== 'cash') {
        await supabase.from('accounts').update({ sms_last4: sms.account_last4 }).eq('id', acct.id);
      }
      await setStatus.mutateAsync({ id: sms.id, status: 'accepted' });
      reward('sms_review');
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('duplicate')) {
        await setStatus.mutateAsync({ id: sms.id, status: 'accepted' });
      } else Alert.alert('Could not add', msg);
    } finally {
      setBusy(false);
      invalidate();
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" numberOfLines={1}>
            {sms.merchant ?? (sms.kind === 'income' ? 'Money received' : 'Payment')}
          </AppText>
          <AppText variant="caption" muted>
            {sms.sender} · {formatDay(d)}, {formatTime(d)}
            {sms.account_last4 ? ` · ••${sms.account_last4}` : ''}
          </AppText>
        </View>
        <AppText variant="title" color={sms.kind === 'income' ? colors.income : colors.expense}>
          {sms.kind === 'income' ? '+' : '-'}
          {formatINR(sms.amount)}
        </AppText>
      </View>

      <Pressable onPress={() => setExpanded((e) => !e)}>
        <AppText variant="caption" muted numberOfLines={expanded ? undefined : 2} style={[styles.body, { backgroundColor: colors.surfaceAlt }]}>
          {sms.body}
        </AppText>
      </Pressable>

      <ChipRow>
        {cats.map((c) => (
          <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ChipRow>
      {accounts.length > 1 && (
        <ChipRow>
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} color={a.color} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
          ))}
        </ChipRow>
      )}

      <View style={styles.actions}>
        <Button3D title="Ignore" tone="outline" small style={{ flex: 1 }} onPress={() => setStatus.mutate({ id: sms.id, status: 'ignored' })} />
        <Button3D title="Add" icon="check" small style={{ flex: 2 }} onPress={accept} disabled={!categoryId || !accountId} loading={busy} />
      </View>
    </Card>
  );
}

export default function SmsInbox() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const pending = usePendingSms();
  const accounts = useAccounts().data ?? [];
  const categories = useCategories().data ?? [];
  const [permission, setPermission] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      await syncSms();
      invalidate();
    } catch (e) {
      Alert.alert('SMS sync failed', (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    hasSmsPermission().then(setPermission);
  }, []);

  const grant = async () => {
    const ok = await requestSmsPermission();
    setPermission(ok);
    if (ok) sync();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="SMS inbox" />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }} refreshing={syncing} onRefresh={permission ? sync : undefined}>
        {!smsSupported ? (
          <EmptyState title="SMS reading needs Android" subtitle="This feature works in the Android build of Fundly." />
        ) : permission === false ? (
          <Card style={{ alignItems: 'center', gap: space.md }}>
            <Mascot size={100} />
            <AppText variant="heading" center>
              Let Fundy read bank SMS
            </AppText>
            <AppText muted center>
              Bank and UPI alerts become ready-made transactions. You review each one before it is saved, and SMS from personal numbers are
              skipped.
            </AppText>
            <Button3D title="Allow SMS access" icon="message-lock" onPress={grant} style={{ alignSelf: 'stretch' }} />
          </Card>
        ) : (
          <>
            {(pending.data ?? []).map((s) => (
              <SmsCard key={s.id} sms={s} accounts={accounts} categories={categories} />
            ))}
            {!pending.data?.length && !pending.isLoading && (
              <EmptyState
                title="Inbox zero!"
                subtitle="No new bank SMS to review. Pull down to check again."
                mood="happy"
                action={<Button3D title="Scan now" tone="outline" onPress={sync} loading={syncing} />}
              />
            )}
          </>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  body: { padding: space.sm, borderRadius: 10, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: space.sm },
});
