import { describe, it, expect } from 'vitest'
import { parseIsracardPDF } from './isracard-parser'

const FIXTURE_PAGE_1 = `לוגוקבוצתישראכרטבנקהפועלים-מועדוןמאסטרקרד.טלפון2414*
למידע\tנוסף\tוביצוע\tפעולות\tלחץ\tכאן
לכבוד
דרדיק אוריאל
פרוט\tפעולותיך\tלתאריך:\t15/02/26
סוג\tכרטיס:\tמסטרקארד
רכישות\tבחו"ל
תאריך\tסוג
עיר
שם\tבית\tהעסק\tסכום\tמקורי
26/01/26\tא\tSPOTIFY P3EBDBC382
STOCKHOLM
33.90\t₪\t33.90
סה"כ\tחיוב\tלתאריך\t27/01/26\t33.90
01/02/26\tא\tTOPPER*LEDGER-LIVE
INTERNET
$\t307.40\t02/02/26\t3.1010\t27.64\t980.89
**פ\t.\tעמלה:\t%עמלה:\t2.900
סה"כ\tחיוב\tלתאריך\t03/02/26\t980.89
09/02/26\tא\tAMAZON MKTPL*2017L
SEATTLE
130.32\t₪\t130.32
סה"כ\tחיוב\tלתאריך\t11/02/26\t130.32
עסקות\tשחויבו\t/\tזוכו\t-\tבארץ
תאריך
עסקה
כרטיס
בעסקה
שם\tבית\tעסק\tענף\tסכום
עסקה
סכום
החיוב
בש"ח
פירוט\tנוסף
28/05/25\tלא\tהוצג\tצלול\tמטהרי\tמים-יציל\tבניה/שיפוץ\t2,844.00\t79.00\tתשלום\t9\tמתוך\t36
06/01/26\tלא\tהוצג\tטופ\tפיקס\tלבית\tבע"מ\tשונות\t936.00\t78.00\tתשלום\t2\tמתוך\t12
16/01/26\tתש\t.\tנייד\tהפרלמנט\tמסעדות/קפה\t120.00\t120.00
21/01/26\tה.\tקבע\tדרך\tארץ\tהוראת\tקבע\tתש'\tרשויות\t14.94\t14.94
26/01/26\tויקטורי\tכפר\tסבא\tהירו\tמכולת/סופר\t167.64\t167.64
26/01/26\tתש\t.\tנייד\tחנות\tהייטקזון\tשונות\t174.00\t174.00
02/02/26\tתחנת\tסדש\tתל\tמונד\tדלק\t202.10\t202.10
מסגרת\tהכרטיס\tותנאי\tהאשראי`

describe('parseIsracardPDF', () => {
  it('parses both foreign and domestic transactions', () => {
    const txns = parseIsracardPDF([FIXTURE_PAGE_1])
    expect(txns.length).toBeGreaterThan(0)

    const foreign = txns.filter((t) => t.description.includes('SPOTIFY') || t.description.includes('AMAZON') || t.description.includes('TOPPER'))
    expect(foreign.length).toBeGreaterThanOrEqual(2)

    const domestic = txns.filter((t) => t.source === 'isracard' && t.sourceCategory)
    expect(domestic.length).toBeGreaterThan(0)
  })

  it('correctly parses a domestic transaction with category', () => {
    const txns = parseIsracardPDF([FIXTURE_PAGE_1])
    const parliament = txns.find((t) => t.description.includes('הפרלמנט'))
    expect(parliament).toBeDefined()
    expect(parliament!.date).toBe('2026-01-16')
    expect(parliament!.amount).toBe(120.00)
    expect(parliament!.type).toBe('expense')
    expect(parliament!.sourceCategory).toBe('מסעדות/קפה')
    expect(parliament!.source).toBe('isracard')
  })

  it('parses installment transactions (charge amount, not original)', () => {
    const txns = parseIsracardPDF([FIXTURE_PAGE_1])
    const installment = txns.find((t) => t.description.includes('צלול'))
    expect(installment).toBeDefined()
    expect(installment!.amount).toBe(79.00)
    expect(installment!.sourceCategory).toBe('בניה/שיפוץ')
  })

  it('parses fuel/gas transactions', () => {
    const txns = parseIsracardPDF([FIXTURE_PAGE_1])
    const fuel = txns.find((t) => t.description.includes('סדש'))
    expect(fuel).toBeDefined()
    expect(fuel!.amount).toBe(202.10)
    expect(fuel!.sourceCategory).toBe('דלק')
  })

  it('parses grocery transactions without card info prefix', () => {
    const txns = parseIsracardPDF([FIXTURE_PAGE_1])
    const grocery = txns.find((t) => t.description.includes('ויקטורי'))
    expect(grocery).toBeDefined()
    expect(grocery!.amount).toBe(167.64)
    expect(grocery!.sourceCategory).toBe('מכולת/סופר')
  })

  it('all transactions are type expense', () => {
    const txns = parseIsracardPDF([FIXTURE_PAGE_1])
    expect(txns.every((t) => t.type === 'expense')).toBe(true)
  })

  it('all transactions have source isracard', () => {
    const txns = parseIsracardPDF([FIXTURE_PAGE_1])
    expect(txns.every((t) => t.source === 'isracard')).toBe(true)
  })

  it('dates are in ISO format YYYY-MM-DD', () => {
    const txns = parseIsracardPDF([FIXTURE_PAGE_1])
    const isoDateRe = /^\d{4}-\d{2}-\d{2}$/
    txns.forEach((t) => {
      expect(t.date).toMatch(isoDateRe)
    })
  })

  it('skips subtotal and header lines', () => {
    const txns = parseIsracardPDF([FIXTURE_PAGE_1])
    const hasSubtotal = txns.some((t) => t.description.includes('סה"כ'))
    expect(hasSubtotal).toBe(false)
  })

  it('stops parsing after מסגרת הכרטיס (credit framework section)', () => {
    const txns = parseIsracardPDF([FIXTURE_PAGE_1])
    const hasCreditSection = txns.some((t) => t.description.includes('מסגרת'))
    expect(hasCreditSection).toBe(false)
  })

  it('returns empty array for empty input', () => {
    expect(parseIsracardPDF([])).toEqual([])
    expect(parseIsracardPDF([''])).toEqual([])
  })

  it('returns empty array for text with no transaction sections', () => {
    const txns = parseIsracardPDF(['Just some random text without bank data'])
    expect(txns).toEqual([])
  })

  it('handles multi-page input', () => {
    const page2 = `עסקות\tשחויבו\t/\tזוכו\t-\tבארץ\t-\tהמשך\tמעמוד\tקודם
תאריך
עסקה
08/02/26\tצמרת-\tHOME 360\tבניה/שיפוץ\t22.90\t22.90
10/02/26\tתש\t.\tנייד\tויקטורי\tכפר\tסבא\tהירו\tמכולת/סופר\t123.33\t123.33
מסגרת\tהכרטיס`
    const txns = parseIsracardPDF([FIXTURE_PAGE_1, page2])
    const home360 = txns.find((t) => t.description.includes('HOME 360'))
    expect(home360).toBeDefined()
    expect(home360!.amount).toBe(22.90)
  })
})
