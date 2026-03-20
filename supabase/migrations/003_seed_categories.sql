-- This function seeds default categories for new users
-- Called by the profile creation trigger
create or replace function public.seed_default_categories()
returns trigger as $$
begin
  -- Income categories
  insert into public.categories (user_id, name, type, icon, color, sort_order) values
    (new.id, 'Salary', 'income', 'briefcase', '#10b981', 1),
    (new.id, 'Freelance', 'income', 'laptop', '#06b6d4', 2),
    (new.id, 'Investment Income', 'income', 'trending-up', '#8b5cf6', 3),
    (new.id, 'Gifts', 'income', 'gift', '#f59e0b', 4),
    (new.id, 'Other Income', 'income', 'plus-circle', '#6b7280', 5);

  -- Expense categories
  insert into public.categories (user_id, name, type, icon, color, sort_order) values
    (new.id, 'Rent / Mortgage', 'expense', 'home', '#ef4444', 10),
    (new.id, 'Utilities', 'expense', 'zap', '#f97316', 11),
    (new.id, 'Groceries', 'expense', 'shopping-cart', '#84cc16', 12),
    (new.id, 'Restaurants', 'expense', 'utensils', '#f59e0b', 13),
    (new.id, 'Transportation', 'expense', 'car', '#3b82f6', 14),
    (new.id, 'Healthcare', 'expense', 'heart-pulse', '#ec4899', 15),
    (new.id, 'Entertainment', 'expense', 'tv', '#a855f7', 16),
    (new.id, 'Shopping', 'expense', 'shopping-bag', '#14b8a6', 17),
    (new.id, 'Subscriptions', 'expense', 'repeat', '#6366f1', 18),
    (new.id, 'Insurance', 'expense', 'shield', '#64748b', 19),
    (new.id, 'Education', 'expense', 'book-open', '#0ea5e9', 20),
    (new.id, 'Savings', 'expense', 'piggy-bank', '#10b981', 21),
    (new.id, 'Loan Payments', 'expense', 'landmark', '#78716c', 22),
    (new.id, 'Other Expenses', 'expense', 'more-horizontal', '#6b7280', 23);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created_seed_categories
  after insert on public.profiles
  for each row execute procedure public.seed_default_categories();
