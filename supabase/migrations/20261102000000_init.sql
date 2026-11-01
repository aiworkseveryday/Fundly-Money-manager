-- Fundly initial schema. Every table is owned by a user and protected by RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  streak_count int not null default 0,
  longest_streak int not null default 0,
  last_logged_on date,
  xp int not null default 0,
  badges text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'upi', 'credit')),
  opening_balance numeric(12, 2) not null default 0,
  color text not null default '#58CC02',
  icon text not null default 'wallet',
  sms_last4 text check (sms_last4 ~ '^[0-9]{3,6}$'),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.accounts (user_id);

-- ---------------------------------------------------------------- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income')),
  icon text not null default 'tag',
  color text not null default '#1CB0F6',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);
create index on public.categories (user_id);

-- ---------------------------------------------------------------- transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- for transfers: the receiving account
  to_account_id uuid references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'sms', 'bill', 'goal')),
  sms_hash text,
  created_at timestamptz not null default now(),
  check (kind <> 'transfer' or to_account_id is not null),
  unique (user_id, sms_hash)
);
create index on public.transactions (user_id, occurred_at desc);
create index on public.transactions (account_id);

-- ---------------------------------------------------------------- budgets
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

-- ---------------------------------------------------------------- goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  emoji text not null default '🎯',
  target_amount numeric(12, 2) not null check (target_amount > 0),
  deadline date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  amount numeric(12, 2) not null check (amount <> 0),
  note text,
  contributed_at timestamptz not null default now()
);
create index on public.goal_contributions (goal_id);

-- ---------------------------------------------------------------- bills
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly', 'once')),
  next_due_date date not null,
  remind_days_before int not null default 2 check (remind_days_before between 0 and 30),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- SMS review inbox
create table public.sms_pending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sms_hash text not null,
  sender text,
  body text not null,
  kind text not null check (kind in ('expense', 'income')),
  amount numeric(12, 2) not null,
  merchant text,
  account_last4 text,
  occurred_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'ignored')),
  created_at timestamptz not null default now(),
  unique (user_id, sms_hash)
);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'budgets', 'goals',
                           'goal_contributions', 'bills', 'sms_pending'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------- new-user bootstrap
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));

  insert into public.accounts (user_id, name, type, color, icon)
  values (new.id, 'Cash', 'cash', '#58CC02', 'cash');

  insert into public.categories (user_id, name, kind, icon, color, sort_order) values
    (new.id, 'Food & Dining',  'expense', 'food',          '#FF9600', 1),
    (new.id, 'Groceries',      'expense', 'cart',          '#58CC02', 2),
    (new.id, 'Transport',      'expense', 'car',           '#1CB0F6', 3),
    (new.id, 'Shopping',       'expense', 'shopping',      '#CE82FF', 4),
    (new.id, 'Bills & Utilities','expense','flash',        '#FFC800', 5),
    (new.id, 'Rent',           'expense', 'home',          '#FF4B4B', 6),
    (new.id, 'Health',         'expense', 'medical-bag',   '#FF86D0', 7),
    (new.id, 'Entertainment',  'expense', 'movie-open',    '#2B70C9', 8),
    (new.id, 'Education',      'expense', 'school',        '#00CD9C', 9),
    (new.id, 'Other',          'expense', 'dots-horizontal','#AFAFAF', 10),
    (new.id, 'Salary',         'income',  'briefcase',     '#58CC02', 1),
    (new.id, 'Freelance',      'income',  'laptop',        '#1CB0F6', 2),
    (new.id, 'Gifts',          'income',  'gift',          '#CE82FF', 3),
    (new.id, 'Other Income',   'income',  'cash-plus',     '#AFAFAF', 4);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- views
create view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.opening_balance
    + coalesce(sum(case
        when t.kind = 'income' and t.account_id = a.id then t.amount
        when t.kind = 'expense' and t.account_id = a.id then -t.amount
        when t.kind = 'transfer' and t.account_id = a.id then -t.amount
        when t.kind = 'transfer' and t.to_account_id = a.id then t.amount
      end), 0) as balance
from public.accounts a
left join public.transactions t on t.account_id = a.id or t.to_account_id = a.id
group by a.id;

create view public.monthly_category_spend with (security_invoker = true) as
select
  t.user_id,
  date_trunc('month', t.occurred_at at time zone 'Asia/Kolkata')::date as month,
  t.kind,
  t.category_id,
  sum(t.amount) as total,
  count(*) as tx_count
from public.transactions t
where t.kind in ('expense', 'income')
group by 1, 2, 3, 4;

create view public.goal_progress with (security_invoker = true) as
select g.id as goal_id, g.user_id, coalesce(sum(c.amount), 0) as saved
from public.goals g
left join public.goal_contributions c on c.goal_id = g.id
group by g.id;
