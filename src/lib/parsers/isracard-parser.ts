import type { ParsedTransaction } from './types'

const DATE_2_RE = /^(\d{2})\/(\d{2})\/(\d{2})/
const AMOUNT_RE = /[\d,]+\.\d{2}/g
const SUBTOTAL_RE = /סה"כ\s*חיוב/
const PAGE_BREAK_RE = /עמוד\s*\d+\s*מתוך|-- \d+ of \d+ --/
const SECTION_DOMESTIC_RE = /עסקות\s*שחויבו/
const SECTION_FOREIGN_RE = /רכישות\s*בחו"ל/
const SECTION_CREDIT_RE = /מסגרת\s*הכרטיס/
const INSTALLMENT_RE = /תשלום\s*\d+\s*מתוך\s*\d+/
const HEADER_LINE_RE = /^(תאריך|כרטיס|שם\s*בית|ענף|סכום|החיוב|בש"ח|פירוט|עסקה|בעסקה|המשך|שםבית)/

const KNOWN_CATEGORIES = [
  'בניה/שיפוץ',
  'מסעדות/קפה',
  'מכולת/סופר',
  'תש\' רשויות',
  'כלי בית',
  'שרות רפואי',
  'שירותי רכב',
  'תקשורת',
  'מעדניות',
  'ביטוח',
  'שונות',
  'דלק',
  'קמעונאות',
  'הלבשה/הנעלה',
  'אלקטרוניקה',
  'תכשיטים',
  'ספרים/עיתונים',
  'חינוך',
  'בידור/פנאי',
  'ריהוט',
  'מתנות',
  'תיירות',
]

const CARD_INFO_PREFIXES = [
  'לאהוצג',
  'לא\tהוצג',
  'לא הוצג',
  'תש.נייד',
  'תש\t.\tנייד',
  'תש . נייד',
  'ה.קבע',
  'ה.\tקבע',
  'ה. קבע',
  'ש.אלחוט',
  'ש\t.\tאלחוט',
  'ש . אלחוט',
]

function parseDate2(d: string): string {
  const m = d.match(DATE_2_RE)
  if (!m) return ''
  const day = m[1]
  const month = m[2]
  let year = parseInt(m[3], 10)
  year += year < 50 ? 2000 : 1900
  return `${year}-${month}-${day}`
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

function findCategoryInLine(line: string): { category: string; index: number } | null {
  let best: { category: string; index: number } | null = null
  for (const cat of KNOWN_CATEGORIES) {
    const idx = line.indexOf(cat)
    if (idx >= 0) {
      if (!best || idx > best.index) {
        best = { category: cat, index: idx }
      }
    }
  }
  return best
}

function stripCardInfoPrefix(text: string): string {
  for (const prefix of CARD_INFO_PREFIXES) {
    if (text.startsWith(prefix)) {
      return text.slice(prefix.length).trim()
    }
  }
  return text
}

function parseDomesticLine(line: string): ParsedTransaction | null {
  const dateMatch = line.match(DATE_2_RE)
  if (!dateMatch) return null

  const date = parseDate2(line)
  if (!date) return null

  let afterDate = line.slice(dateMatch[0].length).trim()
  afterDate = stripCardInfoPrefix(afterDate)

  const catInfo = findCategoryInLine(afterDate)

  let description: string
  let sourceCategory: string | undefined
  let chargeAmount: number

  if (catInfo) {
    description = afterDate.slice(0, catInfo.index).replace(/\t+/g, ' ').replace(/\s{2,}/g, ' ').trim()
    sourceCategory = catInfo.category
    const afterCategory = afterDate.slice(catInfo.index + catInfo.category.length)
    const amounts = afterCategory.match(AMOUNT_RE) || []
    chargeAmount = amounts.length >= 2 ? parseAmount(amounts[1]) : parseAmount(amounts[0] ?? '0')
  } else {
    const amounts = afterDate.match(AMOUNT_RE) || []
    chargeAmount = amounts.length >= 2 ? parseAmount(amounts[amounts.length - 1]) : parseAmount(amounts[0] ?? '0')
    let descText = afterDate
    for (const a of amounts) {
      descText = descText.replace(a, '')
    }
    descText = descText.replace(INSTALLMENT_RE, '')
    description = descText.replace(/\t+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  }

  if (!description || chargeAmount === 0) return null

  return {
    date,
    description,
    amount: chargeAmount,
    type: 'expense',
    sourceCategory,
    source: 'isracard',
    flags: [],
  }
}

function parseForeignLines(lines: string[]): ParsedTransaction[] {
  const results: ParsedTransaction[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const dateMatch = line.match(DATE_2_RE)
    if (!dateMatch) {
      i++
      continue
    }

    const date = parseDate2(line)
    let afterDate = line.slice(dateMatch[0].length).trim()

    // Strip single-char card type (e.g. "א") at the start
    if (/^[א-ת]\s*[A-Z]/.test(afterDate) || /^[א-ת][A-Z]/.test(afterDate)) {
      afterDate = afterDate.slice(1).trim()
    }

    // Extract merchant name: everything that's not an amount or currency
    let merchantName = afterDate
      .replace(AMOUNT_RE, '')
      .replace(/[₪$]+/g, '')
      .replace(/\t+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    let chargeILS = 0
    const lineAmounts = line.match(AMOUNT_RE) || []
    if (lineAmounts.length > 0) {
      chargeILS = parseAmount(lineAmounts[lineAmounts.length - 1])
    }

    let lookahead = 1
    while (i + lookahead < lines.length && lookahead <= 3) {
      const nextLine = lines[i + lookahead].trim()
      if (nextLine.match(DATE_2_RE) || SUBTOTAL_RE.test(nextLine)) break

      const amounts = nextLine.match(AMOUNT_RE) || []
      if (amounts.length > 0) {
        chargeILS = parseAmount(amounts[amounts.length - 1])
      }

      const cleaned = nextLine
        .replace(AMOUNT_RE, '')
        .replace(/[₪$%*]+/g, '')
        .trim()
      if (cleaned && cleaned.length < 30 && !merchantName.includes(cleaned)) {
        merchantName += ' ' + cleaned
      }

      lookahead++
    }

    merchantName = merchantName.replace(/\s{2,}/g, ' ').trim()

    if (merchantName && chargeILS > 0) {
      results.push({
        date,
        description: merchantName,
        amount: chargeILS,
        type: 'expense',
        source: 'isracard',
        flags: [],
      })
    }

    i += lookahead
  }

  return results
}

export function parseIsracardPDF(pages: string[]): ParsedTransaction[] {
  const fullText = pages.join('\n')
  const lines = fullText.split('\n').map((l) => l.trim()).filter(Boolean)

  const results: ParsedTransaction[] = []
  let section: 'header' | 'foreign' | 'domestic' | 'footer' = 'header'
  const foreignLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (SECTION_CREDIT_RE.test(line)) {
      section = 'footer'
      continue
    }
    if (SECTION_FOREIGN_RE.test(line)) {
      section = 'foreign'
      continue
    }
    if (SECTION_DOMESTIC_RE.test(line)) {
      if (foreignLines.length > 0) {
        results.push(...parseForeignLines(foreignLines))
        foreignLines.length = 0
      }
      section = 'domestic'
      continue
    }

    if (section === 'footer') continue
    if (SUBTOTAL_RE.test(line)) continue
    if (PAGE_BREAK_RE.test(line)) continue
    if (HEADER_LINE_RE.test(line)) continue
    if (line.startsWith('*') && line.endsWith('*')) continue
    if (line.startsWith('סה"כ')) continue
    if (line.startsWith('**')) continue

    if (section === 'foreign') {
      foreignLines.push(line)
    } else if (section === 'domestic') {
      const tx = parseDomesticLine(line)
      if (tx) results.push(tx)
    }
  }

  if (foreignLines.length > 0) {
    results.push(...parseForeignLines(foreignLines))
  }

  return results
}
