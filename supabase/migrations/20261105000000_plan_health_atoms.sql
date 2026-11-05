-- Monthly plan, quick-add buttons, daily health checklist, and smarter SMS handling
-- (own-account transfers and slice "atoms").

-- ---------------------------------------------------------------- accounts
alter table public.accounts
  -- quick-add and SMS cards pick this account first
  add column is_default boolean not null default false,
  -- comma separated words that identify this account in SMS text/sender, e.g. "slice, nesfb"
  add column sms_keywords text;

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  add column monthly_income numeric(12, 2);

-- ---------------------------------------------------------------- SMS inbox
alter table public.sms_pending
  -- slice atom (savings pot) named in the SMS, and whether money went into or out of it
  add column atom text,
  add column atom_dir text check (atom_dir in ('in', 'out'));

-- ---------------------------------------------------------------- monthly plan
create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  grp text not null default 'misc'
    check (grp in ('fixed', 'saving', 'bills', 'travel', 'health', 'care', 'misc')),
  category_id uuid references public.categories (id) on delete set null,
  -- words that, found in a transaction note, count it towards this item (comma separated)
  match_text text,
  -- one-off monthly payments (EMIs, rent) show as a checklist instead of a spend bar
  is_checklist boolean not null default false,
  starts_on date not null default date_trunc('month', now())::date,
  ends_on date,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.plan_items (user_id);

-- manual ticks for checklist items, one row per item per month
create table public.plan_checks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.plan_items (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  primary key (item_id, month)
);

-- ---------------------------------------------------------------- quick add buttons
create table public.quick_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  emoji text not null default '⚡',
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.quick_templates (user_id);

-- ---------------------------------------------------------------- daily health checklist
create table public.health_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  done text[] not null default '{}',
  primary key (user_id, day)
);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['plan_items', 'plan_checks', 'quick_templates', 'health_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
