-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.investments enable row level security;
alter table public.recurring_rules enable row level security;

-- Profiles: users can only read/update their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Accounts
create policy "Users can view own accounts" on public.accounts
  for select using (auth.uid() = user_id);
create policy "Users can create own accounts" on public.accounts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own accounts" on public.accounts
  for update using (auth.uid() = user_id);
create policy "Users can delete own accounts" on public.accounts
  for delete using (auth.uid() = user_id);

-- Categories
create policy "Users can view own categories" on public.categories
  for select using (auth.uid() = user_id);
create policy "Users can create own categories" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "Users can update own categories" on public.categories
  for update using (auth.uid() = user_id);
create policy "Users can delete own categories" on public.categories
  for delete using (auth.uid() = user_id);

-- Transactions
create policy "Users can view own transactions" on public.transactions
  for select using (auth.uid() = user_id);
create policy "Users can create own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions" on public.transactions
  for update using (auth.uid() = user_id);
create policy "Users can delete own transactions" on public.transactions
  for delete using (auth.uid() = user_id);

-- Budgets
create policy "Users can view own budgets" on public.budgets
  for select using (auth.uid() = user_id);
create policy "Users can create own budgets" on public.budgets
  for insert with check (auth.uid() = user_id);
create policy "Users can update own budgets" on public.budgets
  for update using (auth.uid() = user_id);
create policy "Users can delete own budgets" on public.budgets
  for delete using (auth.uid() = user_id);

-- Savings Goals
create policy "Users can view own savings goals" on public.savings_goals
  for select using (auth.uid() = user_id);
create policy "Users can create own savings goals" on public.savings_goals
  for insert with check (auth.uid() = user_id);
create policy "Users can update own savings goals" on public.savings_goals
  for update using (auth.uid() = user_id);
create policy "Users can delete own savings goals" on public.savings_goals
  for delete using (auth.uid() = user_id);

-- Investments
create policy "Users can view own investments" on public.investments
  for select using (auth.uid() = user_id);
create policy "Users can create own investments" on public.investments
  for insert with check (auth.uid() = user_id);
create policy "Users can update own investments" on public.investments
  for update using (auth.uid() = user_id);
create policy "Users can delete own investments" on public.investments
  for delete using (auth.uid() = user_id);

-- Recurring Rules
create policy "Users can view own recurring rules" on public.recurring_rules
  for select using (auth.uid() = user_id);
create policy "Users can create own recurring rules" on public.recurring_rules
  for insert with check (auth.uid() = user_id);
create policy "Users can update own recurring rules" on public.recurring_rules
  for update using (auth.uid() = user_id);
create policy "Users can delete own recurring rules" on public.recurring_rules
  for delete using (auth.uid() = user_id);
