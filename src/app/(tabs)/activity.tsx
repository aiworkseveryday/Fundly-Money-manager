import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Chip, ChipRow } from '@/components/Chip';
import { EmptyState } from '@/components/bits';
import { Input } from '@/components/Input';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { TransactionItem } from '@/components/TransactionItem';
import { useAccounts, useInvalidate, useTransactions } from '@/data/hooks';
import type { TransactionRow, TxKind } from '@/data/types';
import { addMonths, formatDay, startOfMonth, toISODate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

type Item = { type: 'header'; key: string; label: string; net: number } | { type: 'tx'; key: string; tx: TransactionRow };

export default function Activity() {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [kind, setKind] = useState<TxKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const [accountId, setAccountId] = useState<string | undefined>();

  const accounts = useAccounts();
  const txs = useTransactions({ from: month, to: addMonths(month, 1), accountId });
  const accountNames = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));

  const q = search.trim().toLowerCase();
  const filtered = (txs.data ?? []).filter(
    (t) =>
      (kind === 'all' || t.kind === kind) &&
      (!q || [t.note, t.category?.name, t.account?.name].some((s) => s?.toLowerCase().includes(q)) || String(t.amount).includes(q)),
  );

  const items: Item[] = [];
  let currentDay = '';
  for (const t of filtered) {
    const d = new Date(t.occurred_at);
    const key = toISODate(d);
    if (key !== currentDay) {
      currentDay = key;
      items.push({ type: 'header', key: `h-${key}`, label: formatDay(d), net: 0 });
    }
    const header = items.findLast((i) => i.type === 'header') as Extract<Item, { type: 'header' }>;
    if (t.kind === 'income') header.net += t.amount;
    if (t.kind === 'expense') header.net -= t.amount;
    items.push({ type: 'tx', key: t.id, tx: t });
  }

  const spent = filtered.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  const earned = filtered.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={txs.isRefetching} onRefresh={invalidate} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            <AppText variant="title">Activity</AppText>
            <MonthSwitcher month={month} onChange={setMonth} />
            <View style={styles.summary}>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" muted upper>
                  Spent
                </AppText>
                <AppText variant="heading" color={colors.expense}>
                  {formatINR(spent)}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="caption" muted upper>
                  Earned
                </AppText>
                <AppText variant="heading" color={colors.income}>
                  {formatINR(earned)}
                </AppText>
              </View>
            </View>
            <Input placeholder="Search notes, categories, amounts" value={search} onChangeText={setSearch} />
            <ChipRow>
              {(['all', 'expense', 'income', 'transfer'] as const).map((k) => (
                <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </ChipRow>
            {(accounts.data?.length ?? 0) > 1 && (
              <ChipRow>
                <Chip label="All accounts" selected={!accountId} onPress={() => setAccountId(undefined)} />
                {accounts.data!.map((a) => (
                  <Chip key={a.id} label={a.name} color={a.color} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
                ))}
              </ChipRow>
            )}
          </View>
        }
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <View style={[styles.dayHeader, { borderBottomColor: colors.border }]}>
              <AppText variant="caption" muted upper>
                {item.label}
              </AppText>
              <AppText variant="caption" color={item.net >= 0 ? colors.income : colors.textMuted}>
                {formatINR(item.net, { signed: true })}
              </AppText>
            </View>
          ) : (
            <TransactionItem tx={item.tx} accountNames={accountNames} />
          )
        }
        ListEmptyComponent={
          txs.isLoading ? undefined : (
            <EmptyState title={q || kind !== 'all' ? 'Nothing matches' : 'No transactions yet'} subtitle="Logged transactions show up here." />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 120 },
  summary: { flexDirection: 'row', gap: space.md },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.lg,
    paddingBottom: 6,
    borderBottomWidth: 2,
    marginBottom: 4,
  },
});
