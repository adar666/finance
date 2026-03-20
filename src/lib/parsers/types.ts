export type BankSource = 'isracard' | 'hapoalim'

export type TransactionFlag = 'credit_card_aggregate' | 'duplicate_suspect'

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  type: 'expense' | 'income' | 'transfer'
  sourceCategory?: string
  source: BankSource
  flags: TransactionFlag[]
}

export interface BankDetectionResult {
  bank: BankSource | 'unknown'
  confidence: number
}

export interface PDFParseResult {
  bank: BankDetectionResult
  transactions: ParsedTransaction[]
  errors: string[]
}
