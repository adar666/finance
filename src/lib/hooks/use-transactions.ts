'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { TRANSACTION_LIST_SELECT } from '@/lib/supabase/transaction-query'
import type { Transaction } from '@/types/database'
import { toast } from 'sonner'

interface TransactionFilters {
  accountId?: string
  categoryId?: string
  type?: string
  startDate?: string
  endDate?: string
  search?: string
  minAmount?: number
  maxAmount?: number
  limit?: number
  offset?: number
}

export function useTransactions(filters: TransactionFilters = {}) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select(TRANSACTION_LIST_SELECT)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters.accountId) query = query.eq('account_id', filters.accountId)
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
      if (filters.type) query = query.eq('type', filters.type)
      if (filters.startDate) query = query.gte('date', filters.startDate)
      if (filters.endDate) query = query.lte('date', filters.endDate)
      if (filters.minAmount !== undefined) query = query.gte('amount', filters.minAmount)
      if (filters.maxAmount !== undefined) query = query.lte('amount', filters.maxAmount)
      if (filters.search) query = query.ilike('description', `%${filters.search}%`)
      if (filters.limit) query = query.limit(filters.limit)
      if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)

      const { data, error } = await query
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export function useCreateTransaction() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (
      tx: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'account' | 'category' | 'transfer_account'>
    ) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('transactions')
        .insert({ ...tx, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as Transaction
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Transaction added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateTransaction() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Transaction> & { id: string }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Transaction
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Transaction updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteTransaction() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Transaction deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useBulkCreateTransactions() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (
      transactions: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'account' | 'category' | 'transfer_account'>[]
    ) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const rows = transactions.map((tx) => ({ ...tx, user_id: user.id }))
      const { data, error } = await supabase.from('transactions').insert(rows).select()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      toast.success(`Imported ${data.length} transactions`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
