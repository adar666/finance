import { describe, expect, it } from 'vitest'
import { getCategoryDisplayName, isHebrewLocale } from './category-display-name'

describe('isHebrewLocale', () => {
  it('recognizes he and variants', () => {
    expect(isHebrewLocale('he')).toBe(true)
    expect(isHebrewLocale('he-IL')).toBe(true)
    expect(isHebrewLocale('en')).toBe(false)
  })
})

describe('getCategoryDisplayName', () => {
  it('uses name_he in Hebrew locale when set', () => {
    expect(
      getCategoryDisplayName({ name: 'Groceries', name_he: 'מצרכים' }, 'he')
    ).toBe('מצרכים')
  })

  it('falls back to name when name_he missing', () => {
    expect(getCategoryDisplayName({ name: 'Groceries', name_he: null }, 'he')).toBe('Groceries')
  })

  it('uses English name in non-Hebrew locale', () => {
    expect(
      getCategoryDisplayName({ name: 'Groceries', name_he: 'מצרכים' }, 'en')
    ).toBe('Groceries')
  })
})
