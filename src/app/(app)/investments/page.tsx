'use client'

import { useMemo, useState, useCallback, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from 'recharts'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Pencil,
  Trash2,
  RefreshCw,
  DollarSign,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { formatCurrency, formatPercent } from '@/lib/utils/currency'
import {
  useInvestments,
  useCreateInvestment,
  useUpdateInvestment,
  useDeleteInvestment,
} from '@/lib/hooks/use-investments'
import { useCurrency } from '@/lib/hooks/use-currency'
import type { Investment, InvestmentType } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { selectItemsFromMap } from '@/lib/utils/select-items'

const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
] as const

const INVESTMENT_TYPES: InvestmentType[] = ['stock', 'etf', 'crypto', 'bond', 'other']


const CURRENCY_OPTIONS = ['USD', 'ILS', 'EUR'] as const

function positionValue(inv: Investment): number {
  return inv.shares * inv.current_price
}

function gainLoss(inv: Investment): number {
  return positionValue(inv) - inv.cost_basis
}

function gainLossPercent(inv: Investment): number | null {
  if (inv.cost_basis === 0) return null
  return ((positionValue(inv) - inv.cost_basis) / inv.cost_basis) * 100
}

function portfolioPercent(totalValue: number, totalCost: number): number | null {
  if (totalCost === 0) return null
  return ((totalValue - totalCost) / totalCost) * 100
}

type CurrencyRollup = { currency: string; value: number; cost: number }

function rollupByCurrency(investments: Investment[], defaultCurrency: string): CurrencyRollup[] {
  const map = new Map<string, { value: number; cost: number }>()
  for (const inv of investments) {
    const v = positionValue(inv)
    const cur = inv.currency || defaultCurrency
    const prev = map.get(cur) ?? { value: 0, cost: 0 }
    map.set(cur, {
      value: prev.value + v,
      cost: prev.cost + inv.cost_basis,
    })
  }
  return Array.from(map.entries())
    .map(([currency, { value, cost }]) => ({ currency, value, cost }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

type InvestmentFormState = {
  symbol: string
  name: string
  type: InvestmentType
  shares: string
  cost_basis: string
  current_price: string
  currency: string
}

const DEFAULT_FORM: InvestmentFormState = {
  symbol: '',
  name: '',
  type: 'stock',
  shares: '0',
  cost_basis: '0',
  current_price: '0',
  currency: 'USD',
}

function parseDecimal(value: string): number {
  const n = Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function investmentToForm(inv: Investment): InvestmentFormState {
  return {
    symbol: inv.symbol,
    name: inv.name,
    type: inv.type,
    shares: String(inv.shares),
    cost_basis: String(inv.cost_basis),
    current_price: String(inv.current_price),
    currency: inv.currency,
  }
}

function formToPayload(form: InvestmentFormState) {
  return {
    symbol: form.symbol.trim().toUpperCase(),
    name: form.name.trim(),
    type: form.type,
    shares: parseDecimal(form.shares),
    cost_basis: parseDecimal(form.cost_basis),
    current_price: parseDecimal(form.current_price),
    currency: form.currency,
    price_updated_at: new Date().toISOString(),
  }
}

type PieDatum = {
  name: string
  value: number
  currency: string
  fill: string
}

function InvestmentsPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[320px] max-w-xl rounded-xl" />
    </div>
  )
}

type AmountRow = { currency: string; value: number }

function SummaryAmounts({
  rows,
  className,
  valueClassName,
}: {
  rows: AmountRow[]
  className?: string
  valueClassName?: string
}) {
  if (rows.length === 0) {
    return <span className={cn('text-muted-foreground tabular-nums', className)}>—</span>
  }
  if (rows.length === 1) {
    const r = rows[0]
    return (
      <span className={cn('text-2xl font-bold tabular-nums tracking-tight', valueClassName, className)}>
        {formatCurrency(r.value, r.currency)}
      </span>
    )
  }
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {rows.map((r) => (
        <span key={r.currency} className={cn('text-lg font-semibold tabular-nums', valueClassName)}>
          {formatCurrency(r.value, r.currency)}
        </span>
      ))}
    </div>
  )
}

function SummaryGainLoss({ rollups }: { rollups: CurrencyRollup[] }) {
  if (rollups.length === 0) {
    return <span className="text-muted-foreground tabular-nums">—</span>
  }
  return (
    <div className="flex flex-col gap-1">
      {rollups.map((r) => {
        const gl = r.value - r.cost
        const positive = gl >= 0
        return (
          <span
            key={r.currency}
            className={cn(
              'text-lg font-semibold tabular-nums',
              positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            )}
          >
            {positive ? '+' : ''}
            {formatCurrency(gl, r.currency)}
          </span>
        )
      })}
    </div>
  )
}

function SummaryPercents({ rollups }: { rollups: CurrencyRollup[] }) {
  if (rollups.length === 0) {
    return <span className="text-muted-foreground tabular-nums">—</span>
  }
  return (
    <div className="flex flex-col gap-1">
      {rollups.map((r) => {
        const pct = portfolioPercent(r.value, r.cost)
        if (pct === null) {
          return (
            <span key={r.currency} className="text-lg font-semibold tabular-nums text-muted-foreground">
              —
            </span>
          )
        }
        const positive = pct >= 0
        return (
          <span
            key={r.currency}
            className={cn(
              'text-lg font-semibold tabular-nums',
              positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            )}
          >
            {formatPercent(pct)}
          </span>
        )
      })}
    </div>
  )
}

function InvestmentFormFields({
  form,
  onChange,
  costBasisLabel,
  t,
  typeLabels,
  typeSelectItems,
}: {
  form: InvestmentFormState
  onChange: (next: InvestmentFormState) => void
  costBasisLabel: string
  t: ReturnType<typeof useTranslations>
  typeLabels: Record<InvestmentType, string>
  typeSelectItems: ReturnType<typeof selectItemsFromMap>
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="inv-symbol">{t('investments.symbol')}</Label>
          <Input
            id="inv-symbol"
            value={form.symbol}
            onChange={(e) => onChange({ ...form, symbol: e.target.value })}
            placeholder={t('investments.symbolPlaceholder')}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inv-type">{t('common.type')}</Label>
          <Select
            value={form.type}
            onValueChange={(v) => onChange({ ...form, type: v as InvestmentType })}
            items={typeSelectItems}
          >
            <SelectTrigger id="inv-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVESTMENT_TYPES.map((tp) => (
                <SelectItem key={tp} value={tp}>
                  {typeLabels[tp]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="inv-name">{t('common.name')}</Label>
        <Input
          id="inv-name"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder={t('investments.namePlaceholder')}
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="inv-shares">{t('investments.shares')}</Label>
          <Input
            id="inv-shares"
            type="number"
            inputMode="decimal"
            step="any"
            value={form.shares}
            onChange={(e) => onChange({ ...form, shares: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inv-currency">{t('settings.currency')}</Label>
          <Select
            value={form.currency}
            onValueChange={(v) => onChange({ ...form, currency: v ?? form.currency })}
          >
            <SelectTrigger id="inv-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="inv-cost-basis">{costBasisLabel}</Label>
        <Input
          id="inv-cost-basis"
          type="number"
          inputMode="decimal"
          step="any"
          value={form.cost_basis}
          onChange={(e) => onChange({ ...form, cost_basis: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="inv-price">{t('investments.currentPrice')}</Label>
        <Input
          id="inv-price"
          type="number"
          inputMode="decimal"
          step="any"
          value={form.current_price}
          onChange={(e) => onChange({ ...form, current_price: e.target.value })}
        />
      </div>
    </div>
  )
}

export default function InvestmentsPage() {
  const t = useTranslations()
  const currency = useCurrency()

  const TYPE_LABELS: Record<InvestmentType, string> = useMemo(
    () => ({
      stock: t('investments.stock'),
      etf: t('investments.etf'),
      crypto: t('investments.crypto'),
      bond: t('investments.bond'),
      other: t('investments.other'),
    }),
    [t]
  )

  const INVESTMENT_TYPE_SELECT_ITEMS = useMemo(
    () => selectItemsFromMap(INVESTMENT_TYPES, TYPE_LABELS),
    [TYPE_LABELS]
  )

  const { data: investments = [], isPending, isError, error } = useInvestments()
  const createMut = useCreateInvestment()
  const updateMut = useUpdateInvestment()
  const deleteMut = useDeleteInvestment()

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [deleting, setDeleting] = useState<Investment | null>(null)
  const [addForm, setAddForm] = useState<InvestmentFormState>(DEFAULT_FORM)
  const [editForm, setEditForm] = useState<InvestmentFormState>(DEFAULT_FORM)

  const rollups = useMemo(
    () => rollupByCurrency(investments, currency),
    [investments, currency]
  )

  const pieData: PieDatum[] = useMemo(() => {
    return investments
      .map((inv, i) => ({
        name: inv.symbol.trim() || inv.name,
        value: positionValue(inv),
        currency: inv.currency || currency,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .filter((d) => d.value > 0)
  }, [investments, currency])

  const mixedCurrencies = useMemo(() => {
    const set = new Set(investments.map((i) => i.currency || currency))
    return set.size > 1
  }, [investments, currency])

  const resetAddForm = useCallback(() => setAddForm(DEFAULT_FORM), [])

  const openEdit = useCallback((inv: Investment) => {
    setEditing(inv)
    setEditForm(investmentToForm(inv))
    setEditOpen(true)
  }, [])

  const openDelete = useCallback((inv: Investment) => {
    setDeleting(inv)
    setDeleteOpen(true)
  }, [])

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    const payload = formToPayload(addForm)
    if (!payload.symbol || !payload.name) return

    createMut.mutate(
      {
        ...payload,
        price_updated_at: payload.current_price > 0 ? payload.price_updated_at : null,
      },
      {
        onSuccess: () => {
          setAddOpen(false)
          resetAddForm()
        },
      }
    )
  }

  const handleUpdate = (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    const payload = formToPayload(editForm)
    if (!payload.symbol || !payload.name) return

    updateMut.mutate(
      {
        id: editing.id,
        ...payload,
        price_updated_at: payload.current_price > 0 ? payload.price_updated_at : null,
      },
      {
        onSuccess: () => {
          setEditOpen(false)
          setEditing(null)
        },
      }
    )
  }

  const handleDeleteConfirm = () => {
    if (!deleting) return
    deleteMut.mutate(deleting.id, {
      onSuccess: () => {
        setDeleteOpen(false)
        setDeleting(null)
      },
    })
  }

  const handleRefreshPrices = async () => {
    const now = new Date().toISOString()
    await Promise.all(
      investments.map((inv) =>
        updateMut.mutateAsync({ id: inv.id, price_updated_at: now })
      )
    )
  }

  if (isPending) {
    return (
      <>
        <PageHeader title={t('investments.title')} description={t('investments.description')} />
        <InvestmentsPageSkeleton />
      </>
    )
  }

  if (isError) {
    return (
      <>
        <PageHeader title={t('investments.title')} description={t('investments.description')} />
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : t('investments.couldNotLoad')}
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const isEmpty = investments.length === 0

  return (
    <>
      <PageHeader title={t('investments.title')} description={t('investments.description')}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isEmpty || updateMut.isPending}
            onClick={() => void handleRefreshPrices()}
          >
            <RefreshCw className={cn('h-4 w-4', updateMut.isPending && 'animate-spin')} />
            {t('investments.refreshPrices')}
          </Button>
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open)
              if (!open) resetAddForm()
            }}
          >
            <DialogTrigger
              render={
                <Button type="button" size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  {t('investments.addPosition')}
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md" showCloseButton>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>{t('investments.addPosition')}</DialogTitle>
                  <DialogDescription>
                    {t('investments.addDescription')}
                  </DialogDescription>
                </DialogHeader>
                <InvestmentFormFields
                  form={addForm}
                  onChange={setAddForm}
                  costBasisLabel={t('investments.costBasis')}
                  t={t}
                  typeLabels={TYPE_LABELS}
                  typeSelectItems={INVESTMENT_TYPE_SELECT_ITEMS}
                />
                <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddOpen(false)}
                    disabled={createMut.isPending}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMut.isPending || !addForm.symbol.trim() || !addForm.name.trim()
                    }
                  >
                    {createMut.isPending ? t('common.saving') : t('investments.addPosition')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {!isEmpty && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" aria-hidden />
                {t('investments.portfolioValue')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SummaryAmounts rows={rollups.map((r) => ({ currency: r.currency, value: r.value }))} />
              <p className="mt-2 text-xs text-muted-foreground">{t('investments.portfolioValueHint')}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('investments.totalCostBasis')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SummaryAmounts rows={rollups.map((r) => ({ currency: r.currency, value: r.cost }))} />
              <p className="mt-2 text-xs text-muted-foreground">{t('investments.totalCostBasisHint')}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('investments.totalGainLoss')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SummaryGainLoss rollups={rollups} />
              <p className="mt-2 text-xs text-muted-foreground">{t('investments.totalGainLossHint')}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('investments.return')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SummaryPercents rollups={rollups} />
              <p className="mt-2 text-xs text-muted-foreground">
                {t('investments.returnHint')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!isEmpty && (
        <Card className="border-border/80 shadow-sm mb-8 max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" aria-hidden />
              {t('investments.allocation')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('investments.allocationHint')}
              {mixedCurrencies && (
                <span className="block mt-1 text-amber-600/90 dark:text-amber-400/90">
                  {t('investments.mixedCurrencies')}
                </span>
              )}
            </p>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                {t('investments.noPositionValue')}
              </p>
            ) : (
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={`${entry.name}-${i}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RTooltip
                      formatter={(value, _name, item) => {
                        const payload = item?.payload as PieDatum | undefined
                        const cur = payload?.currency ?? currency
                        if (value === undefined || value === null) {
                          return ['—', t('common.value')]
                        }
                        const v = typeof value === 'number' ? value : Number(value)
                        if (Number.isNaN(v)) {
                          return ['—', t('common.value')]
                        }
                        return [formatCurrency(v, cur), t('common.value')]
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <TrendingUp className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="font-medium">{t('investments.noPositions')}</p>
              <p className="text-sm text-muted-foreground">
                {t('investments.noPositionsHint')}
              </p>
            </div>
            <Button
              className="gap-1.5"
              onClick={() => {
                resetAddForm()
                setAddOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              {t('investments.addPosition')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>{t('investments.holdings')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('investments.holdingsHint')}</p>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('investments.symbol')}</TableHead>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead className="text-end">{t('investments.shares')}</TableHead>
                    <TableHead className="text-end">{t('investments.costBasis')}</TableHead>
                    <TableHead className="text-end">{t('investments.price')}</TableHead>
                    <TableHead className="text-end">{t('common.value')}</TableHead>
                    <TableHead className="text-end">{t('investments.gainLoss')}</TableHead>
                    <TableHead className="w-[100px] text-end">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((inv) => {
                    const val = positionValue(inv)
                    const gl = gainLoss(inv)
                    const glPct = gainLossPercent(inv)
                    const glPositive = gl >= 0
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono font-medium">{inv.symbol}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{inv.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-normal">
                            {TYPE_LABELS[inv.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{inv.shares}</TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatCurrency(inv.cost_basis, inv.currency)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatCurrency(inv.current_price, inv.currency)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums font-medium">
                          {formatCurrency(val, inv.currency)}
                        </TableCell>
                        <TableCell className="text-end">
                          <div
                            className={cn(
                              'flex flex-col items-end gap-0.5 tabular-nums',
                              glPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            )}
                          >
                            <span className="inline-flex items-center gap-1">
                              {glPositive ? (
                                <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              )}
                              {glPositive ? '+' : ''}
                              {formatCurrency(gl, inv.currency)}
                            </span>
                            {glPct === null ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <span className="text-xs">{formatPercent(glPct)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => openEdit(inv)}
                              aria-label={`Edit ${inv.symbol}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => openDelete(inv)}
                              aria-label={`Delete ${inv.symbol}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>{t('investments.editPosition')}</DialogTitle>
              <DialogDescription>{t('investments.editPositionHint', { symbol: editing?.symbol ?? '' })}</DialogDescription>
            </DialogHeader>
            <InvestmentFormFields
              form={editForm}
              onChange={setEditForm}
              costBasisLabel={t('investments.costBasis')}
              t={t}
              typeLabels={TYPE_LABELS}
              typeSelectItems={INVESTMENT_TYPE_SELECT_ITEMS}
            />
            <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={updateMut.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={
                  updateMut.isPending || !editForm.symbol.trim() || !editForm.name.trim()
                }
              >
                {updateMut.isPending ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeleting(null)
        }}
      >
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <DialogHeader>
            <DialogTitle>{t('investments.deletePositionTitle')}</DialogTitle>
            <DialogDescription>
              {t('investments.deletePositionMessage', { symbol: deleting?.symbol ?? '', name: deleting?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteMut.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
