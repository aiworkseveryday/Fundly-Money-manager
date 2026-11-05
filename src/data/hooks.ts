import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addMonths, monthKey, toISODate } from '@/lib/dates';
import { num } from '@/lib/money';
import { supabase, unwrap } from '@/lib/supabase';
import { buildInbox } from '@/sms/transfers';
import type {
  Account,
  AccountWithBalance,
  Bill,
  Category,
  Goal,
  GoalWithProgress,
  Loan,
  LoanPayment,
  MonthlySpend,
  NewTransaction,
  PlanItem,
  Profile,
  QuickTemplate,
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
    // Only one account can be the default
    if (rest.is_default) unwrap(await supabase.from('accounts').update({ is_default: false }).eq('is_default', true));
    if (id) unwrap(await supabase.from('accounts').update(rest).eq('id', id));
    else unwrap(await supabase.from('accounts').insert(rest));
  });
}

/** The account quick-add and SMS cards start with: the marked default, else the first one. */
export function defaultAccount<T extends Account>(accounts: T[] | undefined): T | undefined {
  return accounts?.find((a) => a.is_default) ?? accounts?.[0];
}

/** Finds an account by name (case-insensitive) or creates it, e.g. the hidden "slice atoms" account. */
export async function ensureAccount(name: string, extra: Partial<Account>): Promise<string> {
  const found = unwrap(await supabase.from('accounts').select('id').ilike('name', name).eq('archived', false).limit(1)) as { id: string }[];
  if (found.length) return found[0].id;
  return (unwrap(await supabase.from('accounts').insert({ name, ...extra }).select('id').single()) as { id: string }).id;
}

/** Finds or creates an expense/income category by name. */
export async function ensureCategory(name: string, kind: 'expense' | 'income', icon: string, color: string): Promise<string> {
  const found = unwrap(await supabase.from('categories').select('id').ilike('name', name).eq('kind', kind).limit(1)) as { id: string }[];
  if (found.length) return found[0].id;
  return (unwrap(await supabase.from('categories').insert({ name, kind, icon, color, sort_order: 50 }).select('id').single()) as { id: string })
    .id;
}

/** Makes the account balance match the real one by logging the difference (interest earned, or spends that were missed). */
export function useAdjustBalance() {
  return useWrite(async ({ account, actual }: { account: AccountWithBalance; actual: number }) => {
    const diff = Math.round((actual - account.balance) * 100) / 100;
    if (!diff) return 0;
    const up = diff > 0;
    const categoryId = up
      ? await ensureCategory('Interest', 'income', 'chart-line', '#00CD9C')
      : await ensureCategory('Other', 'expense', 'dots-horizontal', '#AFAFAF');
    await insertTransaction({
      kind: up ? 'income' : 'expense',
      amount: Math.abs(diff),
      account_id: account.id,
      to_account_id: null,
      category_id: categoryId,
      note: up ? 'Balance check: interest / untracked money in' : 'Balance check: untracked spends',
      occurred_at: new Date().toISOString(),
    });
    return diff;
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

/** Number of inbox cards: a debit + credit pair about the same money counts once. */
export function usePendingCount() {
  const pending = usePendingSms();
  const accounts = useAccounts();
  return buildInbox(pending.data ?? [], accounts.data ?? []).length;
}

export function useSetSmsStatus() {
  return useWrite(async ({ id, status }: { id: string; status: SmsPending['status'] }) => {
    unwrap(await supabase.from('sms_pending').update({ status }).eq('id', id));
  });
}

// ---------------------------------------------------------------- monthly plan
export function usePlanItems() {
  return useQuery({
    queryKey: qk('plan-items'),
    queryFn: async () =>
      (unwrap(await supabase.from('plan_items').select('*').order('sort_order').order('created_at')) as PlanItem[]).map((p) => ({
        ...p,
        amount: num(p.amount),
      })),
  });
}

export function useSavePlanItem() {
  return useWrite(async (p: Partial<PlanItem> & Pick<PlanItem, 'name' | 'amount' | 'grp'>) => {
    const { id, ...rest } = p;
    if (id) unwrap(await supabase.from('plan_items').update(rest).eq('id', id));
    else unwrap(await supabase.from('plan_items').insert(rest));
  });
}

export function useDeletePlanItem() {
  return useWrite(async (id: string) => {
    unwrap(await supabase.from('plan_items').delete().eq('id', id));
  });
}

export function useInsertPlan() {
  return useWrite(async (rows: Omit<PlanItem, 'id'>[]) => {
    unwrap(await supabase.from('plan_items').insert(rows));
  });
}

export function usePlanChecks(month: Date) {
  const key = monthKey(month);
  return useQuery({
    queryKey: qk('plan-checks', key),
    queryFn: async () => new Set((unwrap(await supabase.from('plan_checks').select('item_id').eq('month', key)) as { item_id: string }[]).map((c) => c.item_id)),
  });
}

export function useTogglePlanCheck() {
  return useWrite(async ({ itemId, month, checked }: { itemId: string; month: Date; checked: boolean }) => {
    const key = monthKey(month);
    if (checked) unwrap(await supabase.from('plan_checks').upsert({ item_id: itemId, month: key }, { onConflict: 'item_id,month', ignoreDuplicates: true }));
    else unwrap(await supabase.from('plan_checks').delete().eq('item_id', itemId).eq('month', key));
  });
}

// ---------------------------------------------------------------- quick add buttons
export function useQuickTemplates() {
  return useQuery({
    queryKey: qk('quick-templates'),
    queryFn: async () =>
      (unwrap(await supabase.from('quick_templates').select('*').order('sort_order').order('created_at')) as QuickTemplate[]).map((q) => ({
        ...q,
        amount: num(q.amount),
      })),
  });
}

export function useSaveQuickTemplate() {
  return useWrite(async (q: Partial<QuickTemplate> & Pick<QuickTemplate, 'label' | 'amount'>) => {
    const { id, ...rest } = q;
    if (id) unwrap(await supabase.from('quick_templates').update(rest).eq('id', id));
    else unwrap(await supabase.from('quick_templates').insert(rest));
  });
}

export function useDeleteQuickTemplate() {
  return useWrite(async (id: string) => {
    unwrap(await supabase.from('quick_templates').delete().eq('id', id));
  });
}


// ---------------------------------------------------------------- loans
export function useLoans() {
  return useQuery({
    queryKey: qk('loans'),
    queryFn: async () =>
      (unwrap(await supabase.from('loans').select('*').is('closed_at', null).order('created_at')) as Loan[]).map((l) => ({
        ...l,
        emi: num(l.emi),
        annual_rate: num(l.annual_rate),
        outstanding: num(l.outstanding),
      })),
  });
}

export function useLoanPayments() {
  return useQuery({
    queryKey: qk('loan-payments'),
    queryFn: async () =>
      (unwrap(await supabase.from('loan_payments').select('*').order('paid_on')) as LoanPayment[]).map((p) => ({ ...p, amount: num(p.amount) })),
  });
}

export function useSaveLoan() {
  return useWrite(async (l: Partial<Loan> & Pick<Loan, 'name' | 'emi' | 'annual_rate' | 'outstanding'>) => {
    const { id, ...rest } = l;
    if (id) unwrap(await supabase.from('loans').update(rest).eq('id', id));
    else unwrap(await supabase.from('loans').insert(rest));
  });
}

export function useCloseLoan() {
  return useWrite(async (id: string) => {
    unwrap(await supabase.from('loans').update({ closed_at: new Date().toISOString() }).eq('id', id));
  });
}

/**
 * Records an EMI or prepayment against a loan. Unless it came from an SMS that already created the
 * spend, it also logs the money leaving the paying account so balances and the plan stay right.
 */
export async function recordLoanPayment(args: {
  loan: Loan;
  kind: LoanPayment['kind'];
  amount: number;
  paidOn: Date;
  accountId: string | null | undefined;
  transactionId?: string | null;
}) {
  let transactionId = args.transactionId ?? null;
  // The bank SMS for an EMI already ticked by hand this month: keep one payment and one spend, the SMS one
  if (transactionId && args.kind === 'emi') {
    const from = toISODate(new Date(args.paidOn.getFullYear(), args.paidOn.getMonth(), 1));
    const to = toISODate(new Date(args.paidOn.getFullYear(), args.paidOn.getMonth() + 1, 1));
    const [ticked] = unwrap(
      await supabase.from('loan_payments').select('*').eq('loan_id', args.loan.id).eq('kind', 'emi').gte('paid_on', from).lt('paid_on', to).limit(1),
    ) as LoanPayment[];
    if (ticked) {
      unwrap(await supabase.from('loan_payments').update({ transaction_id: transactionId, amount: args.amount }).eq('id', ticked.id));
      if (ticked.transaction_id) unwrap(await supabase.from('transactions').delete().eq('id', ticked.transaction_id).neq('source', 'sms'));
      return;
    }
  }
  if (!transactionId && args.accountId) {
    const categoryId = await ensureCategory('EMI & Loans', 'expense', 'bank-transfer', '#FF4B4B');
    const tx = await insertTransaction({
      kind: 'expense',
      amount: args.amount,
      account_id: args.accountId,
      to_account_id: null,
      category_id: categoryId,
      note: `${args.loan.name} ${args.kind === 'emi' ? 'EMI' : 'prepayment'}`,
      occurred_at: args.paidOn.toISOString(),
    });
    transactionId = tx.id;
  }
  unwrap(
    await supabase.from('loan_payments').insert({
      loan_id: args.loan.id,
      kind: args.kind,
      amount: args.amount,
      paid_on: toISODate(args.paidOn),
      transaction_id: transactionId,
    }),
  );
}

export function useRecordLoanPayment() {
  return useWrite(recordLoanPayment);
}

export function useDeleteLoanPayment() {
  return useWrite(async (p: LoanPayment) => {
    unwrap(await supabase.from('loan_payments').delete().eq('id', p.id));
    // the spend goes too, unless it came from a bank SMS (that money really left the account)
    if (p.transaction_id) unwrap(await supabase.from('transactions').delete().eq('id', p.transaction_id).neq('source', 'sms'));
  });
}
