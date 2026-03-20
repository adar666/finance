import type { CategorizationRule, Category } from '@/types/database'

const MATCH_TYPE_PRIORITY: Record<string, number> = {
  exact: 3,
  starts_with: 2,
  contains: 1,
}

function matches(description: string, rule: CategorizationRule): boolean {
  const desc = description.toLowerCase()
  const pattern = rule.pattern.toLowerCase()

  switch (rule.match_type) {
    case 'exact':
      return desc === pattern
    case 'starts_with':
      return desc.startsWith(pattern)
    case 'contains':
      return desc.includes(pattern)
    default:
      return false
  }
}

export function applyCategoryRules(
  description: string,
  rules: CategorizationRule[]
): string | null {
  const activeRules = rules.filter((r) => r.is_active)

  let bestRule: CategorizationRule | null = null
  let bestScore = -1

  for (const rule of activeRules) {
    if (!matches(description, rule)) continue

    const score =
      rule.priority * 10 + (MATCH_TYPE_PRIORITY[rule.match_type] ?? 0)

    if (score > bestScore) {
      bestScore = score
      bestRule = rule
    }
  }

  return bestRule?.category_id ?? null
}

const ISRACARD_CATEGORY_MAP: Record<string, string[]> = {
  'מסעדות/קפה': ['Dining', 'Food & Drink', 'מסעדות'],
  'מכולת/סופר': ['Groceries', 'מכולת'],
  'דלק': ['Transportation', 'Fuel', 'דלק', 'תחבורה'],
  'תקשורת': ['Communication', 'תקשורת', 'Internet'],
  'שרות רפואי': ['Health', 'Medical', 'בריאות'],
  'ביטוח': ['Insurance', 'ביטוח'],
  'כלי בית': ['Household', 'Home', 'בית'],
  'בניה/שיפוץ': ['Housing', 'Home Improvement', 'בית'],
  'שונות': ['Miscellaneous', 'Other', 'שונות'],
  'מעדניות': ['Groceries', 'Food', 'מכולת'],
  'שירותי רכב': ['Transportation', 'Vehicle', 'תחבורה'],
  "תש' רשויות": ['Government', 'Bills', 'חשבונות'],
  'הלבשה/הנעלה': ['Clothing', 'הלבשה'],
  'אלקטרוניקה': ['Electronics', 'Technology'],
  'בידור/פנאי': ['Entertainment', 'בידור'],
  'קמעונאות': ['Shopping', 'קניות'],
}

export function matchIsracardCategory(
  sourceCat: string,
  categories: Category[]
): string | null {
  const aliases = ISRACARD_CATEGORY_MAP[sourceCat]
  if (!aliases) return null

  const aliasLower = (s: string) => s.toLowerCase()

  for (const alias of aliases) {
    const a = aliasLower(alias)
    const match = categories.find((c) => {
      if (aliasLower(c.name) === a) return true
      const he = c.name_he?.trim()
      return he != null && aliasLower(he) === a
    })
    if (match) return match.id
  }

  for (const alias of aliases) {
    const a = aliasLower(alias)
    const match = categories.find((c) => {
      if (c.name.toLowerCase().includes(a)) return true
      const he = c.name_he?.trim()
      return he != null && he.toLowerCase().includes(a)
    })
    if (match) return match.id
  }

  return null
}
