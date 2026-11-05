export type AccountType = 'cash' | 'bank' | 'upi' | 'credit';
export type TxKind = 'expense' | 'income' | 'transfer';
export type CategoryKind = 'expense' | 'income';
export type BillFrequency = 'weekly' | 'monthly' | 'yearly' | 'once';

export type Profile = {
  id: string;
  display_name: string | null;
  streak_count: number;
  longest_streak: number;
  last_logged_on: string | null;
  xp: number;
  badges: string[];
  monthly_income: number | null;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  opening_balance: number;
  color: string;
  icon: string;
  sms_last4: string | null;
  /** false = savings kept aside: not counted in the Home total balance */
  include_in_total: boolean;
  /** quick-add and SMS cards pick this account first */
  is_default: boolean;
  /** comma separated words that identify this account in SMS, e.g. "slice, nesfb" */
  sms_keywords: string | null;
  archived: boolean;
  created_at: string;
};

export type AccountWithBalance = Account & { balance: number };

export type Category = {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  sort_order: number;
};

export type Transaction = {
  id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  kind: TxKind;
  amount: number;
  note: string | null;
  occurred_at: string;
  source: 'manual' | 'sms' | 'bill' | 'goal';
  sms_hash: string | null;
};

export type TransactionRow = Transaction & {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
  account: Pick<Account, 'id' | 'name' | 'color'> | null;
};

export type NewTransaction = Omit<Transaction, 'id' | 'source' | 'sms_hash'> & {
  source?: Transaction['source'];
  sms_hash?: string | null;
};

export type Goal = {
  id: string;
  name: string;
  emoji: string;
  target_amount: number;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
};
export type GoalWithProgress = Goal & { saved: number };

export type Bill = {
  id: string;
  name: string;
  amount: number;
  category_id: string | null;
  account_id: string | null;
  frequency: BillFrequency;
  next_due_date: string;
  remind_days_before: number;
  active: boolean;
};

export type SmsPending = {
  id: string;
  sms_hash: string;
  sender: string | null;
  body: string;
  kind: 'expense' | 'income';
  amount: number;
  merchant: string | null;
  account_last4: string | null;
  /** slice atom (savings pot) named in the SMS */
  atom: string | null;
  atom_dir: 'in' | 'out' | null;
  occurred_at: string;
  status: 'pending' | 'accepted' | 'ignored';
};

export type MonthlySpend = {
  month: string;
  kind: CategoryKind;
  category_id: string | null;
  total: number;
  tx_count: number;
};

export type PlanGroup = 'fixed' | 'saving' | 'bills' | 'travel' | 'health' | 'care' | 'misc';

export type PlanItem = {
  id: string;
  name: string;
  amount: number;
  grp: PlanGroup;
  category_id: string | null;
  match_text: string | null;
  is_checklist: boolean;
  starts_on: string;
  ends_on: string | null;
  sort_order: number;
};

export type QuickTemplate = {
  id: string;
  label: string;
  emoji: string;
  amount: number;
  category_id: string | null;
  account_id: string | null;
  sort_order: number;
};

export type Loan = {
  id: string;
  name: string;
  lender: string | null;
  emi: number;
  annual_rate: number;
  outstanding: number;
  as_of: string;
  total_months: number | null;
  emi_day: number;
  account_id: string | null;
  sms_match: string | null;
  prepay_per_year: number;
  color: string;
  closed_at: string | null;
};

export type LoanPayment = {
  id: string;
  loan_id: string;
  kind: 'emi' | 'prepay';
  amount: number;
  paid_on: string;
  transaction_id: string | null;
};
