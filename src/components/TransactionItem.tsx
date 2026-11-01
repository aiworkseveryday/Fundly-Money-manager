import { router } from 'expo-router';

import type { TransactionRow } from '@/data/types';
import { formatDay, formatTime } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { ListRow } from './bits';

export function TransactionItem({ tx, accountNames }: { tx: TransactionRow; accountNames?: Map<string, string> }) {
  const { colors } = useTheme();
  const d = new Date(tx.occurred_at);

  const isTransfer = tx.kind === 'transfer';
  const title = isTransfer
    ? `${tx.account?.name ?? 'Account'} → ${accountNames?.get(tx.to_account_id ?? '') ?? 'Account'}`
    : tx.note || tx.category?.name || 'Uncategorised';
  const subtitle = [
    isTransfer ? 'Transfer' : tx.note ? tx.category?.name : null,
    tx.account && !isTransfer ? tx.account.name : null,
    `${formatDay(d)}, ${formatTime(d)}`,
    tx.source === 'sms' ? 'via SMS' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const color = tx.kind === 'income' ? colors.income : tx.kind === 'expense' ? colors.text : colors.info;
  const amount = tx.kind === 'income' ? formatINR(tx.amount, { signed: true }) : tx.kind === 'expense' ? formatINR(-tx.amount) : formatINR(tx.amount);

  return (
    <ListRow
      icon={isTransfer ? 'swap-horizontal' : (tx.category?.icon ?? 'help')}
      color={isTransfer ? colors.info : (tx.category?.color ?? colors.textMuted)}
      title={title}
      subtitle={subtitle}
      onPress={() => router.push({ pathname: '/transaction', params: { id: tx.id } })}
      right={
        <AppText variant="label" color={color}>
          {amount}
        </AppText>
      }
    />
  );
}
