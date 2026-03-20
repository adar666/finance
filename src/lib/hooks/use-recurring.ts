'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RecurringRule } from '@/types/database'
import { toast } from 'sonner'

export function useRecurringRules() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['recurring_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_rules')
        .select('*, account:accounts(*), category:categories(*)')
        .order('next_occurrence', { ascending: true })
      if (error) throw error
      return data as RecurringRule[]
    },
  })
}

export function useCreateRecurringRule() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (rule: Omit<RecurringRule, 'id' | 'user_id' | 'created_at' | 'account' | 'category'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('recurring_rules')
        .insert({ ...rule, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as RecurringRule
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring_rules'] })
      toast.success('Recurring rule created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateRecurringRule() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RecurringRule> & { id: string }) => {
      const { data, error } = await supabase
        .from('recurring_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as RecurringRule
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring_rules'] })
      toast.success('Recurring rule updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteRecurringRule() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_rules').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring_rules'] })
      toast.success('Recurring rule deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
