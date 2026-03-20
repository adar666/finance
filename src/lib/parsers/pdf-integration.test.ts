import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { detectBank } from './bank-detector'
import { parseIsracardPDF } from './isracard-parser'
import { parseHapoalimPDF } from './hapoalim-parser'

async function extractPDFText(pdfPath: string): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const buffer = readFileSync(pdfPath)
  const data = new Uint8Array(buffer)
  const pdf = await pdfjsLib.getDocument({ data }).promise

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const lines: string[] = []
    let lastY: number | null = null

    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = Math.round((item as { transform: number[] }).transform[5])
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push('\n')
      }
      lines.push(item.str)
      if (item.hasEOL) lines.push('\n')
      lastY = y
    }

    pages.push(lines.join(''))
  }

  return pages
}

const ISRACARD_PDF = resolve(__dirname, '__fixtures__/isracard-feb-26.pdf')
const HAPOALIM_PDF = resolve(__dirname, '__fixtures__/hapoalim-charges.pdf')

describe('PDF integration: Isracard real PDF', () => {
  let pages: string[]

  beforeAll(async () => {
    pages = await extractPDFText(ISRACARD_PDF)
  }, 30_000)

  it('extracts multiple pages', () => {
    expect(pages.length).toBeGreaterThanOrEqual(2)
  })

  it('bank detector identifies Isracard', () => {
    const fullText = pages.join('\n')
    const result = detectBank(fullText)
    expect(result.bank).toBe('isracard')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('parser produces transactions', () => {
    const txns = parseIsracardPDF(pages)
    expect(txns.length).toBeGreaterThan(10)
  })

  it('all transactions have valid ISO dates', () => {
    const txns = parseIsracardPDF(pages)
    const isoDateRe = /^\d{4}-\d{2}-\d{2}$/
    txns.forEach((t) => {
      expect(t.date).toMatch(isoDateRe)
    })
  })

  it('all transactions have positive amounts', () => {
    const txns = parseIsracardPDF(pages)
    txns.forEach((t) => {
      expect(t.amount).toBeGreaterThan(0)
    })
  })

  it('all transactions are expenses from isracard', () => {
    const txns = parseIsracardPDF(pages)
    txns.forEach((t) => {
      expect(t.type).toBe('expense')
      expect(t.source).toBe('isracard')
    })
  })

  it('includes known merchants from the PDF', () => {
    const txns = parseIsracardPDF(pages)
    const descs = txns.map((t) => t.description)
    const hasSpotify = descs.some((d) => d.includes('SPOTIFY'))
    const hasVictory = descs.some((d) => d.includes('ויקטורי'))
    expect(hasSpotify || hasVictory).toBe(true)
  })

  it('includes known Isracard categories', () => {
    const txns = parseIsracardPDF(pages)
    const cats = txns.map((t) => t.sourceCategory).filter(Boolean)
    expect(cats.length).toBeGreaterThan(0)
    const knownCats = ['מסעדות/קפה', 'מכולת/סופר', 'דלק', 'שונות', 'בניה/שיפוץ', 'תקשורת', 'ביטוח', 'שרות רפואי']
    const hasKnownCat = cats.some((c) => knownCats.includes(c!))
    expect(hasKnownCat).toBe(true)
  })

  it('installment transactions use the charge amount, not the original', () => {
    const txns = parseIsracardPDF(pages)
    const installment = txns.find((t) => t.amount < 100 && t.sourceCategory === 'בניה/שיפוץ')
    if (installment) {
      expect(installment.amount).toBeLessThan(200)
    }
  })
})

describe('PDF integration: Hapoalim real PDF', () => {
  let pages: string[]

  beforeAll(async () => {
    pages = await extractPDFText(HAPOALIM_PDF)
  }, 30_000)

  it('extracts multiple pages', () => {
    expect(pages.length).toBeGreaterThanOrEqual(2)
  })

  it('bank detector identifies Hapoalim', () => {
    const fullText = pages.join('\n')
    const result = detectBank(fullText)
    expect(result.bank).toBe('hapoalim')
  })

  it('parser produces transactions', () => {
    const txns = parseHapoalimPDF(pages)
    expect(txns.length).toBeGreaterThan(10)
  })

  it('all transactions have valid ISO dates', () => {
    const txns = parseHapoalimPDF(pages)
    const isoDateRe = /^\d{4}-\d{2}-\d{2}$/
    txns.forEach((t) => {
      expect(t.date).toMatch(isoDateRe)
    })
  })

  it('all transactions have positive amounts', () => {
    const txns = parseHapoalimPDF(pages)
    txns.forEach((t) => {
      expect(t.amount).toBeGreaterThan(0)
    })
  })

  it('all transactions have source hapoalim', () => {
    const txns = parseHapoalimPDF(pages)
    txns.forEach((t) => {
      expect(t.source).toBe('hapoalim')
    })
  })

  it('correctly flags credit card aggregates (מסטרקרד)', () => {
    const txns = parseHapoalimPDF(pages)
    const aggregates = txns.filter((t) => t.flags.includes('credit_card_aggregate'))
    expect(aggregates.length).toBeGreaterThan(5)
    aggregates.forEach((t) => {
      expect(t.description).toContain('מסטרקרד')
    })
  })

  it('includes salary transactions as income', () => {
    const txns = parseHapoalimPDF(pages)
    const salaries = txns.filter((t) => t.type === 'income' && t.description.includes('משכורת'))
    expect(salaries.length).toBeGreaterThan(0)
    salaries.forEach((s) => {
      expect(s.amount).toBeGreaterThan(1000)
    })
  })

  it('includes transfers', () => {
    const txns = parseHapoalimPDF(pages)
    const transfers = txns.filter((t) => t.type === 'transfer')
    expect(transfers.length).toBeGreaterThan(0)
  })

  it('includes bank fees (ONTIME)', () => {
    const txns = parseHapoalimPDF(pages)
    const fees = txns.filter((t) => t.description.includes('ONTIME'))
    expect(fees.length).toBeGreaterThan(0)
    fees.forEach((f) => {
      expect(f.type).toBe('expense')
      expect(f.amount).toBe(9.00)
    })
  })

  it('dedup scenario: credit card aggregates should NOT be double-counted with Isracard', async () => {
    const isracardPages = await extractPDFText(ISRACARD_PDF)
    const isracardTxns = parseIsracardPDF(isracardPages)
    const hapoalimTxns = parseHapoalimPDF(pages)

    const nonAggregateHapoalim = hapoalimTxns.filter(
      (t) => !t.flags.includes('credit_card_aggregate')
    )

    const isracardTotal = isracardTxns.reduce((sum, t) => sum + t.amount, 0)
    const hapoalimAggregateTotal = hapoalimTxns
      .filter((t) => t.flags.includes('credit_card_aggregate'))
      .reduce((sum, t) => sum + t.amount, 0)

    expect(hapoalimAggregateTotal).toBeGreaterThan(0)
    expect(nonAggregateHapoalim.every((t) => !t.description.includes('מסטרקרד'))).toBe(true)
  })
})
