'use client'

import { useMemo } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Cell,
  ComposedChart,
  ReferenceLine,
} from 'recharts'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useTransactions } from '@/lib/hooks/use-transactions'
import { useCategories } from '@/lib/hooks/use-categories'
import { useCurrency } from '@/lib/hooks/use-currency'
import { formatCurrency, formatCompact, formatPercent } from '@/lib/utils/currency'
import type { Category, Transaction } from '@/types/database'

const CHART_PALETTE = [
  '#2dd4bf',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#3b82f6',
  '#f97316',
]

const TOOLTIP_STYLE = {
  borderRadius: '0.5rem',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--card)',
  color: 'var(--card-foreground)',
} as const

const UNCATEGORIZED_ID = '__uncategorized__'
/** Stacked bars: top N categories + "Other" — readable vs one line per category */
const TOP_STACKED_SLICES = 6

function monthKeysDescending(count: number, now: Date): string[] {
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    keys.push(format(startOfMonth(subMonths(now, i)), 'yyyy-MM'))
  }
  return keys
}

function categoryNameForId(
  id: string,
  categories: Category[],
  fallbackIndex: number
): { name: string; color: string } {
  if (id === UNCATEGORIZED_ID) {
    return { name: 'Uncategorized', color: CHART_PALETTE[CHART_PALETTE.length - 1] }
  }
  const c = categories.find((x) => x.id === id)
  return {
    name: c?.name ?? 'Category',
    color: c?.color ?? CHART_PALETTE[fallbackIndex % CHART_PALETTE.length],
  }
}

type StackedSeries = { dataKey: string; name: string; color: string }

type StackedCategoryTooltipProps = {
  active?: boolean
  payload?: ReadonlyArray<{
    name?: string | number
    value?: unknown
    color?: string
    dataKey?: string | number
  }>
  label?: string | number
  series: StackedSeries[]
  currency: string
}

function ChartCardSkeleton() {
  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[260px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function StackedCategoryTooltip({
  active,
  payload,
  label,
  series,
  currency,
}: StackedCategoryTooltipProps) {
  if (!active || !payload?.length) return null
  const labelStr = label != null ? String(label) : ''
  const metaByKey = new Map(series.map((s) => [s.dataKey, s]))
  const rows = payload
    .map((p) => ({
      key: String(p.dataKey ?? ''),
      value: typeof p.value === 'number' ? p.value : Number(p.value) || 0,
      color: p.color as string,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
  const total = rows.reduce((s, r) => s + r.value, 0)
  if (rows.length === 0) return null

  return (
    <div
      className="rounded-lg border bg-card px-3 py-2 text-card-foreground shadow-md"
      style={TOOLTIP_STYLE}
    >
      <p className="mb-2 border-b border-border pb-1 text-xs font-medium">{labelStr}</p>
      <ScrollArea className="max-h-[min(16rem,40vh)] pr-2">
        <ul className="space-y-1.5 text-xs">
          {rows.map((r) => {
            const m = metaByKey.get(r.key)
            const name = m?.name ?? r.key
            return (
              <li key={r.key} className="flex items-center justify-between gap-4">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: m?.color ?? r.color }}
                  />
                  <span className="truncate">{name}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatCurrency(r.value, currency)}</span>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
      <p className="mt-2 border-t border-border pt-1.5 text-xs font-medium tabular-nums">
        Total {formatCurrency(total, currency)}
      </p>
    </div>
  )
}

export default function AnalyticsPage() {
  const currency = useCurrency()
  const periodKey = format(startOfMonth(new Date()), 'yyyy-MM')

  const txFilters = useMemo(() => {
    const now = new Date()
    return {
      startDate: format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
      limit: 15_000,
    }
  }, [periodKey])

  const { data: transactions = [], isLoading: txsLoading } = useTransactions(txFilters)
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()

  const expenseCategories = useMemo(
    () => categories.filter((c: Category) => c.type === 'expense'),
    [categories]
  )

  const last12MonthKeys = useMemo(() => monthKeysDescending(12, new Date()), [periodKey])

  const monthlyIncomeExpense = useMemo(() => {
    const incomeByMonth = new Map<string, number>()
    const expenseByMonth = new Map<string, number>()
    for (const key of last12MonthKeys) {
      incomeByMonth.set(key, 0)
      expenseByMonth.set(key, 0)
    }
    for (const t of transactions as Transaction[]) {
      const key = t.date.slice(0, 7)
      if (!incomeByMonth.has(key)) continue
      if (t.type === 'income') incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + t.amount)
      else if (t.type === 'expense') expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + t.amount)
    }
    return last12MonthKeys.map((monthKey) => {
      const income = incomeByMonth.get(monthKey) ?? 0
      const expenses = expenseByMonth.get(monthKey) ?? 0
      const net = income - expenses
      const savingsRatePct = income > 0 ? (net / income) * 100 : null
      return {
        label: format(new Date(`${monthKey}-01T12:00:00`), 'MMM yy'),
        monthKey,
        income,
        expenses,
        net,
        savingsRatePct,
      }
    })
  }, [transactions, last12MonthKeys])

  const last6MonthKeys = useMemo(() => monthKeysDescending(6, new Date()), [periodKey])

  /** Top N expense category ids by total spend in the last 6 months → stacked bars + Other */
  const { stackedSeries, stackedMonthRows } = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of transactions as Transaction[]) {
      if (t.type !== 'expense') continue
      const mk = t.date.slice(0, 7)
      if (!last6MonthKeys.includes(mk)) continue
      const id = t.category_id ?? UNCATEGORIZED_ID
      totals.set(id, (totals.get(id) ?? 0) + t.amount)
    }
    const topIds = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_STACKED_SLICES)
      .map(([id]) => id)
    const topSet = new Set(topIds)

    const series: StackedSeries[] = topIds.map((id, i) => {
      const { name, color } = categoryNameForId(id, expenseCategories, i)
      return { dataKey: `s${i}`, name, color }
    })
    series.push({ dataKey: 'other', name: 'Other categories', color: '#94a3b8' })

    const spendByMonth = new Map<string, Map<string, number>>()
    for (const mk of last6MonthKeys) spendByMonth.set(mk, new Map())
    for (const t of transactions as Transaction[]) {
      if (t.type !== 'expense') continue
      const mk = t.date.slice(0, 7)
      if (!spendByMonth.has(mk)) continue
      const id = t.category_id ?? UNCATEGORIZED_ID
      const m = spendByMonth.get(mk)!
      m.set(id, (m.get(id) ?? 0) + t.amount)
    }

    const rows = last6MonthKeys.map((monthKey) => {
      const row: Record<string, string | number> = {
        label: format(new Date(`${monthKey}-01T12:00:00`), 'MMM yy'),
        monthKey,
      }
      const m = spendByMonth.get(monthKey)!
      let monthTotal = 0
      for (const [, v] of m) monthTotal += v

      let topSum = 0
      topIds.forEach((id, i) => {
        const v = m.get(id) ?? 0
        row[`s${i}`] = v
        topSum += v
      })
      row.other = Math.max(0, monthTotal - topSum)
      return row
    })

    return { stackedSeries: series, stackedMonthRows: rows }
  }, [transactions, expenseCategories, last6MonthKeys])

  /** Pareto / concentration — last 12 months expenses */
  const spendingConcentration = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; total: number }>()
    for (const t of transactions as Transaction[]) {
      if (t.type !== 'expense') continue
      const mk = t.date.slice(0, 7)
      if (!last12MonthKeys.includes(mk)) continue
      const id = t.category_id ?? UNCATEGORIZED_ID
      const { name, color } = categoryNameForId(id, expenseCategories, totals.size)
      const prev = totals.get(id)
      if (prev) prev.total += t.amount
      else totals.set(id, { name, color, total: t.amount })
    }
    const list = Array.from(totals.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total)
    const grand = list.reduce((s, x) => s + x.total, 0)
    let cum = 0
    const withPct = list.map((x) => {
      const pct = grand > 0 ? (x.total / grand) * 100 : 0
      cum += pct
      return { ...x, pct, cumulativePct: cum }
    })
    const top3Share = grand > 0 ? withPct.slice(0, 3).reduce((s, x) => s + x.pct, 0) : 0
    return { rows: withPct, grandTotal: grand, top3SharePct: top3Share }
  }, [transactions, expenseCategories, last12MonthKeys])

  const avgSavingsRate6m = useMemo(() => {
    const last6 = monthlyIncomeExpense.slice(-6)
    const rates = last6
      .map((m) => (m.income > 0 ? (m.net / m.income) * 100 : null))
      .filter((x): x is number => x != null)
    if (rates.length === 0) return null
    return rates.reduce((a, b) => a + b, 0) / rates.length
  }, [monthlyIncomeExpense])

  const topExpenseCategories = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; total: number }>()
    for (const t of transactions as Transaction[]) {
      if (t.type !== 'expense') continue
      const id = t.category_id ?? UNCATEGORIZED_ID
      const name = t.category?.name ?? 'Uncategorized'
      const color =
        t.category?.color ??
        CHART_PALETTE[Math.abs(id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)) % CHART_PALETTE.length]
      const prev = totals.get(id)
      if (prev) prev.total += t.amount
      else totals.set(id, { name, color, total: t.amount })
    }
    const list = Array.from(totals.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
    const max = list[0]?.total ?? 1
    return list.map((row) => ({ ...row, ratio: max > 0 ? Math.round((row.total / max) * 100) : 0 }))
  }, [transactions])

  const chartTooltipFormatter = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value)
    return formatCurrency(Number.isFinite(n) ? n : 0, currency)
  }

  const loading = txsLoading || categoriesLoading

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Cash flow, spending mix, savings rate, and where your money concentrates."
      />

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-1">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
          <ChartCardSkeleton />
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="tracking-tight">Income & expenses by month</CardTitle>
              <p className="text-sm text-muted-foreground">Last 12 months · stacked totals</p>
            </CardHeader>
            <CardContent>
              <div className="h-[min(22rem,55vw)] w-full min-h-[220px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyIncomeExpense} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatCompact(Number(v))}
                      width={44}
                      className="fill-muted-foreground"
                    />
                    <Tooltip formatter={chartTooltipFormatter} contentStyle={TOOLTIP_STYLE} />
                    <Bar
                      dataKey="income"
                      stackId="flow"
                      fill="var(--success)"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={36}
                      name="Income"
                    />
                    <Bar
                      dataKey="expenses"
                      stackId="flow"
                      fill="var(--destructive)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                      name="Expenses"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm bg-[var(--success)]" />
                  Income
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm bg-[var(--destructive)]" />
                  Expenses
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="min-w-0 lg:col-span-2">
              <CardHeader>
                <CardTitle className="tracking-tight">Net cash flow & savings rate</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Bars = income minus expenses · Line = savings rate (% of income saved). Common rule of thumb: aim
                  for a positive, stable trend.
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-[min(20rem,50vw)] w-full min-h-[220px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyIncomeExpense} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => formatCompact(Number(v))}
                        width={44}
                        className="fill-muted-foreground"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `${v}%`}
                        width={40}
                        domain={['auto', 'auto']}
                        className="fill-muted-foreground"
                      />
                      <ReferenceLine yAxisId="left" y={0} stroke="var(--border)" strokeDasharray="4 4" />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, name) => {
                          if (name === 'Savings rate') {
                            const n = typeof value === 'number' ? value : Number(value)
                            return [`${Number.isFinite(n) ? n.toFixed(1) : '—'}%`, name]
                          }
                          const n = typeof value === 'number' ? value : Number(value)
                          return [formatCurrency(Number.isFinite(n) ? n : 0, currency), name]
                        }}
                      />
                      <Bar yAxisId="left" dataKey="net" name="Net flow" maxBarSize={32} radius={[4, 4, 0, 0]}>
                        {monthlyIncomeExpense.map((e) => (
                          <Cell
                            key={e.monthKey}
                            fill={e.net >= 0 ? 'var(--success)' : 'var(--destructive)'}
                            fillOpacity={0.85}
                          />
                        ))}
                      </Bar>
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="savingsRatePct"
                        name="Savings rate"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                        connectNulls={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {avgSavingsRate6m != null && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Trailing 6-month average savings rate:{' '}
                    <span className="font-medium text-foreground tabular-nums">
                      {formatPercent(avgSavingsRate6m, 1)}
                    </span>{' '}
                    of income
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="tracking-tight">Spending concentration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pareto view: how much of total spending sits in your top categories (last 12 months). Helps spot
                  over-reliance on a few buckets.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {spendingConcentration.grandTotal <= 0 ? (
                  <p className="text-sm text-muted-foreground">No expense data in this period yet.</p>
                ) : (
                  <>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                      <span className="text-muted-foreground">Top 3 categories = </span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {spendingConcentration.top3SharePct.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground"> of all expenses</span>
                    </div>
                    <ScrollArea className="h-[min(16rem,40vh)] pr-3">
                      <ul className="space-y-3 text-sm">
                        {spendingConcentration.rows.slice(0, 12).map((row) => (
                          <li key={row.id} className="space-y-1">
                            <div className="flex justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className="size-2 shrink-0 rounded-sm"
                                  style={{ backgroundColor: row.color }}
                                />
                                <span className="truncate font-medium">{row.name}</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {row.pct.toFixed(1)}% · {formatCurrency(row.total, currency)}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, row.pct)}%`, backgroundColor: row.color }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="tracking-tight">Expense trend by category</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Stacked bars: top {TOP_STACKED_SLICES} categories by 6-month spend, plus{' '}
                  <span className="text-foreground">Other</span>. Hover for a scrollable breakdown.
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-[min(22rem,55vw)] w-full min-h-[240px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stackedMonthRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => formatCompact(Number(v))}
                        width={44}
                        className="fill-muted-foreground"
                      />
                      <Tooltip
                        content={(props) => (
                          <StackedCategoryTooltip
                            active={props.active}
                            payload={
                              props.payload as StackedCategoryTooltipProps['payload']
                            }
                            label={props.label}
                            series={stackedSeries}
                            currency={currency}
                          />
                        )}
                      />
                      {stackedSeries.map((s) => (
                        <Bar
                          key={s.dataKey}
                          dataKey={s.dataKey}
                          stackId="cat"
                          fill={s.color}
                          name={s.name}
                          maxBarSize={40}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ScrollArea className="mt-4 max-h-28">
                  <div className="flex flex-wrap gap-x-4 gap-y-2 pr-2 text-xs text-muted-foreground">
                    {stackedSeries.map((s) => (
                      <span key={s.dataKey} className="inline-flex items-center gap-1.5">
                        <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </span>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="tracking-tight">Top expense categories</CardTitle>
              <p className="text-sm text-muted-foreground">Total spent in the last 12 months</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {topExpenseCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expense data in this period yet.</p>
              ) : (
                topExpenseCategories.map((row, idx) => (
                  <div key={row.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">
                        <span className="mr-2 tabular-nums text-muted-foreground">{idx + 1}.</span>
                        {row.name}
                      </span>
                      <span className="shrink-0 font-amount tabular-nums">{formatCurrency(row.total, currency)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${row.ratio}%`,
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
