'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Budget } from '@/types/database'
import { toast } from 'sonner'

export function useBudgets() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*, category:categories(*)')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Budget[]
    },
  })
}

export function useCreateBudget() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (budget: Omit<Budget, 'id' | 'user_id' | 'created_at' | 'category' | 'spent'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('budgets')
        .insert({ ...budget, user_id: user.id })
        .select('*, category:categories(*)')
        .single()
      if (error) throw error
      return data as Budget
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Budget created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateBudget() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Budget> & { id: string }) => {
      const { data, error } = await supabase
        .from('budgets')
        .update(updates)
        .eq('id', id)
        .select('*, category:categories(*)')
        .single()
      if (error) throw error
      return data as Budget
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Budget updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteBudget() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Budget deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
