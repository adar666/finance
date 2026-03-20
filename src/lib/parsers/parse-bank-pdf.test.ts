import { describe, it, expect, vi } from 'vitest'

vi.mock('./pdf-text-extractor', () => ({
  extractTextFromPDF: vi.fn(),
}))

import { parseBankPDF } from './parse-bank-pdf'
import { extractTextFromPDF } from './pdf-text-extractor'

const mockExtract = vi.mocked(extractTextFromPDF)

describe('parseBankPDF', () => {
  it('returns unknown bank error when text is unrecognizable', async () => {
    mockExtract.mockResolvedValue(['Some random text without bank identifiers'])
    const file = new File([''], 'random.pdf', { type: 'application/pdf' })
    const result = await parseBankPDF(file)
    expect(result.bank.bank).toBe('unknown')
    expect(result.transactions).toEqual([])
    expect(result.errors).toContain('Could not detect bank. Supported: Isracard, Bank Hapoalim.')
  })

  it('routes to Isracard parser when Isracard is detected', async () => {
    const isracardText = `פרוט\tפעולותיך\tלתאריך:\t15/02/26
סוג\tכרטיס:\tמסטרקארד
רכישות\tבחו"ל
עסקות\tשחויבו\t/\tזוכו\t-\tבארץ
תאריך
עסקה
16/01/26\tתש\t.\tנייד\tהפרלמנט\tמסעדות/קפה\t120.00\t120.00
מסגרת\tהכרטיס`

    mockExtract.mockResolvedValue([isracardText])
    const file = new File([''], 'isracard.pdf', { type: 'application/pdf' })
    const result = await parseBankPDF(file)

    expect(result.bank.bank).toBe('isracard')
    expect(result.errors).toEqual([])
    expect(result.transactions.length).toBeGreaterThan(0)
    expect(result.transactions[0].source).toBe('isracard')
  })

  it('routes to Hapoalim parser when Hapoalim is detected', async () => {
    const hapoalimText = `bankhapoalim.co.il
תנועות בחשבון
תקופה
תאריך\tפעולה\tחובה\tזכות\tיתרה בש"ח
09/03/2026\tמשכורת-נט\t21,105.00\t₪21,610.49\t##
1`

    mockExtract.mockResolvedValue([hapoalimText])
    const file = new File([''], 'hapoalim.pdf', { type: 'application/pdf' })
    const result = await parseBankPDF(file)

    expect(result.bank.bank).toBe('hapoalim')
    expect(result.errors).toEqual([])
    expect(result.transactions.length).toBeGreaterThan(0)
    expect(result.transactions[0].source).toBe('hapoalim')
  })

  it('catches parser errors and returns them', async () => {
    mockExtract.mockRejectedValue(new Error('PDF is corrupted'))
    const file = new File([''], 'broken.pdf', { type: 'application/pdf' })
    const result = await parseBankPDF(file)
    expect(result.errors).toContain('PDF is corrupted')
  })

  it('correctly parses credit card aggregate flags from Hapoalim', async () => {
    const hapoalimText = `bankhapoalim.co.il
תנועות בחשבון
תאריך\tפעולה\tחובה\tזכות\tיתרה בש"ח
15/03/2026\tמסטרקרד\t4,409.22\t₪5,983.38\t##
2
09/03/2026\tמשכורת-נט\t21,105.00\t₪21,610.49\t##
1`

    mockExtract.mockResolvedValue([hapoalimText])
    const file = new File([''], 'hapoalim.pdf', { type: 'application/pdf' })
    const result = await parseBankPDF(file)

    const aggregates = result.transactions.filter((t) => t.flags.includes('credit_card_aggregate'))
    expect(aggregates.length).toBe(1)
    expect(aggregates[0].description).toContain('מסטרקרד')

    const income = result.transactions.filter((t) => t.type === 'income')
    expect(income.length).toBe(1)
  })
})
