import type { ParsedTransaction } from './types'

const DATE_4_RE = /(\d{2})\/(\d{2})\/(\d{4})/
const AMOUNT_RE = /[\d,]+\.\d{2}/g
const PAGE_BREAK_RE = /מתוך:|-- \d+ of \d+ --|bankhapoalim|חשבון\s+סניף|שם חשבון/
const HEADER_RE = /^(תאריך\s+פעולה|חובה\s+זכות|תנועות בחשבון|תקופה$)/

const CREDIT_CARD_ACTIONS = ['מסטרקרד', 'מסטרקארד', 'ויזה']

const INCOME_ACTIONS = [
  'משכורת',
  'משכורת-נט',
  'מענק ללקוח',
  'ני"ע-דיבידנד',
  'זיכוי',
  'רבית זכות',
]

/** Outgoing bank transfers to another person (e.g. העב' לאחר-נייד) are expenses here:
 *  money left the account for budgeting. App "transfer" type is for moves between *your* accounts only. */

function parseDate4(s: string): string {
  const m = s.match(DATE_4_RE)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

function classifyAction(action: string): { type: 'income' | 'expense'; isCreditCardAggregate: boolean } {
  const normalized = action.trim()

  for (const cc of CREDIT_CARD_ACTIONS) {
    if (normalized.includes(cc)) {
      return { type: 'expense', isCreditCardAggregate: true }
    }
  }

  for (const inc of INCOME_ACTIONS) {
    if (normalized.includes(inc)) {
      return { type: 'income', isCreditCardAggregate: false }
    }
  }

  return { type: 'expense', isCreditCardAggregate: false }
}

export function parseHapoalimPDF(pages: string[]): ParsedTransaction[] {
  const fullText = pages.join('\n')
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean)

  const results: ParsedTransaction[] = []

  for (const line of lines) {
    if (PAGE_BREAK_RE.test(line)) continue
    if (HEADER_RE.test(line)) continue
    if (/^\d{1,2}$/.test(line)) continue

    const dateMatch = line.match(DATE_4_RE)
    if (!dateMatch) continue

    const date = parseDate4(line)
    if (!date) continue

    const afterDate = line.slice(dateMatch.index! + dateMatch[0].length).trim()

    const amounts = afterDate.match(AMOUNT_RE) || []
    if (amounts.length === 0) continue

    let actionDesc = afterDate
    for (const a of amounts) {
      actionDesc = actionDesc.replace(a, '')
    }
    actionDesc = actionDesc.replace(/[₪#]+/g, '').replace(/\t+/g, ' ').replace(/\s{2,}/g, ' ').trim()

    if (!actionDesc) continue

    const { type, isCreditCardAggregate } = classifyAction(actionDesc)

    const amount = parseAmount(amounts[0] ?? '0')

    if (amount === 0) continue

    results.push({
      date,
      description: actionDesc,
      amount,
      type,
      source: 'hapoalim',
      flags: isCreditCardAggregate ? ['credit_card_aggregate'] : [],
    })
  }

  return results
}
