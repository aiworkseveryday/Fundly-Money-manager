-- Savings accounts the user keeps aside can be left out of the "Total balance" on Home.
-- Their transactions still count as spends/income; they only change that account's own balance.
alter table public.accounts
  add column include_in_total boolean not null default true;
