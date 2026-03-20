'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SavingsGoal } from '@/types/database'
import { toast } from 'sonner'

export function useSavingsGoals() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['savings_goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as SavingsGoal[]
    },
  })
}

export function useCreateSavingsGoal() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (goal: Omit<SavingsGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('savings_goals')
        .insert({ ...goal, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as SavingsGoal
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['savings_goals'] })
      toast.success('Savings goal created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateSavingsGoal() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SavingsGoal> & { id: string }) => {
      const { data, error } = await supabase
        .from('savings_goals')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as SavingsGoal
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['savings_goals'] })
      toast.success('Savings goal updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteSavingsGoal() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['savings_goals'] })
      toast.success('Savings goal deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
