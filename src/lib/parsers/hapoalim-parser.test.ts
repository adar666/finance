import { describe, it, expect } from 'vitest'
import { parseHapoalimPDF } from './hapoalim-parser'

const FIXTURE_TEXT = `1\t0001_4444401515 מתוך:\t-0003
22/03/2026 *2407 / 03-6532407\tbankhapoalim.co.il
372521\t770\t12
חשבון\tסניף\tבנק שם חשבון
דרדיק אוריאל יקוטיאל
תנועות בחשבון
תקופה
20/03/2026\t-\t20/09/2025
תאריך\tפעולה\tחובה\tזכות\tיתרה בש"ח
15/03/2026\tמסטרקרד\t4,409.22\t₪5,983.38\t##
2
12/03/2026\tמסטרקרד\t518.14\t₪10,392.60\t##
2
11/03/2026\tני"ע-קניה\t2,999.75\t₪10,910.74\t##
2
09/03/2026\tהעב' לאחר-נייד\t2,000.00\t₪13,910.49\t##
2
09/03/2026\tהעב' לאחר-נייד\t200.00\t₪15,910.49\t##
2
09/03/2026\tמשכורת-נט\t21,105.00\t₪21,610.49\t##
1
08/03/2026\tמסטרקרד\t120.00\t₪505.49\t##
2
01/03/2026\tONTIME-עמ' עוש\t9.00\t₪727.50\t##
2
10/12/2025\tמשכורת\t10,749.00\t₪31,550.69\t##
1
08/12/2025\tני"ע-דיבידנד\t1.26\t₪4,640.69\t##
1
19/12/2025\tמענק ללקוח\t150.70\t₪10,963.74\t##
1
06/10/2025\tרבית\t1.55\t₪5,930.98\t##
2`

describe('parseHapoalimPDF', () => {
  it('parses transactions from Hapoalim statement text', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    expect(txns.length).toBeGreaterThan(0)
  })

  it('flags מסטרקרד transactions as credit_card_aggregate', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const mastercard = txns.filter((t) => t.flags.includes('credit_card_aggregate'))
    expect(mastercard.length).toBeGreaterThan(0)
    mastercard.forEach((t) => {
      expect(t.description).toContain('מסטרקרד')
      expect(t.type).toBe('expense')
    })
  })

  it('classifies משכורת-נט as income', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const salary = txns.find((t) => t.description.includes('משכורת-נט'))
    expect(salary).toBeDefined()
    expect(salary!.type).toBe('income')
    expect(salary!.amount).toBe(21105.00)
    expect(salary!.date).toBe('2026-03-09')
    expect(salary!.flags).toEqual([])
  })

  it('classifies משכורת as income', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const salary = txns.find((t) => t.description === 'משכורת')
    expect(salary).toBeDefined()
    expect(salary!.type).toBe('income')
    expect(salary!.amount).toBe(10749.00)
  })

  it('classifies העב\' לאחר-נייד as transfer', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const transfers = txns.filter((t) => t.type === 'transfer')
    expect(transfers.length).toBeGreaterThan(0)
    transfers.forEach((t) => {
      expect(t.description).toContain('העב')
      expect(t.flags).toEqual([])
    })
  })

  it('classifies ני"ע-קניה as expense', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const investment = txns.find((t) => t.description.includes('ני"ע-קניה'))
    expect(investment).toBeDefined()
    expect(investment!.type).toBe('expense')
    expect(investment!.amount).toBe(2999.75)
  })

  it('classifies ONTIME-עמ\' עוש as expense', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const fee = txns.find((t) => t.description.includes('ONTIME'))
    expect(fee).toBeDefined()
    expect(fee!.type).toBe('expense')
    expect(fee!.amount).toBe(9.00)
  })

  it('classifies מענק ללקוח as income', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const grant = txns.find((t) => t.description.includes('מענק'))
    expect(grant).toBeDefined()
    expect(grant!.type).toBe('income')
    expect(grant!.amount).toBe(150.70)
  })

  it('classifies ני"ע-דיבידנד as income', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const dividend = txns.find((t) => t.description.includes('ני"ע-דיבידנד'))
    expect(dividend).toBeDefined()
    expect(dividend!.type).toBe('income')
  })

  it('dates are in ISO format YYYY-MM-DD', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const isoDateRe = /^\d{4}-\d{2}-\d{2}$/
    txns.forEach((t) => {
      expect(t.date).toMatch(isoDateRe)
    })
  })

  it('all transactions have source hapoalim', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    expect(txns.every((t) => t.source === 'hapoalim')).toBe(true)
  })

  it('skips header/page-break lines', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const hasHeader = txns.some((t) => t.description.includes('תנועות בחשבון') || t.description.includes('bankhapoalim'))
    expect(hasHeader).toBe(false)
  })

  it('parses amounts correctly (with comma separators)', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const big = txns.find((t) => t.amount === 4409.22)
    expect(big).toBeDefined()
  })

  it('returns empty for empty input', () => {
    expect(parseHapoalimPDF([])).toEqual([])
    expect(parseHapoalimPDF([''])).toEqual([])
  })

  it('returns empty for text without date patterns', () => {
    const txns = parseHapoalimPDF(['No bank data here at all, just plain text'])
    expect(txns).toEqual([])
  })

  it('classifies רבית (interest) as expense', () => {
    const txns = parseHapoalimPDF([FIXTURE_TEXT])
    const interest = txns.find((t) => t.description === 'רבית')
    expect(interest).toBeDefined()
    expect(interest!.type).toBe('expense')
    expect(interest!.amount).toBe(1.55)
  })

  it('handles multi-page input', () => {
    const page2 = `תאריך\tפעולה\tחובה\tזכות\tיתרה בש"ח
03/02/2026\tמסטרקרד\t980.89\t₪3,443.70\t##
2
01/02/2026\tONTIME-עמ' עוש\t9.00\t₪4,424.59\t##
2`
    const txns = parseHapoalimPDF([FIXTURE_TEXT, page2])
    const feb = txns.filter((t) => t.date.startsWith('2026-02'))
    expect(feb.length).toBeGreaterThan(0)
  })
})
