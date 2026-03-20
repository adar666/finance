'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CategorizationRule } from '@/types/database'
import { toast } from 'sonner'

const KEY = ['categorization-rules'] as const

export function useCategorizationRules() {
  const supabase = createClient()

  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorization_rules')
        .select('*, category:categories(*)')
        .order('priority', { ascending: false })
      if (error) throw error
      return data as CategorizationRule[]
    },
  })
}

export function useCreateCategorizationRule(successMessage?: string) {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (
      rule: Pick<CategorizationRule, 'pattern' | 'match_type' | 'category_id' | 'priority'>
    ) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('categorization_rules')
        .insert({ ...rule, user_id: user.id })
        .select('*, category:categories(*)')
        .single()
      if (error) throw error
      return data as CategorizationRule
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      if (successMessage) toast.success(successMessage)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateCategorizationRule(successMessage?: string) {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<CategorizationRule> & { id: string }) => {
      const { data, error } = await supabase
        .from('categorization_rules')
        .update(updates)
        .eq('id', id)
        .select('*, category:categories(*)')
        .single()
      if (error) throw error
      return data as CategorizationRule
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      if (successMessage) toast.success(successMessage)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteCategorizationRule(successMessage?: string) {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categorization_rules')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      if (successMessage) toast.success(successMessage)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
