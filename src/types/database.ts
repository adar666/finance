export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type CategoryType = 'income' | 'expense';
export type BudgetPeriod = 'monthly' | 'yearly';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type InvestmentType = 'stock' | 'etf' | 'crypto' | 'bond' | 'other';

export interface Profile {
  id: string;
  currency: string;
  locale: string;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  institution: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  /** Hebrew UI label when locale is Hebrew; optional */
  name_he?: string | null;
  type: CategoryType;
  icon: string;
  color: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  type: TransactionType;
  description: string;
  date: string;
  notes: string | null;
  transfer_to_account_id: string | null;
  recurring_rule_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  account?: Account;
  category?: Category;
  transfer_account?: Account;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  period: BudgetPeriod;
  start_date: string;
  created_at: string;
  // Joined
  category?: Category;
  spent?: number;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  type: InvestmentType;
  shares: number;
  cost_basis: number;
  current_price: number;
  price_updated_at: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

/** Used by optional auto-categorization rules (migration 006 not in this commit). */
export type RuleMatchType = 'contains' | 'starts_with' | 'exact';

export interface CategorizationRule {
  id: string;
  user_id: string;
  pattern: string;
  match_type: RuleMatchType;
  category_id: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  category?: Category;
}

export interface RecurringRule {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  type: TransactionType;
  description: string;
  frequency: RecurringFrequency;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  next_occurrence: string;
  is_active: boolean;
  created_at: string;
  // Joined
  account?: Account;
  category?: Category;
}
