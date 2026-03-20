import { describe, it, expect } from 'vitest'
import { mapCSVToTransactions, parseCSV, type ColumnMapping } from './csv-parser'

describe('mapCSVToTransactions', () => {
  const mapping: ColumnMapping = {
    date: 'Date',
    amount: 'Amount',
    description: 'Memo',
  }

  it('maps positive amount to income', () => {
    const rows = [{ Date: '2024-01-15', Amount: '100.50', Memo: 'Pay' }]
    const out = mapCSVToTransactions(rows, mapping)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      date: '2024-01-15',
      amount: 100.5,
      type: 'income',
      description: 'Pay',
      notes: null,
    })
  })

  it('maps negative amount to expense with absolute value', () => {
    const rows = [{ Date: '2024-02-01', Amount: '-42.00', Memo: 'Coffee' }]
    const out = mapCSVToTransactions(rows, mapping)
    expect(out[0].type).toBe('expense')
    expect(out[0].amount).toBe(42)
  })

  it('strips currency symbols from amount', () => {
    const rows = [{ Date: '2024-01-01', Amount: '$1,234.56', Memo: 'X' }]
    const out = mapCSVToTransactions(rows, mapping)
    expect(out[0].amount).toBe(1234.56)
    expect(out[0].type).toBe('income')
  })

  it('includes notes when mapping has notes column', () => {
    const m: ColumnMapping = { ...mapping, notes: 'Note' }
    const rows = [{ Date: '2024-01-01', Amount: '10', Memo: 'A', Note: 'extra' }]
    const out = mapCSVToTransactions(rows, m)
    expect(out[0].notes).toBe('extra')
  })
})

describe('parseCSV', () => {
  it('parses valid CSV file', async () => {
    const csv = 'Date,Amount,Memo\n2024-01-01,10,Test\n'
    const file = new File([csv], 't.csv', { type: 'text/csv' })
    const result = await parseCSV(file)
    expect(result.errors).toHaveLength(0)
    expect(result.headers).toEqual(['Date', 'Amount', 'Memo'])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ Date: '2024-01-01', Amount: '10', Memo: 'Test' })
  })
})
