import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addMonths, monthKey, toISODate } from '@/lib/dates';
import { num } from '@/lib/money';
import { supabase, unwrap } from '@/lib/supabase';
import type {
  Account,
  AccountWithBalance,
  Bill,
  Budget,
  Category,
  Goal,
  GoalWithProgress,
  MonthlySpend,
  NewTransaction,
  Profile,
  SmsPending,
  Transaction,
  TransactionRow,
} from './types';

// Every query lives under this root so a single invalidation refreshes the app after a write.
const ROOT = 'fundly';
export const qk = (...parts: unknown[]) => [ROOT, ...parts];

export function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [ROOT] });
}

/** Mutation that refreshes all Fundly queries when it succeeds. */
function useWrite<TArgs, TResult = unknown>(fn: (args: TArgs) => Promise<TResult>) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate() });
}

// ---------------------------------------------------------------- profile
export function useProfile() {
  return useQuery({
    queryKey: qk('profile'),
    queryFn: async () => unwrap(await supabase.from('profiles').select('*').single()) as Profile,
  });
}

export function useUpdateProfile() {
  return useWrite(async (patch: Partial<Profile> & { id: string }) => {
    const { id, ...rest } = patch;
    unwrap(await supabase.from('profiles').update(rest).eq('id', id));
  });
}

// ---------------------------------------------------------------- accounts
export function useAccounts() {
  return useQuery({
    queryKey: qk('accounts'),
    queryFn: async (): Promise<AccountWithBalance[]> => {
      const [accounts, balances] = await Promise.all([
        supabase.from('accounts').select('*').eq('archived', false).order('created_at'),
        supabase.from('account_balances').select('account_id, balance'),
      ]);
      const byId = new Map((unwrap(balances) as { account_id: string; balance: string }[]).map((b) => [b.account_id, num(b.balance)]));
      return (unwrap(accounts) as Account[]).map((a) => ({
        ...a,
        opening_balance: num(a.opening_balance),
        balance: byId.get(a.id) ?? num(a.opening_balance),
      }));
    },
  });
}

export function useSaveAccount() {
  return useWrite(async (a: Partial<Account> & Pick<Account, 'name' | 'type'>) => {
    const { id, ...rest } = a;
    if (id) unwrap(await supabase.from('accounts').update(rest).eq('id', id));
    else unwrap(await supabase.from('accounts').insert(rest));
  });
}

export function useArchiveAccount() {
  return useWrite(async (id: string) => {
    unwrap(await supabase.from('accounts').update({ archived: true }).eq('id', id));
  });
}

// ---------------------------------------------------------------- categories
export function useCategories() {
  return useQuery({
    queryKey: qk('categories'),
    queryFn: async () =>
      unwrap(await supabase.from('categories').select('*').order('kind').order('sort_order')) as Category[],
  });
}

export function useSaveCategory() {
  return useWrite(async (c: Partial<Category> & Pick<Category, 'name' | 'kind'>) => {
    const { id, ...rest } = c;
    if (id) unwrap(await supabase.from('categories').update(rest).eq('id', id));
    else unwrap(await supabase.from('categories').insert(rest));
  });
}

export function useDeleteCategory() {
  return useWrite(async (id: string) => {
    unwrap(await supabase.from('categories').delete().eq('id', id));
  });
}

// ---------------------------------------------------------------- transactions
const TX_SELECT =
  '*, category:categories(id, name, icon, color), account:accounts!transactions_account_id_fkey(id, name, color)';

function normaliseTx<T extends Transaction>(t: T): T {
  return { ...t, amount: num(t.amount) };
}

type TxFilter = { from?: Date; to?: Date; accountId?: string; categoryId?: string; limit?: number };

export function useTransactions(filter: TxFilter = {}) {
  return useQuery({
    queryKey: qk('transactions', filter.from?.toISOString(), filter.to?.toISOString(), filter.accountId, filter.categoryId, filter.limit),
    queryFn: async () => {
      let q = supabase.from('transactions').select(TX_SELECT).order('occurred_at', { ascending: false });
      if (filter.from) q = q.gte('occurred_at', filter.from.toISOString());
      if (filter.to) q = q.lt('occurred_at', filter.to.toISOString());
      if (filter.accountId) q = q.or(`account_id.eq.${filter.accountId},to_account_id.eq.${filter.accountId}`);
      if (filter.categoryId) q = q.eq('category_id', filter.categoryId);
      q = q.limit(filter.limit ?? 1000);
      return (unwrap(await q) as TransactionRow[]).map(normaliseTx);
    },
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: qk('transaction', id),
    enabled: !!id,
    queryFn: async () => normaliseTx(unwrap(await supabase.from('transactions').select('*').eq('id', id!).single()) as Transaction),
  });
}

export async function insertTransaction(tx: NewTransaction) {
  return unwrap(await supabase.from('transactions').insert(tx).select('*').single()) as Transaction;
}

export function useSaveTransaction() {
  return useWrite(async (tx: NewTransaction & { id?: string }) => {
    const { id, ...rest } = tx;
    if (id) {
      unwrap(await supabase.from('transactions').update(rest).eq('id', id));
      return null;
    }
    return insertTransaction(rest);
  });
}

export function useDeleteTransaction() {
  return useWrite(async (id: string) => {
    unwrap(await supabase.from('transactions').delete().eq('id', id));
  });
}

// ---------------------------------------------------------------- monthly aggregates
export function useMonthlySpend(months = 6) {
  return useQuery({
    queryKey: qk('monthly', months),
    queryFn: async () => {
      const since = monthKey(addMonths(new Date(), -(months - 1)));
      const rows = unwrap(
        await supabase.from('monthly_category_spend').select('month, kind, category_id, total, tx_count').gte('month', since),
      ) as MonthlySpend[];
      return rows.map((r) => ({ ...r, total: num(r.total) }));
    },
  });
}

// ---------------------------------------------------------------- budgets
export function useBudgets(month: Date) {
  const key = monthKey(month);
  return useQuery({
    queryKey: qk('budgets', key),
    queryFn: async () =>
      (unwrap(await supabase.from('budgets').select('*').eq('month', key)) as Budget[]).map((b) => ({ ...b, amount: num(b.amount) })),
  });
}

export function useSetBudget() {
  return useWrite(async ({ categoryId, month, amount }: { categoryId: string; month: Date; amount: number | null }) => {
    const key = monthKey(month);
    if (amount == null) {
      unwrap(await supabase.from('budgets').delete().eq('category_id', categoryId).eq('month', key));
    } else {
      unwrap(
        await supabase
          .from('budgets')
          .upsert({ category_id: categoryId, month: key, amount }, { onConflict: 'user_id,category_id,month' }),
      );
    }
  });
}

/** Copies last month's budgets into this month (skipping ones already set). */
export function useCopyBudgets() {
  return useWrite(async (month: Date) => {
    const prev = unwrap(await supabase.from('budgets').select('category_id, amount').eq('month', monthKey(addMonths(month, -1)))) as Budget[];
    if (!prev.length) return 0;
    unwrap(
      await supabase.from('budgets').upsert(
        prev.map((b) => ({ category_id: b.category_id, amount: b.amount, month: monthKey(month) })),
        { onConflict: 'user_id,category_id,month', ignoreDuplicates: true },
      ),
    );
    return prev.length;
  });
}

// ---------------------------------------------------------------- goals
export function useGoals() {
  return useQuery({
    queryKey: qk('goals'),
    queryFn: async (): Promise<GoalWithProgress[]> => {
      const [goals, progress] = await Promise.all([
        supabase.from('goals').select('*').order('created_at'),
        supabase.from('goal_progress').select('goal_id, saved'),
      ]);
      const saved = new Map((unwrap(progress) as { goal_id: string; saved: string }[]).map((p) => [p.goal_id, num(p.saved)]));
      return (unwrap(goals) as Goal[]).map((g) => ({ ...g, target_amount: num(g.target_amount), saved: saved.get(g.id) ?? 0 }));
    },
  });
}

export function useSaveGoal() {
  return useWrite(async (g: Partial<Goal> & Pick<Goal, 'name' | 'target_amount'>) => {
    const { id, ...rest } = g;
    if (id) unwrap(await supabase.from('goals').update(rest).eq('id', id));
    else unwrap(await supabase.from('goals').insert(rest));
  });
}

export function useDeleteGoal() {
  return useWrite(async (id: string) => {
    unwrap(await supabase.from('goals').delete().eq('id', id));
  });
}

export function useGoalContributions(goalId: string | undefined) {
  return useQuery({
    queryKey: qk('goal-contributions', goalId),
    enabled: !!goalId,
    queryFn: async () =>
      (
        unwrap(
          await supabase.from('goal_contributions').select('*').eq('goal_id', goalId!).order('contributed_at', { ascending: false }),
        ) as { id: string; amount: string; note: string | null; contributed_at: string }[]
      ).map((c) => ({ ...c, amount: num(c.amount) })),
  });
}

export function useContribute() {
  return useWrite(async ({ goalId, amount, note }: { goalId: string; amount: number; note?: string }) => {
    unwrap(await supabase.from('goal_contributions').insert({ goal_id: goalId, amount, note: note || null }));
  });
}

// ---------------------------------------------------------------- bills
export function useBills() {
  return useQuery({
    queryKey: qk('bills'),
    queryFn: async () =>
      (unwrap(await supabase.from('bills').select('*').order('next_due_date')) as Bill[]).map((b) => ({ ...b, amount: num(b.amount) })),
  });
}

export function useSaveBill() {
  return useWrite(async (b: Partial<Bill> & Pick<Bill, 'name' | 'amount' | 'next_due_date'>) => {
    const { id, ...rest } = b;
    if (id) unwrap(await supabase.from('bills').update(rest).eq('id', id));
    else unwrap(await supabase.from('bills').insert(rest));
  });
}

export function useDeleteBill() {
  return useWrite(async (id: string) => {
    unwrap(await supabase.from('bills').delete().eq('id', id));
  });
}

export function nextDueDate(bill: Pick<Bill, 'frequency' | 'next_due_date'>): string | null {
  const [y, m, d] = bill.next_due_date.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  switch (bill.frequency) {
    case 'weekly':
      due.setDate(due.getDate() + 7);
      return toISODate(due);
    case 'monthly':
      return toISODate(addMonths(due, 1));
    case 'yearly':
      return toISODate(addMonths(due, 12));
    case 'once':
      return null;
  }
}

// ---------------------------------------------------------------- SMS inbox
export function usePendingSms() {
  return useQuery({
    queryKey: qk('sms-pending'),
    queryFn: async () =>
      (
        unwrap(await supabase.from('sms_pending').select('*').eq('status', 'pending').order('occurred_at', { ascending: false })) as SmsPending[]
      ).map((s) => ({ ...s, amount: num(s.amount) })),
  });
}

export function useSetSmsStatus() {
  return useWrite(async ({ id, status }: { id: string; status: SmsPending['status'] }) => {
    unwrap(await supabase.from('sms_pending').update({ status }).eq('id', id));
  });
}
