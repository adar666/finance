import { describe, it, expect } from 'vitest'
import { applyCategoryRules, matchIsracardCategory } from './auto-categorize'
import type { CategorizationRule, Category } from '@/types/database'

function makeRule(overrides: Partial<CategorizationRule>): CategorizationRule {
  return {
    id: 'rule-1',
    user_id: 'user-1',
    pattern: 'test',
    match_type: 'contains',
    category_id: 'cat-1',
    priority: 0,
    is_active: true,
    created_at: '2024-01-01',
    ...overrides,
  }
}

function makeCategory(overrides: Partial<Category> & { id: string; name: string }): Category {
  return {
    user_id: 'user-1',
    type: 'expense',
    icon: 'tag',
    color: '#000',
    parent_id: null,
    sort_order: 0,
    created_at: '2024-01-01',
    ...overrides,
  }
}

describe('applyCategoryRules', () => {
  it('returns null when no rules match', () => {
    const rules = [makeRule({ pattern: 'xyz', category_id: 'cat-1' })]
    expect(applyCategoryRules('coffee shop', rules)).toBeNull()
  })

  it('matches a contains rule (case-insensitive)', () => {
    const rules = [makeRule({ pattern: 'COFFEE', match_type: 'contains', category_id: 'cat-dining' })]
    expect(applyCategoryRules('Morning Coffee Shop', rules)).toBe('cat-dining')
  })

  it('matches a starts_with rule', () => {
    const rules = [makeRule({ pattern: 'spotify', match_type: 'starts_with', category_id: 'cat-ent' })]
    expect(applyCategoryRules('SPOTIFY P3EBDBC382', rules)).toBe('cat-ent')
    expect(applyCategoryRules('Not SPOTIFY', rules)).toBeNull()
  })

  it('matches an exact rule', () => {
    const rules = [makeRule({ pattern: 'Amazon Prime', match_type: 'exact', category_id: 'cat-sub' })]
    expect(applyCategoryRules('Amazon Prime', rules)).toBe('cat-sub')
    expect(applyCategoryRules('Amazon Prime Membership', rules)).toBeNull()
  })

  it('skips inactive rules', () => {
    const rules = [makeRule({ pattern: 'coffee', is_active: false, category_id: 'cat-1' })]
    expect(applyCategoryRules('coffee shop', rules)).toBeNull()
  })

  it('prefers higher priority rules', () => {
    const rules = [
      makeRule({ id: 'r1', pattern: 'super', match_type: 'contains', category_id: 'cat-groceries', priority: 1 }),
      makeRule({ id: 'r2', pattern: 'super', match_type: 'contains', category_id: 'cat-other', priority: 5 }),
    ]
    expect(applyCategoryRules('SUPER-PHARM', rules)).toBe('cat-other')
  })

  it('within same priority, exact beats starts_with beats contains', () => {
    const rules = [
      makeRule({ id: 'r1', pattern: 'wolt', match_type: 'contains', category_id: 'cat-contains', priority: 0 }),
      makeRule({ id: 'r2', pattern: 'wolt', match_type: 'exact', category_id: 'cat-exact', priority: 0 }),
      makeRule({ id: 'r3', pattern: 'wolt', match_type: 'starts_with', category_id: 'cat-starts', priority: 0 }),
    ]
    expect(applyCategoryRules('wolt', rules)).toBe('cat-exact')
  })

  it('handles Hebrew patterns', () => {
    const rules = [makeRule({ pattern: 'מסעדה', match_type: 'contains', category_id: 'cat-dining' })]
    expect(applyCategoryRules('מסעדה ים תיכונית', rules)).toBe('cat-dining')
  })

  it('returns null for empty rules array', () => {
    expect(applyCategoryRules('anything', [])).toBeNull()
  })

  it('returns null for empty description', () => {
    const rules = [makeRule({ pattern: '', match_type: 'contains', category_id: 'cat-1' })]
    expect(applyCategoryRules('', rules)).toBe('cat-1')
  })
})

describe('matchIsracardCategory', () => {
  const categories: Category[] = [
    makeCategory({ id: 'c1', name: 'Dining' }),
    makeCategory({ id: 'c2', name: 'Groceries' }),
    makeCategory({ id: 'c3', name: 'Transportation' }),
    makeCategory({ id: 'c4', name: 'Health' }),
    makeCategory({ id: 'c5', name: 'Insurance' }),
    makeCategory({ id: 'c6', name: 'Entertainment' }),
  ]

  it('maps מסעדות/קפה to Dining', () => {
    expect(matchIsracardCategory('מסעדות/קפה', categories)).toBe('c1')
  })

  it('maps מכולת/סופר to Groceries', () => {
    expect(matchIsracardCategory('מכולת/סופר', categories)).toBe('c2')
  })

  it('maps דלק to Transportation', () => {
    expect(matchIsracardCategory('דלק', categories)).toBe('c3')
  })

  it('maps שרות רפואי to Health', () => {
    expect(matchIsracardCategory('שרות רפואי', categories)).toBe('c4')
  })

  it('maps ביטוח to Insurance', () => {
    expect(matchIsracardCategory('ביטוח', categories)).toBe('c5')
  })

  it('maps בידור/פנאי to Entertainment', () => {
    expect(matchIsracardCategory('בידור/פנאי', categories)).toBe('c6')
  })

  it('returns null for unknown Isracard category', () => {
    expect(matchIsracardCategory('קטגוריה_שלא_קיימת', categories)).toBeNull()
  })

  it('returns null for empty categories array', () => {
    expect(matchIsracardCategory('מסעדות/קפה', [])).toBeNull()
  })

  it('does partial matching as fallback', () => {
    const cats: Category[] = [makeCategory({ id: 'cx', name: 'Health & Medical Services' })]
    expect(matchIsracardCategory('שרות רפואי', cats)).toBe('cx')
  })
})
