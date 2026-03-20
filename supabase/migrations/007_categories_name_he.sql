-- Bilingual category labels: Hebrew for UI when locale is Hebrew (no translation API).

alter table public.categories
  add column if not exists name_he text;

comment on column public.categories.name_he is 'Hebrew display name; app falls back to name when null';

-- Default categories for new users (replaces 003 trigger body)
create or replace function public.seed_default_categories()
returns trigger as $$
begin
  insert into public.categories (user_id, name, name_he, type, icon, color, sort_order) values
    (new.id, 'Salary', 'משכורת', 'income', 'briefcase', '#10b981', 1),
    (new.id, 'Freelance', 'עבודה עצמאית', 'income', 'laptop', '#06b6d4', 2),
    (new.id, 'Investment Income', 'הכנסות מהשקעות', 'income', 'trending-up', '#8b5cf6', 3),
    (new.id, 'Gifts', 'מתנות', 'income', 'gift', '#f59e0b', 4),
    (new.id, 'Other Income', 'הכנסות אחרות', 'income', 'plus-circle', '#6b7280', 5);

  insert into public.categories (user_id, name, name_he, type, icon, color, sort_order) values
    (new.id, 'Rent / Mortgage', 'שכירות / משכנתא', 'expense', 'home', '#ef4444', 10),
    (new.id, 'Utilities', 'חשמל, מים וגז', 'expense', 'zap', '#f97316', 11),
    (new.id, 'Groceries', 'מצרכים', 'expense', 'shopping-cart', '#84cc16', 12),
    (new.id, 'Restaurants', 'מסעדות ובתי קפה', 'expense', 'utensils', '#f59e0b', 13),
    (new.id, 'Transportation', 'תחבורה', 'expense', 'car', '#3b82f6', 14),
    (new.id, 'Healthcare', 'בריאות', 'expense', 'heart-pulse', '#ec4899', 15),
    (new.id, 'Entertainment', 'בילויים', 'expense', 'tv', '#a855f7', 16),
    (new.id, 'Shopping', 'קניות', 'expense', 'shopping-bag', '#14b8a6', 17),
    (new.id, 'Subscriptions', 'מנויים', 'expense', 'repeat', '#6366f1', 18),
    (new.id, 'Insurance', 'ביטוח', 'expense', 'shield', '#64748b', 19),
    (new.id, 'Education', 'חינוך והשכלה', 'expense', 'book-open', '#0ea5e9', 20),
    (new.id, 'Savings', 'חיסכון', 'expense', 'piggy-bank', '#10b981', 21),
    (new.id, 'Loan Payments', 'החזרי הלוואות', 'expense', 'landmark', '#78716c', 22),
    (new.id, 'Other Expenses', 'הוצאות אחרות', 'expense', 'more-horizontal', '#6b7280', 23);

  return new;
end;
$$ language plpgsql security definer;

-- Backfill rows that still match the English seed names (idempotent for name_he is null)
update public.categories c
set name_he = v.he
from (
  values
    ('Salary', 'משכורת'),
    ('Freelance', 'עבודה עצמאית'),
    ('Investment Income', 'הכנסות מהשקעות'),
    ('Gifts', 'מתנות'),
    ('Other Income', 'הכנסות אחרות'),
    ('Rent / Mortgage', 'שכירות / משכנתא'),
    ('Utilities', 'חשמל, מים וגז'),
    ('Groceries', 'מצרכים'),
    ('Restaurants', 'מסעדות ובתי קפה'),
    ('Transportation', 'תחבורה'),
    ('Healthcare', 'בריאות'),
    ('Entertainment', 'בילויים'),
    ('Shopping', 'קניות'),
    ('Subscriptions', 'מנויים'),
    ('Insurance', 'ביטוח'),
    ('Education', 'חינוך והשכלה'),
    ('Savings', 'חיסכון'),
    ('Loan Payments', 'החזרי הלוואות'),
    ('Other Expenses', 'הוצאות אחרות'),
    ('[seed] · Budget monthly', 'תקציב חודשי (דמו)'),
    ('[seed] · Budget yearly', 'תקציב שנתי (דמו)')
) as v(en, he)
where c.name = v.en
  and (c.name_he is null or btrim(c.name_he) = '');
