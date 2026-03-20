import Papa from 'papaparse'

export interface CSVParseResult {
  headers: string[]
  rows: Record<string, string>[]
  errors: string[]
}

export function parseCSV(file: File): Promise<CSVParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          headers: results.meta.fields || [],
          rows: results.data as Record<string, string>[],
          errors: results.errors.map((e) => e.message),
        })
      },
      error: (error: Error) => {
        resolve({ headers: [], rows: [], errors: [error.message] })
      },
    })
  })
}

export interface ColumnMapping {
  date: string
  amount: string
  description: string
  category?: string
  notes?: string
}

export function mapCSVToTransactions(
  rows: Record<string, string>[],
  mapping: ColumnMapping
) {
  return rows.map((row) => {
    const rawAmount = row[mapping.amount]?.replace(/[^0-9.\-]/g, '')
    const amount = parseFloat(rawAmount) || 0

    return {
      date: row[mapping.date] || '',
      amount: Math.abs(amount),
      type: amount < 0 ? ('expense' as const) : ('income' as const),
      description: row[mapping.description] || '',
      notes: mapping.notes ? row[mapping.notes] || null : null,
    }
  })
}
