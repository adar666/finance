'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { format } from 'date-fns'
import { useCreateTransaction } from '@/lib/hooks/use-transactions'
import { useAccounts } from '@/lib/hooks/use-accounts'
import { useCategories } from '@/lib/hooks/use-categories'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { TransactionType } from '@/types/database'
import { getCategoryDisplayName } from '@/lib/utils/category-display-name'

export function QuickAddFAB() {
  const t = useTranslations()
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<TransactionType>('expense')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const amountRef = useRef<HTMLInputElement>(null)

  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const createTx = useCreateTransaction()

  const filteredCategories = categories.filter((c) => c.type === type)

  const reset = useCallback(() => {
    setAmount('')
    setType('expense')
    setCategoryId('')
    setDescription('')
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => amountRef.current?.focus(), 100)
    }
  }, [open])

  function handleSave() {
    const num = parseFloat(amount)
    if (!num || num <= 0) return
    const account = accounts[0]
    if (!account) return

    createTx.mutate(
      {
        account_id: account.id,
        category_id: categoryId || null,
        amount: num,
        type,
        description: description.trim() || t('quickAdd.quickExpense'),
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: null,
        transfer_to_account_id: null,
        recurring_rule_id: null,
      },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
      }
    )
  }

  return (
    <>
      <button
        type="button"
        className="md:hidden fixed bottom-20 end-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        onClick={() => setOpen(true)}
        aria-label={t('quickAdd.title')}
      >
        <Plus className="size-6" />
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) reset()
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t('quickAdd.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('quickAdd.amount')}</Label>
              <Input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-2xl h-14 text-center font-semibold"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={type === 'expense' ? 'default' : 'outline'}
                className={cn('flex-1', type === 'expense' && 'bg-red-600 hover:bg-red-700 text-white')}
                onClick={() => { setType('expense'); setCategoryId('') }}
              >
                {t('common.expense')}
              </Button>
              <Button
                type="button"
                variant={type === 'income' ? 'default' : 'outline'}
                className={cn('flex-1', type === 'income' && 'bg-emerald-600 hover:bg-emerald-700 text-white')}
                onClick={() => { setType('income'); setCategoryId('') }}
              >
                {t('common.income')}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>{t('quickAdd.category')}</Label>
              <Select
                value={categoryId || '__none__'}
                onValueChange={(v) => setCategoryId(v === '__none__' ? '' : (v ?? ''))}
                items={[
                  { value: '__none__', label: t('common.none') },
                  ...filteredCategories.map((c) => ({
                    value: c.id,
                    label: getCategoryDisplayName(c, locale),
                  })),
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('common.none')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('common.none')}</SelectItem>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {getCategoryDisplayName(c, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('common.description')}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('quickAdd.descriptionPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full gap-1.5"
              disabled={!amount || parseFloat(amount) <= 0 || accounts.length === 0 || createTx.isPending}
              onClick={handleSave}
            >
              {createTx.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('quickAdd.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
