'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Investment } from '@/types/database'
import { toast } from 'sonner'

export function useInvestments() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['investments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Investment[]
    },
  })
}

export function useCreateInvestment() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (inv: Omit<Investment, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('investments')
        .insert({ ...inv, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as Investment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      toast.success('Investment added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateInvestment() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Investment> & { id: string }) => {
      const { data, error } = await supabase
        .from('investments')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Investment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      toast.success('Investment updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteInvestment() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      toast.success('Investment deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
