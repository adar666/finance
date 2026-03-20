import type { BankDetectionResult } from './types'

const ISRACARD_PATTERNS = [
  'ישראכרט',
  'isracard',
  'מסטרקארד',
  'פרוט פעולותיך',
  'עסקות שחויבו',
]

const HAPOALIM_PATTERNS = [
  'בנק הפועלים',
  'bankhapoalim',
  'תנועות בחשבון',
  'יתרה בש"ח',
]

export function detectBank(text: string): BankDetectionResult {
  const sample = text.slice(0, 1500).toLowerCase()

  let isracardScore = 0
  for (const p of ISRACARD_PATTERNS) {
    if (sample.includes(p.toLowerCase())) isracardScore++
  }

  let hapoalimScore = 0
  for (const p of HAPOALIM_PATTERNS) {
    if (sample.includes(p.toLowerCase())) hapoalimScore++
  }

  if (isracardScore > hapoalimScore && isracardScore >= 2) {
    return { bank: 'isracard', confidence: isracardScore / ISRACARD_PATTERNS.length }
  }
  if (hapoalimScore > isracardScore && hapoalimScore >= 2) {
    return { bank: 'hapoalim', confidence: hapoalimScore / HAPOALIM_PATTERNS.length }
  }
  if (isracardScore > 0) {
    return { bank: 'isracard', confidence: isracardScore / ISRACARD_PATTERNS.length }
  }
  if (hapoalimScore > 0) {
    return { bank: 'hapoalim', confidence: hapoalimScore / HAPOALIM_PATTERNS.length }
  }

  return { bank: 'unknown', confidence: 0 }
}
