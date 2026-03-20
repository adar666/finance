'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { RecurringRule, RecurringFrequency } from '@/types/database'

function advanceDate(dateStr: string, frequency: RecurringFrequency): string {
  const d = new Date(dateStr)
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1)
      break
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      break
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  return d.toISOString().slice(0, 10)
}

export function useRecurringAutoGenerate() {
  const qc = useQueryClient()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const today = new Date().toISOString().slice(0, 10)

      const { data: rules, error } = await supabase
        .from('recurring_rules')
        .select('*')
        .eq('is_active', true)
        .lte('next_occurrence', today)

      if (error || !rules || rules.length === 0) return

      let created = 0

      for (const rule of rules as RecurringRule[]) {
        if (rule.type !== 'income' && rule.type !== 'expense') continue

        let nextOccurrence = rule.next_occurrence
        const batch: Array<{
          user_id: string
          account_id: string
          category_id: string | null
          amount: number
          type: string
          description: string
          date: string
          notes: string | null
          transfer_to_account_id: string | null
          recurring_rule_id: string
        }> = []

        while (nextOccurrence <= today) {
          if (rule.end_date && nextOccurrence > rule.end_date) break

          batch.push({
            user_id: user.id,
            account_id: rule.account_id,
            category_id: rule.category_id,
            amount: rule.amount,
            type: rule.type,
            description: rule.description,
            date: nextOccurrence,
            notes: null,
            transfer_to_account_id: null,
            recurring_rule_id: rule.id,
          })

          nextOccurrence = advanceDate(nextOccurrence, rule.frequency)

          if (batch.length >= 100) break
        }

        if (batch.length > 0) {
          const { error: insertErr } = await supabase
            .from('transactions')
            .insert(batch)
          if (insertErr) {
            console.error('Recurring auto-gen insert error:', insertErr)
            continue
          }
          created += batch.length
        }

        await supabase
          .from('recurring_rules')
          .update({ next_occurrence: nextOccurrence })
          .eq('id', rule.id)
      }

      if (created > 0) {
        toast.success(`Auto-generated ${created} recurring transaction${created === 1 ? '' : 's'}`)
        qc.invalidateQueries({ queryKey: ['transactions'] })
        qc.invalidateQueries({ queryKey: ['accounts'] })
        qc.invalidateQueries({ queryKey: ['recurring_rules'] })
      }
    })()
  }, [qc])
}
