import { describe, it, expect } from 'vitest'
import { detectBank } from './bank-detector'

describe('detectBank', () => {
  it('detects Isracard from Hebrew keywords', () => {
    const text = 'פרוט פעולותיך לתאריך: 15/02/26\nסוג כרטיס: מסטרקארד\nעסקות שחויבו / זוכו - בארץ'
    const result = detectBank(text)
    expect(result.bank).toBe('isracard')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('detects Isracard from the word ישראכרט', () => {
    const text = 'ישראכרט בע"מ\nפרוט פעולותיך לתאריך'
    const result = detectBank(text)
    expect(result.bank).toBe('isracard')
  })

  it('detects Isracard with single match (low confidence)', () => {
    const text = 'something ישראכרט something else completely'
    const result = detectBank(text)
    expect(result.bank).toBe('isracard')
    expect(result.confidence).toBeLessThanOrEqual(0.5)
  })

  it('detects Hapoalim from Hebrew keywords', () => {
    const text = 'בנק הפועלים\nתנועות בחשבון\nיתרה בש"ח\ncheckings'
    const result = detectBank(text)
    expect(result.bank).toBe('hapoalim')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('detects Hapoalim from bankhapoalim.co.il', () => {
    const text = 'bankhapoalim.co.il\nתנועות בחשבון\nדרדיק'
    const result = detectBank(text)
    expect(result.bank).toBe('hapoalim')
  })

  it('returns unknown for unrecognized text', () => {
    const text = 'This is just some random English text with no bank identifiers.'
    const result = detectBank(text)
    expect(result.bank).toBe('unknown')
    expect(result.confidence).toBe(0)
  })

  it('returns unknown for empty text', () => {
    const result = detectBank('')
    expect(result.bank).toBe('unknown')
  })

  it('prefers the bank with more matches', () => {
    const text = 'ישראכרט מסטרקארד פרוט פעולותיך עסקות שחויבו בנק הפועלים'
    const result = detectBank(text)
    expect(result.bank).toBe('isracard')
  })

  it('is case-insensitive for English identifiers', () => {
    const text = 'ISRACARD statement\nפרוט פעולותיך'
    const result = detectBank(text)
    expect(result.bank).toBe('isracard')
  })

  it('only scans the first 1500 characters', () => {
    const padding = 'x'.repeat(1600)
    const text = padding + 'ישראכרט מסטרקארד פרוט פעולותיך'
    const result = detectBank(text)
    expect(result.bank).toBe('unknown')
  })
})
