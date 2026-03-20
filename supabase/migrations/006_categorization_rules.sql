-- Categorization Rules: auto-assign categories to imported transactions by pattern matching
create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  pattern text not null,
  match_type text not null default 'contains'
    check (match_type in ('contains', 'starts_with', 'exact')),
  category_id uuid references public.categories(id) on delete cascade not null,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_cat_rules_user on public.categorization_rules(user_id);

-- RLS
alter table public.categorization_rules enable row level security;

create policy "Users can view own categorization rules" on public.categorization_rules
  for select using (auth.uid() = user_id);
create policy "Users can create own categorization rules" on public.categorization_rules
  for insert with check (auth.uid() = user_id);
create policy "Users can update own categorization rules" on public.categorization_rules
  for update using (auth.uid() = user_id);
create policy "Users can delete own categorization rules" on public.categorization_rules
  for delete using (auth.uid() = user_id);
