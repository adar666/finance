'use client'

import { useCallback, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { format } from 'date-fns'
import {
  Plus,
  PiggyBank,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from '@/lib/hooks/use-budgets'
import { useCategories } from '@/lib/hooks/use-categories'
import { useTransactions } from '@/lib/hooks/use-transactions'
import { useCurrency } from '@/lib/hooks/use-currency'
import { formatCurrency } from '@/lib/utils/currency'
import {
  formatMonthYear,
  getCurrentMonthRange,
  subMonths,
  addMonths,
  startOfMonth,
  endOfMonth,
} from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import {
  sumSpentByCategory,
  effectiveMonthlyBudgetAmount,
  isBudgetActiveInSelectedMonth,
} from '@/lib/utils/budget-health'
import { selectItemsFromMap, selectItemsWithNoneCategories } from '@/lib/utils/select-items'
import { getCategoryDisplayName } from '@/lib/utils/category-display-name'
import type { Budget, BudgetPeriod, Category } from '@/types/database'

const NONE = '__none__'

function progressBarClass(ratioPercent: number): string {
  if (ratioPercent > 100) {
    return '[&_[data-slot=progress-indicator]]:bg-red-500'
  }
  if (ratioPercent >= 80) {
    return '[&_[data-slot=progress-indicator]]:bg-amber-500'
  }
  return '[&_[data-slot=progress-indicator]]:bg-emerald-500'
}

export default function BudgetsPage() {
  const t = useTranslations()
  const locale = useLocale()
  const currency = useCurrency()

  const BUDGET_PERIOD_SELECT_ITEMS = useMemo(
    () =>
      selectItemsFromMap(['monthly', 'yearly'], {
        monthly: t('common.monthly'),
        yearly: t('common.yearly'),
      }),
    [t]
  )

  const [selectedMonth, setSelectedMonth] = useState(() =>
    startOfMonth(getCurrentMonthRange().start)
  )

  const { start: rangeStart, startDate, endDate } = useMemo(() => {
    const start = startOfMonth(selectedMonth)
    const end = endOfMonth(selectedMonth)
    return {
      start,
      end,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    }
  }, [selectedMonth])

  const {
    data: budgets = [],
    isLoading: budgetsLoading,
    isError: budgetsError,
    error: budgetsErr,
  } = useBudgets()
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()
  const {
    data: transactions = [],
    isLoading: txsLoading,
    isError: txsError,
    error: txsErr,
  } = useTransactions({
    startDate,
    endDate,
    type: 'expense',
  })

  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()

  const spentByCategory = useMemo(() => sumSpentByCategory(transactions), [transactions])

  const expenseCategories = useMemo(
    () => categories.filter((c): c is Category => c.type === 'expense'),
    [categories]
  )

  const activeBudgets = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth)
    return budgets.filter((b) => isBudgetActiveInSelectedMonth(b, monthStart))
  }, [budgets, selectedMonth])

  const rows = useMemo(() => {
    return activeBudgets.map((b) => {
      const cap = effectiveMonthlyBudgetAmount(b)
      const spent = spentByCategory.get(b.category_id) ?? 0
      const remaining = cap - spent
      const ratio = cap > 0 ? (spent / cap) * 100 : 0
      const displayPct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0
      return { budget: b, cap, spent, remaining, ratio, displayPct }
    })
  }, [activeBudgets, spentByCategory])

  const totals = useMemo(() => {
    let totalBudget = 0
    let totalSpent = 0
    for (const r of rows) {
      totalBudget += r.cap
      totalSpent += r.spent
    }
    return {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
    }
  }, [rows])

  const anyOver = rows.some((r) => r.spent > r.cap)
  const summaryOnTrack = !anyOver && rows.length > 0

  const [addOpen, setAddOpen] = useState(false)
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formPeriod, setFormPeriod] = useState<BudgetPeriod>('monthly')

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editPeriod, setEditPeriod] = useState<BudgetPeriod>('monthly')
  const [deleteBudgetOpen, setDeleteBudgetOpen] = useState(false)
  const [pendingBudgetDeleteId, setPendingBudgetDeleteId] = useState<string | null>(null)

  const resetAddForm = useCallback(() => {
    setFormCategoryId('')
    setFormAmount('')
    setFormPeriod('monthly')
  }, [])

  const categoriesAvailableForNewBudget = useMemo(() => {
    const used = new Set(budgets.map((b) => b.category_id))
    return expenseCategories.filter((c) => !used.has(c.id))
  }, [expenseCategories, budgets])

  const newBudgetCategoryItems = useMemo(
    () => selectItemsWithNoneCategories(NONE, '—', categoriesAvailableForNewBudget, locale),
    [categoriesAvailableForNewBudget, locale]
  )

  function openEdit(b: Budget) {
    setEditing(b)
    setEditAmount(String(b.amount))
    setEditPeriod(b.period)
    setEditOpen(true)
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(formAmount.replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0 || !formCategoryId) return
    createBudget.mutate(
      {
        category_id: formCategoryId,
        amount,
        period: formPeriod,
        start_date: format(rangeStart, 'yyyy-MM-dd'),
      },
      {
        onSuccess: () => {
          setAddOpen(false)
          resetAddForm()
        },
      }
    )
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    const amount = parseFloat(editAmount.replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) return
    updateBudget.mutate(
      { id: editing.id, amount, period: editPeriod },
      {
        onSuccess: () => {
          setEditOpen(false)
          setEditing(null)
        },
      }
    )
  }

  function openDeleteBudgetConfirm(id: string) {
    setPendingBudgetDeleteId(id)
    setDeleteBudgetOpen(true)
  }

  function closeDeleteBudgetConfirm() {
    setDeleteBudgetOpen(false)
    setPendingBudgetDeleteId(null)
  }

  function confirmDeleteBudget() {
    if (!pendingBudgetDeleteId) return
    deleteBudget.mutate(pendingBudgetDeleteId, {
      onSettled: () => {
        closeDeleteBudgetConfirm()
      },
    })
  }

  const loading = budgetsLoading || txsLoading
  const listError = budgetsError || txsError

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('budgets.title')}
        description={t('budgets.description')}
      >
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={() => setAddOpen(true)}
          disabled={categoriesAvailableForNewBudget.length === 0 && !categoriesLoading}
        >
          <Plus className="size-4" />
          {t('budgets.addBudget')}
        </Button>
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o)
            if (!o) resetAddForm()
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('budgets.newBudget')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('common.category')}</Label>
                <Select
                  value={formCategoryId || NONE}
                  onValueChange={(v) => setFormCategoryId(v == null || v === NONE ? '' : v)}
                  disabled={categoriesLoading}
                  items={newBudgetCategoryItems}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        categoriesAvailableForNewBudget.length === 0
                          ? t('budgets.allCategoriesUsed')
                          : t('budgets.selectExpenseCategory')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {categoriesAvailableForNewBudget.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {getCategoryDisplayName(c, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-amount">{t('budgets.amountLabel', { currency })}</Label>
                <Input
                  id="budget-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('budgets.budgetHelper')}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t('budgets.period')}</Label>
                <Select
                  value={formPeriod}
                  onValueChange={(v) => v && setFormPeriod(v as BudgetPeriod)}
                  items={BUDGET_PERIOD_SELECT_ITEMS}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t('common.monthly')}</SelectItem>
                    <SelectItem value="yearly">{t('common.yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createBudget.isPending ||
                    !formCategoryId ||
                    categoriesAvailableForNewBudget.length === 0
                  }
                  className="gap-1.5"
                >
                  {createBudget.isPending && <Loader2 className="size-4 animate-spin" />}
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('budgets.editBudget')}</DialogTitle>
            </DialogHeader>
            {editing && (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {editing.category
                    ? getCategoryDisplayName(editing.category, locale)
                    : t('common.category')}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="edit-budget-amount">{t('budgets.amountLabel', { currency })}</Label>
                  <Input
                    id="edit-budget-amount"
                    inputMode="decimal"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('budgets.period')}</Label>
                  <Select
                    value={editPeriod}
                    onValueChange={(v) => v && setEditPeriod(v as BudgetPeriod)}
                    items={BUDGET_PERIOD_SELECT_ITEMS}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{t('common.monthly')}</SelectItem>
                      <SelectItem value="yearly">{t('common.yearly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={updateBudget.isPending} className="gap-1.5">
                    {updateBudget.isPending && <Loader2 className="size-4 animate-spin" />}
                    {t('common.save')}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <div className="flex items-center gap-2 rtl:flex-row-reverse">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label={t('budgets.previousMonth')}
            onClick={() => setSelectedMonth((d) => startOfMonth(subMonths(d, 1)))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-[200px] text-center">
            <p className="text-lg font-semibold tracking-tight">{formatMonthYear(selectedMonth)}</p>
            <p className="text-xs text-muted-foreground">{t('budgets.budgetMonth')}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label={t('budgets.nextMonth')}
            onClick={() => setSelectedMonth((d) => startOfMonth(addMonths(d, 1)))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {listError && (
        <p className="text-sm text-destructive" role="alert">
          {budgetsErr instanceof Error
            ? budgetsErr.message
            : txsErr instanceof Error
              ? txsErr.message
              : t('budgets.failedToLoad')}
        </p>
      )}

      {anyOver && rows.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
          role="status"
        >
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium text-foreground">{t('budgets.overBudgetTitle')}</p>
            <p className="mt-0.5 text-muted-foreground">
              {t('budgets.overBudgetMessage', { month: formatMonthYear(selectedMonth) })}
            </p>
          </div>
        </div>
      )}

      {summaryOnTrack && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="font-medium text-foreground">{t('budgets.onTrack')}</p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{t('budgets.monthSummary')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t('budgets.totalBudget')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {loading ? '…' : formatCurrency(totals.totalBudget, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t('budgets.totalSpent')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
              {loading ? '…' : formatCurrency(totals.totalSpent, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t('budgets.remaining')}</p>
            <p
              className={cn(
                'mt-1 text-lg font-semibold tabular-nums',
                totals.totalRemaining >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {loading ? '…' : formatCurrency(totals.totalRemaining, currency)}
            </p>
          </div>
        </CardContent>
      </Card>

      {loading && rows.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-2 w-full rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <PiggyBank className="size-7 text-muted-foreground" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="font-semibold">{t('budgets.noBudgetsForMonth')}</p>
              <p className="text-sm text-muted-foreground">
                {budgets.length === 0
                  ? t('budgets.noBudgetsHint')
                  : t('budgets.noBudgetsStarted')}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => setAddOpen(true)}
              disabled={categoriesAvailableForNewBudget.length === 0 && !categoriesLoading}
            >
              <Plus className="size-4" />
              {t('budgets.addBudget')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ budget: b, cap, spent, remaining, ratio, displayPct }) => {
            const cat = b.category
            const over = spent > cap
            return (
              <Card key={b.id} className={cn(over && 'border-red-500/40')}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cat?.color ?? 'hsl(var(--muted-foreground))' }}
                      aria-hidden
                    />
                    <CardTitle className="truncate text-base font-semibold">
                      {cat ? getCategoryDisplayName(cat, locale) : t('common.category')}
                    </CardTitle>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      aria-label={t('budgets.editBudgetAriaLabel')}
                      onClick={() => openEdit(b)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t('budgets.deleteBudgetAriaLabel')}
                      disabled={deleteBudget.isPending}
                      onClick={() => openDeleteBudgetConfirm(b.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-normal capitalize">
                      {b.period}
                    </Badge>
                    {over && (
                      <Badge variant="destructive" className="gap-1 font-normal">
                        <AlertTriangle className="size-3" />
                        {t('budgets.overBudgetTitle')}
                      </Badge>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{t('budgets.budget')}</dt>
                      <dd className="font-medium tabular-nums">{formatCurrency(cap, currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('budgets.spent')}</dt>
                      <dd className="font-medium tabular-nums text-red-600 dark:text-red-400">
                        {formatCurrency(spent, currency)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">{t('budgets.remaining')}</dt>
                      <dd
                        className={cn(
                          'font-medium tabular-nums',
                          remaining >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {formatCurrency(remaining, currency)}
                      </dd>
                    </div>
                  </dl>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t('common.progress')}</span>
                      <span className="tabular-nums">{ratio.toFixed(0)}%</span>
                    </div>
                    <Progress
                      value={displayPct}
                      className={cn('w-full', progressBarClass(ratio))}
                    />
                  </div>

                  {over && (
                    <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      {t('budgets.overLimit', { amount: formatCurrency(spent - cap, currency) })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={deleteBudgetOpen}
        onOpenChange={(open) => {
          if (!open && !deleteBudget.isPending) closeDeleteBudgetConfirm()
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!deleteBudget.isPending}>
          <DialogHeader>
            <DialogTitle>{t('budgets.deleteDialogTitle')}</DialogTitle>
            <DialogDescription>{t('budgets.deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteBudgetConfirm}
              disabled={deleteBudget.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-1.5"
              onClick={confirmDeleteBudget}
              disabled={deleteBudget.isPending}
            >
              {deleteBudget.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
