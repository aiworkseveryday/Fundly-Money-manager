-- Loan tracker replaces the daily health checklist (Fundly stays about money).
drop table if exists public.health_logs;

-- ---------------------------------------------------------------- loans
-- A loan is tracked from the day it is added: `outstanding` is what is owed on `as_of`
-- (worked out from EMI + rate + months left, or typed from the lender's statement).
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  lender text,
  emi numeric(12, 2) not null check (emi > 0),
  annual_rate numeric(5, 2) not null check (annual_rate >= 0 and annual_rate < 100),
  outstanding numeric(12, 2) not null check (outstanding >= 0),
  as_of date not null default current_date,
  -- optional: the full tenure, so progress can be shown against the original loan
  total_months int check (total_months > 0),
  emi_day int not null default 5 check (emi_day between 1 and 31),
  account_id uuid references public.accounts (id) on delete set null,
  -- comma separated words that identify this loan's EMI SMS, e.g. "bajaj, loan a/c 1234"
  sms_match text,
  prepay_per_year int not null default 2 check (prepay_per_year between 0 and 12),
  color text not null default '#FF4B4B',
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.loans (user_id);

create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  loan_id uuid not null references public.loans (id) on delete cascade,
  kind text not null check (kind in ('emi', 'prepay')),
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.loan_payments (loan_id, paid_on);

do $$
declare t text;
begin
  foreach t in array array['loans', 'loan_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
