import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { supabase, unwrap } from './supabase';
import { toISODate, formatTime } from './dates';

type ExportRow = {
  occurred_at: string;
  kind: string;
  amount: string | number;
  note: string | null;
  source: string;
  category: { name: string } | null;
  account: { name: string } | null;
  to_account: { name: string } | null;
};

export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}

/** Exports all transactions to a CSV file and opens the share sheet. Returns the row count. */
export async function exportTransactionsCsv(): Promise<number> {
  const data = unwrap(
    await supabase
      .from('transactions')
      .select(
        'occurred_at, kind, amount, note, source, category:categories(name), account:accounts!transactions_account_id_fkey(name), to_account:accounts!transactions_to_account_id_fkey(name)',
      )
      .order('occurred_at', { ascending: false }),
  ) as unknown as ExportRow[];

  const rows = [
    ['Date', 'Time', 'Type', 'Amount (INR)', 'Category', 'Account', 'To Account', 'Note', 'Source'],
    ...data.map((t) => {
      const d = new Date(t.occurred_at);
      return [
        toISODate(d),
        formatTime(d),
        t.kind,
        Number(t.amount).toFixed(2),
        t.category?.name ?? '',
        t.account?.name ?? '',
        t.to_account?.name ?? '',
        t.note ?? '',
        t.source,
      ];
    }),
  ];

  const file = new File(Paths.cache, `fundly-transactions-${toISODate(new Date())}.csv`);
  if (file.exists) file.delete();
  file.create();
  // BOM so Excel opens the ₹ symbol and Indian names correctly
  await file.write('﻿' + toCsv(rows));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export Fundly transactions', UTI: 'public.comma-separated-values-text' });
  }
  return data.length;
}
