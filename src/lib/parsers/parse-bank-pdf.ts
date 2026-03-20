import { extractTextFromPDF } from './pdf-text-extractor'
import { detectBank } from './bank-detector'
import { parseIsracardPDF } from './isracard-parser'
import { parseHapoalimPDF } from './hapoalim-parser'
import type { PDFParseResult } from './types'

export async function parseBankPDF(file: File): Promise<PDFParseResult> {
  let pages: string[]
  try {
    pages = await extractTextFromPDF(file)
  } catch (err) {
    return {
      bank: { bank: 'unknown', confidence: 0 },
      transactions: [],
      errors: [(err as Error).message || 'Failed to extract text from PDF'],
    }
  }

  const fullText = pages.join('\n')
  const bank = detectBank(fullText)

  if (bank.bank === 'unknown') {
    return {
      bank,
      transactions: [],
      errors: ['Could not detect bank. Supported: Isracard, Bank Hapoalim.'],
    }
  }

  try {
    const transactions =
      bank.bank === 'isracard'
        ? parseIsracardPDF(pages)
        : parseHapoalimPDF(pages)

    return { bank, transactions, errors: [] }
  } catch (err) {
    return {
      bank,
      transactions: [],
      errors: [(err as Error).message || 'Failed to parse PDF'],
    }
  }
}
