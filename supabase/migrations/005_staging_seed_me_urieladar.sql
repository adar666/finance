-- Staging / demo data for me@urieladar.com — full coverage for UI testing.
-- Idempotent: removes previous seed rows (same markers), then re-inserts.
--
-- Markers:
--   transactions.notes = '__seed_v2__'
--   accounts / savings_goals / investments.name LIKE '[seed] %'
--   recurring_rules.description LIKE '[seed] %'
--   budgets → only on categories named LIKE '[seed] %'
--   extra categories LIKE '[seed] · %' (budget anchors)
--
-- Prerequisites: user has signed up once (auth.users + profiles + default categories from 003).
-- Requires migration 004 (balance triggers on transactions).
--
-- If this migration already ran on a remote DB and you only changed this file, run the whole
-- `do $$ ... $$` block in Supabase SQL Editor to refresh (migrations are not re-applied by version).

do $$
declare
  uid uuid;
  acc_checking uuid;
  acc_savings uuid;
  acc_credit uuid;
  acc_investment uuid;
  acc_cash uuid;
  cat_budget_m uuid;
  cat_budget_y uuid;
begin
  select id into uid
  from auth.users
  where lower(email) = lower('me@urieladar.com')
  limit 1;

  if uid is null then
    raise notice '005_staging_seed: skipped — no auth.users row for me@urieladar.com (sign up on staging first).';
    return;
  end if;

  insert into public.profiles (id)
  values (uid)
  on conflict (id) do nothing;

  -- ── Idempotent teardown (FK-safe order) ─────────────────────────────────
  delete from public.transactions
  where user_id = uid and notes in ('__seed_v1__', '__seed_v2__');

  delete from public.recurring_rules
  where user_id = uid and description like '[seed] %';

  delete from public.budgets
  where user_id = uid
    and category_id in (
      select id from public.categories where user_id = uid and name like '[seed] %'
    );

  delete from public.savings_goals
  where user_id = uid and name like '[seed] %';

  delete from public.investments
  where user_id = uid and name like '[seed] %';

  delete from public.accounts
  where user_id = uid and name like '[seed] %';

  delete from public.categories
  where user_id = uid and name like '[seed] %';

  -- ── Seed-only categories (budgets attach here so we never delete user real budgets) ──
  insert into public.categories (user_id, name, type, icon, color, sort_order) values
    (uid, '[seed] · Budget monthly', 'expense', 'target', '#6366f1', 900),
    (uid, '[seed] · Budget yearly', 'expense', 'calendar', '#0ea5e9', 901);

  select id into cat_budget_m from public.categories
  where user_id = uid and name = '[seed] · Budget monthly' limit 1;
  select id into cat_budget_y from public.categories
  where user_id = uid and name = '[seed] · Budget yearly' limit 1;

  -- ── Accounts: one per type (checking, savings, credit, investment, cash) ──
  insert into public.accounts (user_id, name, type, balance, institution, color, icon) values
    (uid, '[seed] Main checking', 'checking', 0, 'Demo Bank', '#3b82f6', 'wallet'),
    (uid, '[seed] Emergency savings', 'savings', 0, 'Demo Bank', '#10b981', 'piggy-bank'),
    (uid, '[seed] Credit card', 'credit', 0, 'Demo Card', '#8b5cf6', 'credit-card'),
    (uid, '[seed] Brokerage cash', 'investment', 0, 'Demo Invest', '#f59e0b', 'trending-up'),
    (uid, '[seed] Cash wallet', 'cash', 0, 'Petty cash', '#84cc16', 'banknote');

  select id into acc_checking from public.accounts where user_id = uid and name = '[seed] Main checking';
  select id into acc_savings from public.accounts where user_id = uid and name = '[seed] Emergency savings';
  select id into acc_credit from public.accounts where user_id = uid and name = '[seed] Credit card';
  select id into acc_investment from public.accounts where user_id = uid and name = '[seed] Brokerage cash';
  select id into acc_cash from public.accounts where user_id = uid and name = '[seed] Cash wallet';

  -- ── Default categories sanity (from 003 trigger) ──────────────────────────
  if not exists (
    select 1 from public.categories c
    where c.user_id = uid and c.name = 'Salary' and c.type = 'income'
  ) then
    raise exception '005_staging_seed: default categories missing — profile/003 seed_categories not applied for this user.';
  end if;

  -- ── Income: one demo tx per default income category (dates in last ~60d) ─
  -- (Cannot alias a column "desc" — reserved in PostgreSQL.)
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, v.amount, 'income', v.txn_label, v.d::date, '__seed_v2__'
  from public.categories c
  cross join lateral (values
    ('Salary', 18500::numeric, 'Demo · Salary', (current_date - interval '3 day')),
    ('Freelance', 3200::numeric, 'Demo · Freelance', (current_date - interval '18 day')),
    ('Investment Income', 410::numeric, 'Demo · Dividend', (current_date - interval '11 day')),
    ('Gifts', 200::numeric, 'Demo · Gift', (current_date - interval '25 day')),
    ('Other Income', 85::numeric, 'Demo · Misc income', (current_date - interval '7 day'))
  ) as v(cat_name, amount, txn_label, d)
  where c.user_id = uid and c.type = 'income' and c.name = v.cat_name;

  -- ── Expense: demo txs covering every default expense category (003) ───────
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, 4800, 'expense', 'Demo · Rent', (current_date - 5), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Rent / Mortgage';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, 340, 'expense', 'Demo · Electric + water', (current_date - 6), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Utilities';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, 412, 'expense', 'Demo · Groceries', (current_date - 2), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Groceries';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, 128, 'expense', 'Demo · Groceries (2)', (current_date - 14), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Groceries';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_credit, c.id, 96, 'expense', 'Demo · Lunch', (current_date - 1), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Restaurants';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_credit, c.id, 45.9, 'expense', 'Demo · Transit', (current_date - 4), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Transportation';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, 220, 'expense', 'Demo · Pharmacy', (current_date - 20), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Healthcare';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_credit, c.id, 64, 'expense', 'Demo · Streaming + cinema', (current_date - 9), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Entertainment';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_credit, c.id, 189, 'expense', 'Demo · Clothing', (current_date - 12), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Shopping';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, 59, 'expense', 'Demo · Apps', (current_date - 8), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Subscriptions';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, 275, 'expense', 'Demo · Insurance', (current_date - 10), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Insurance';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, 120, 'expense', 'Demo · Course', (current_date - 22), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Education';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, 500, 'expense', 'Demo · Scheduled savings', (current_date - 15), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Savings';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_checking, c.id, 890, 'expense', 'Demo · Loan', (current_date - 5), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Loan Payments';
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_cash, c.id, 33, 'expense', 'Demo · Miscellaneous', (current_date - 3), '__seed_v2__' from public.categories c where c.user_id = uid and c.name = 'Other Expenses';

  -- ── Transfers (checking → savings, cash, brokerage) ───────────────────────
  insert into public.transactions (
    user_id, account_id, category_id, amount, type, description, date, notes, transfer_to_account_id
  ) values
    (uid, acc_checking, null, 800, 'transfer', 'Demo · To savings', (current_date - interval '4 day')::date, '__seed_v2__', acc_savings),
    (uid, acc_checking, null, 120, 'transfer', 'Demo · ATM to wallet', (current_date - interval '16 day')::date, '__seed_v2__', acc_cash),
    (uid, acc_checking, null, 2500, 'transfer', 'Demo · Fund brokerage', (current_date - interval '9 day')::date, '__seed_v2__', acc_investment);

  -- Use brokerage for one expense (investment account in use)
  insert into public.transactions (user_id, account_id, category_id, amount, type, description, date, notes)
  select uid, acc_investment, c.id, 9.99, 'expense', 'Demo · Trading fee', (current_date - 8), '__seed_v2__'
  from public.categories c where c.user_id = uid and c.name = 'Other Expenses';

  -- ── Budgets: monthly + yearly (on seed-only categories) ─────────────────
  insert into public.budgets (user_id, category_id, amount, period, start_date) values
    (uid, cat_budget_m, 800, 'monthly', date_trunc('month', current_date)::date),
    (uid, cat_budget_y, 4800, 'yearly', date_trunc('year', current_date)::date);

  -- ── Savings goals ─────────────────────────────────────────────────────────
  insert into public.savings_goals (user_id, name, target_amount, current_amount, target_date, icon, color) values
    (uid, '[seed] Vacation', 12000, 2100, (current_date + interval '8 months')::date, 'plane', '#0ea5e9'),
    (uid, '[seed] New laptop', 4500, 800, (current_date + interval '4 months')::date, 'laptop', '#a855f7');

  -- ── Investments: all types ───────────────────────────────────────────────
  insert into public.investments (
    user_id, symbol, name, type, shares, cost_basis, current_price, currency
  ) values
    (uid, 'AAPL', '[seed] Apple Inc.', 'stock', 4, 620, 198.5, 'USD'),
    (uid, 'VTI', '[seed] Vanguard Total Stock ETF', 'etf', 12.5, 3250, 285.4, 'USD'),
    (uid, 'BTC', '[seed] Bitcoin (demo)', 'crypto', 0.015, 900, 61200, 'USD'),
    (uid, 'BND', '[seed] US Bond ETF', 'bond', 20, 1600, 74.2, 'USD'),
    (uid, 'PRIVATE', '[seed] Private allocation', 'other', 1, 5000, 5000, 'USD');

  -- ── Recurring rules: monthly income + sample frequencies ─────────────────
  insert into public.recurring_rules (
    user_id, account_id, category_id, amount, type, description, frequency, day_of_month, start_date, next_occurrence, is_active
  )
  select uid, acc_checking, c.id, 18500, 'income', '[seed] Monthly salary', 'monthly', 1,
    date_trunc('month', current_date)::date,
    (date_trunc('month', current_date) + interval '1 month')::date,
    true
  from public.categories c
  where c.user_id = uid and c.type = 'income' and c.name = 'Salary'
  limit 1;

  insert into public.recurring_rules (
    user_id, account_id, category_id, amount, type, description, frequency, day_of_month, start_date, next_occurrence, is_active
  ) values
    (uid, acc_checking, cat_budget_m, 12, 'expense', '[seed] Daily coffee (demo)', 'daily', null, current_date - 30, current_date, true),
    (uid, acc_credit, cat_budget_m, 80, 'expense', '[seed] Weekly groceries top-up', 'weekly', null, current_date - 14, current_date + 3, true),
    (uid, acc_checking, cat_budget_y, 1200, 'expense', '[seed] Yearly software', 'yearly', null, date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '1 year')::date, true);

  -- ── Planning (Financial planning → Recurring / projections chart) ─────────
  -- Extra rules with start_date in the past so they apply to the next 12 months in the UI.
  insert into public.recurring_rules (
    user_id, account_id, category_id, amount, type, description, frequency, day_of_month, start_date, next_occurrence, is_active
  )
  select uid, acc_checking, c.id, 4200, 'expense', '[seed] Planning · Rent', 'monthly', 1,
    (current_date - interval '12 month')::date,
    date_trunc('month', current_date)::date,
    true
  from public.categories c
  where c.user_id = uid and c.type = 'expense' and c.name = 'Rent / Mortgage'
  limit 1;

  insert into public.recurring_rules (
    user_id, account_id, category_id, amount, type, description, frequency, day_of_month, start_date, next_occurrence, is_active
  )
  select uid, acc_checking, c.id, 2800, 'income', '[seed] Planning · Consulting', 'monthly', 15,
    (current_date - interval '8 month')::date,
    (date_trunc('month', current_date) + interval '14 day')::date,
    true
  from public.categories c
  where c.user_id = uid and c.type = 'income' and c.name = 'Freelance'
  limit 1;

  insert into public.recurring_rules (
    user_id, account_id, category_id, amount, type, description, frequency, day_of_month, start_date, next_occurrence, is_active
  )
  select uid, acc_credit, c.id, 89, 'expense', '[seed] Planning · Subscriptions', 'monthly', 5,
    (current_date - interval '6 month')::date,
    (date_trunc('month', current_date) + interval '4 day')::date,
    true
  from public.categories c
  where c.user_id = uid and c.type = 'expense' and c.name = 'Subscriptions'
  limit 1;

  insert into public.recurring_rules (
    user_id, account_id, category_id, amount, type, description, frequency, day_of_month, start_date, next_occurrence, is_active
  )
  select uid, acc_checking, c.id, 120, 'expense', '[seed] Planning · Weekly therapy', 'weekly', null,
    (current_date - interval '3 month')::date,
    current_date + 2,
    true
  from public.categories c
  where c.user_id = uid and c.type = 'expense' and c.name = 'Healthcare'
  limit 1;

  insert into public.recurring_rules (
    user_id, account_id, category_id, amount, type, description, frequency, day_of_month, start_date, next_occurrence, is_active
  )
  select uid, acc_savings, c.id, 2400, 'expense', '[seed] Planning · Annual insurance', 'yearly', null,
    (current_date - interval '18 month')::date,
    (date_trunc('year', current_date) + interval '6 month')::date,
    true
  from public.categories c
  where c.user_id = uid and c.type = 'expense' and c.name = 'Insurance'
  limit 1;

  insert into public.recurring_rules (
    user_id, account_id, category_id, amount, type, description, frequency, day_of_month, start_date, next_occurrence, is_active
  )
  select uid, acc_checking, c.id, 45, 'expense', '[seed] Planning · Commute pass', 'daily', null,
    (current_date - interval '2 month')::date,
    current_date,
    true
  from public.categories c
  where c.user_id = uid and c.type = 'expense' and c.name = 'Transportation'
  limit 1;

  raise notice '005_staging_seed: applied demo data for me@urieladar.com (transactions tagged __seed_v2__).';
end;
$$;
