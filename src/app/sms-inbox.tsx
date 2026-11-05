import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { EmptyState, Header, Segmented } from '@/components/bits';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import {
  defaultAccount,
  ensureAccount,
  ensureCategory,
  insertTransaction,
  recordLoanPayment,
  useAccounts,
  useCategories,
  useInvalidate,
  useLoans,
  usePendingSms,
} from '@/data/hooks';
import type { AccountWithBalance, Category, Loan } from '@/data/types';
import { useReward } from '@/gamification/Celebrations';
import { formatDay, formatTime } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { supabase, unwrap } from '@/lib/supabase';
import { guessCategory } from '@/sms/categorize';
import { hasSmsPermission, requestSmsPermission, smsSupported, syncSms } from '@/sms/sync';
import { accountKeywords, ATOMS, ATOMS_ACCOUNT_NAME, buildInbox, ownAccount, type InboxItem } from '@/sms/transfers';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, space } from '@/theme/tokens';

type Kind = InboxItem['kind'];

/** Remembers how an SMS identified the account (card digits, sender code) so the next one matches by itself. */
async function learnAccount(acct: AccountWithBalance | undefined, last4: string | null, sender: string | null) {
  if (!acct || acct.type === 'cash' || acct.id === ATOMS) return;
  const patch: Record<string, string> = {};
  if (!acct.sms_last4 && last4) patch.sms_last4 = last4;
  // "JD-IDFCFB-S" -> "idfcfb"
  const code = /[A-Z]{5,}/.exec((sender ?? '').toUpperCase())?.[0]?.toLowerCase();
  if (code && !ownAccount({ account_last4: null, sender }, [acct])) {
    patch.sms_keywords = [...accountKeywords(acct), code].join(', ');
  }
  if (Object.keys(patch).length) await supabase.from('accounts').update(patch).eq('id', acct.id);
}

/** Adds (or takes out) atom money on the goal with the same name, creating the goal the first time. */
async function recordAtom(name: string, amount: number, dir: 'in' | 'out') {
  const found = unwrap(await supabase.from('goals').select('id').ilike('name', name).limit(1)) as { id: string }[];
  const goalId = found.length
    ? found[0].id
    : (
        unwrap(
          await supabase
            .from('goals')
            .insert({ name, emoji: '⚛️', target_amount: Math.max(amount, 1000) })
            .select('id')
            .single(),
        ) as { id: string }
      ).id;
  unwrap(await supabase.from('goal_contributions').insert({ goal_id: goalId, amount: dir === 'in' ? amount : -amount, note: 'slice atom' }));
}

function SmsCard({ item, accounts, categories, loans }: { item: InboxItem; accounts: AccountWithBalance[]; categories: Category[]; loans: Loan[] }) {
  const { colors } = useTheme();
  const reward = useReward();
  const invalidate = useInvalidate();
  const first = item.rows[0];
  const fallback = defaultAccount(accounts.filter((a) => a.type !== 'cash'))?.id ?? accounts[0]?.id;

  const [kind, setKind] = useState<Kind>(item.kind);
  const [accountId, setAccountId] = useState(item.accountId ?? fallback);
  const [fromId, setFromId] = useState(item.fromId ?? fallback);
  const [toId, setToId] = useState(item.toId);
  const [categoryId, setCategoryId] = useState(() =>
    item.kind === 'transfer' ? null : guessCategory(`${first.merchant ?? ''} ${first.body}`, item.kind, categories),
  );
  const [loanId, setLoanId] = useState<string | null>(item.loanId ?? null);
  const loan = kind === 'expense' ? loans.find((l) => l.id === loanId) : undefined;
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const cats = categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));
  const atomsAccount = accounts.find((a) => a.name.toLowerCase() === ATOMS_ACCOUNT_NAME);
  // Transfers can also go to/from the atoms pot before that account exists
  const transferChoices = [
    ...accounts.map((a) => ({ id: a.id, name: a.name, color: a.color })),
    ...(atomsAccount ? [] : [{ id: ATOMS, name: 'slice atoms', color: palette.purple }]),
  ];
  const d = new Date(item.occurred_at);
  // an EMI doesn't need a category: it goes under "EMI & Loans"
  const canAdd = kind === 'transfer' ? !!fromId && !!toId && fromId !== toId : !!accountId && (!!categoryId || !!loan);

  const setAll = async (status: 'accepted' | 'ignored') => {
    unwrap(
      await supabase
        .from('sms_pending')
        .update({ status })
        .in(
          'id',
          item.rows.map((r) => r.id),
        ),
    );
  };

  const accept = async () => {
    if (!canAdd) return;
    setBusy(true);
    try {
      const resolve = async (id: string | undefined) =>
        id === ATOMS ? ensureAccount(ATOMS_ACCOUNT_NAME, { type: 'bank', include_in_total: false, color: palette.purple, icon: 'atom' }) : id!;
      if (kind === 'transfer') {
        const [from, to] = [await resolve(fromId), await resolve(toId)];
        await insertTransaction({
          kind: 'transfer',
          amount: item.amount,
          account_id: from,
          to_account_id: to,
          category_id: null,
          note: item.atom ? `${item.atom.dir === 'in' ? 'Into' : 'Out of'} atom: ${item.atom.name}` : null,
          occurred_at: item.occurred_at,
          source: 'sms',
          sms_hash: first.sms_hash,
        });
        if (item.atom) await recordAtom(item.atom.name, item.amount, item.atom.dir);
        for (const r of item.rows) {
          const end = r.kind === 'expense' ? fromId : toId;
          if (!r.atom)
            await learnAccount(
              accounts.find((a) => a.id === end),
              r.account_last4,
              r.sender,
            );
        }
      } else {
        const tx = await insertTransaction({
          kind,
          amount: item.amount,
          account_id: accountId!,
          to_account_id: null,
          category_id: loan ? await ensureCategory('EMI & Loans', 'expense', 'bank-transfer', '#FF4B4B') : categoryId,
          note: loan ? `${loan.name} EMI` : first.merchant,
          occurred_at: item.occurred_at,
          source: 'sms',
          sms_hash: first.sms_hash,
        });
        // ticks the loan's EMI for the month; the spend above is the payment itself
        if (loan)
          await recordLoanPayment({ loan, kind: 'emi', amount: item.amount, paidOn: new Date(item.occurred_at), accountId, transactionId: tx.id });
        await learnAccount(
          accounts.find((a) => a.id === accountId),
          first.account_last4,
          first.sender,
        );
      }
      await setAll('accepted');
      reward('sms_review');
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('duplicate')) await setAll('accepted');
      else Alert.alert('Could not add', msg);
    } finally {
      setBusy(false);
      invalidate();
    }
  };

  const ignore = async () => {
    await setAll('ignored');
    invalidate();
  };

  const title =
    kind === 'transfer'
      ? item.atom
        ? `${item.atom.dir === 'in' ? 'Into' : 'Out of'} atom “${item.atom.name}”`
        : 'Transfer between your accounts'
      : loan
        ? `${loan.name} EMI`
        : (first.merchant ?? (kind === 'income' ? 'Money received' : 'Payment'));
  const amountColor = kind === 'income' ? colors.income : kind === 'expense' ? colors.expense : colors.info;

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" numberOfLines={2}>
            {title}
          </AppText>
          <AppText variant="caption" muted>
            {item.rows.map((r) => r.sender).join(' + ')} · {formatDay(d)}, {formatTime(d)}
          </AppText>
        </View>
        <AppText variant="title" color={amountColor}>
          {kind === 'income' ? '+' : kind === 'expense' ? '-' : ''}
          {formatINR(item.amount)}
        </AppText>
      </View>

      {item.rows.length > 1 && (
        <AppText variant="caption" color={colors.info}>
          2 messages about the same money, merged into one transfer so it isn&apos;t counted twice.
        </AppText>
      )}

      <Pressable onPress={() => setExpanded((e) => !e)} style={{ gap: space.xs }}>
        {item.rows.map((r) => (
          <AppText
            key={r.id}
            variant="caption"
            muted
            numberOfLines={expanded ? undefined : 2}
            style={[styles.body, { backgroundColor: colors.surfaceAlt }]}>
            {r.body}
          </AppText>
        ))}
      </Pressable>

      <Segmented
        value={kind}
        onChange={(k) => {
          setKind(k);
          if (k !== 'transfer') setCategoryId(guessCategory(`${first.merchant ?? ''} ${first.body}`, k, categories));
        }}
        options={[
          { value: 'expense', label: 'Spend', color: colors.expense },
          { value: 'income', label: 'Income', color: colors.income },
          { value: 'transfer', label: 'Transfer', color: colors.info },
        ]}
      />

      {kind === 'transfer' ? (
        <>
          <AppText variant="caption" muted upper>
            From
          </AppText>
          <ChipRow>
            {transferChoices.map((a) => (
              <Chip key={a.id} label={a.name} color={a.color} selected={fromId === a.id} onPress={() => setFromId(a.id)} />
            ))}
          </ChipRow>
          <AppText variant="caption" muted upper>
            To
          </AppText>
          <ChipRow>
            {transferChoices
              .filter((a) => a.id !== fromId)
              .map((a) => (
                <Chip key={a.id} label={a.name} color={a.color} selected={toId === a.id} onPress={() => setToId(a.id)} />
              ))}
          </ChipRow>
        </>
      ) : (
        <>
          {kind === 'expense' && !!loans.length && (
            <>
              <AppText variant="caption" muted upper>
                Is this a loan EMI?
              </AppText>
              <ChipRow>
                <Chip label="No" selected={!loanId} onPress={() => setLoanId(null)} />
                {loans.map((l) => (
                  <Chip key={l.id} label={`${l.name} EMI`} icon="bank" color={l.color} selected={loanId === l.id} onPress={() => setLoanId(l.id)} />
                ))}
              </ChipRow>
            </>
          )}
          {!loan && (
            <ChipRow>
              {cats.map((c) => (
                <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
            </ChipRow>
          )}
          {accounts.length > 1 && (
            <ChipRow>
              {accounts.map((a) => (
                <Chip key={a.id} label={a.name} color={a.color} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
              ))}
            </ChipRow>
          )}
        </>
      )}

      <View style={styles.actions}>
        <Button3D title="Ignore" tone="outline" small style={{ flex: 1 }} onPress={ignore} />
        <Button3D title="Add" icon="check" small style={{ flex: 2 }} onPress={accept} disabled={!canAdd} loading={busy} />
      </View>
    </Card>
  );
}

export default function SmsInbox() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const pending = usePendingSms();
  const accountsQuery = useAccounts();
  const loans = useLoans().data ?? [];
  const accounts = accountsQuery.data ?? [];
  const categories = useCategories().data ?? [];
  const [permission, setPermission] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  // Cards pick their starting accounts once, so wait for the account list
  const items = accountsQuery.data ? buildInbox(pending.data ?? [], accounts, loans) : [];

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
              Bank and UPI alerts become ready-made transactions. You review each one before it is saved, and SMS from personal numbers are skipped.
            </AppText>
            <Button3D title="Allow SMS access" icon="message-lock" onPress={grant} style={{ alignSelf: 'stretch' }} />
          </Card>
        ) : (
          <>
            {items.map((it) => (
              <SmsCard key={it.key + (it.loanId ?? '')} item={it} accounts={accounts} categories={categories} loans={loans} />
            ))}
            {!items.length && !pending.isLoading && (
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
