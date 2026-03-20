-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  currency text not null default 'ILS',
  locale text not null default 'en-US',
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit', 'investment', 'cash')),
  balance numeric(15,2) not null default 0,
  institution text,
  color text not null default '#3b82f6',
  icon text not null default 'wallet',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_accounts_user on public.accounts(user_id);

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text not null default 'tag',
  color text not null default '#6b7280',
  parent_id uuid references public.categories(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_categories_user on public.categories(user_id);

-- Transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(15,2) not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  description text not null default '',
  date date not null default current_date,
  notes text,
  transfer_to_account_id uuid references public.accounts(id) on delete set null,
  recurring_rule_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_transactions_user on public.transactions(user_id);
create index idx_transactions_account on public.transactions(account_id);
create index idx_transactions_date on public.transactions(user_id, date desc);
create index idx_transactions_category on public.transactions(category_id);

-- Budgets
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  amount numeric(15,2) not null,
  period text not null default 'monthly' check (period in ('monthly', 'yearly')),
  start_date date not null default date_trunc('month', current_date)::date,
  created_at timestamptz not null default now()
);

create index idx_budgets_user on public.budgets(user_id);

-- Savings Goals
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  target_amount numeric(15,2) not null,
  current_amount numeric(15,2) not null default 0,
  target_date date,
  icon text not null default 'target',
  color text not null default '#10b981',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_savings_goals_user on public.savings_goals(user_id);

-- Investments
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  symbol text not null,
  name text not null,
  type text not null default 'stock' check (type in ('stock', 'etf', 'crypto', 'bond', 'other')),
  shares numeric(15,6) not null default 0,
  cost_basis numeric(15,2) not null default 0,
  current_price numeric(15,2) not null default 0,
  price_updated_at timestamptz,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_investments_user on public.investments(user_id);

-- Recurring Rules
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(15,2) not null,
  type text not null check (type in ('income', 'expense')),
  description text not null default '',
  frequency text not null default 'monthly' check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  day_of_month integer check (day_of_month >= 1 and day_of_month <= 31),
  start_date date not null default current_date,
  end_date date,
  next_occurrence date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_recurring_rules_user on public.recurring_rules(user_id);

-- Updated_at trigger function
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();
create trigger update_accounts_updated_at before update on public.accounts
  for each row execute procedure public.update_updated_at();
create trigger update_transactions_updated_at before update on public.transactions
  for each row execute procedure public.update_updated_at();
create trigger update_savings_goals_updated_at before update on public.savings_goals
  for each row execute procedure public.update_updated_at();
create trigger update_investments_updated_at before update on public.investments
  for each row execute procedure public.update_updated_at();
