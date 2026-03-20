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
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTransactions } from '@/lib/hooks/use-transactions'
import { useCategories } from '@/lib/hooks/use-categories'
import { useCurrency } from '@/lib/hooks/use-currency'
import { formatCurrency, formatCompact } from '@/lib/utils/currency'
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

function monthKeysDescending(count: number, now: Date): string[] {
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    keys.push(format(startOfMonth(subMonths(now, i)), 'yyyy-MM'))
  }
  return keys
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
    return last12MonthKeys.map((monthKey) => ({
      label: format(new Date(`${monthKey}-01T12:00:00`), 'MMM yy'),
      monthKey,
      income: incomeByMonth.get(monthKey) ?? 0,
      expenses: expenseByMonth.get(monthKey) ?? 0,
    }))
  }, [transactions, last12MonthKeys])

  const last6MonthKeys = useMemo(() => monthKeysDescending(6, new Date()), [periodKey])

  const categoryTrendRows = useMemo(() => {
    const seriesIds: string[] = expenseCategories.map((c) => c.id)
    seriesIds.push(UNCATEGORIZED_ID)

    const spend: Map<string, Map<string, number>> = new Map()
    for (const monthKey of last6MonthKeys) {
      spend.set(monthKey, new Map())
    }

    for (const t of transactions as Transaction[]) {
      if (t.type !== 'expense') continue
      const monthKey = t.date.slice(0, 7)
      if (!spend.has(monthKey)) continue
      const id = t.category_id ?? UNCATEGORIZED_ID
      const row = spend.get(monthKey)!
      row.set(id, (row.get(id) ?? 0) + t.amount)
    }

    return last6MonthKeys.map((monthKey) => {
      const row: Record<string, string | number> = {
        label: format(new Date(`${monthKey}-01T12:00:00`), 'MMM yy'),
        monthKey,
      }
      const m = spend.get(monthKey)!
      for (const id of seriesIds) {
        row[id] = m.get(id) ?? 0
      }
      return row
    })
  }, [transactions, expenseCategories, last6MonthKeys])

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
        description="Spending trends, income vs expenses, and category breakdown over recent months."
      />

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-1">
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
              <div className="h-[min(22rem,55vw)] w-full min-w-0 min-h-[220px]">
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
                    <Tooltip
                      formatter={chartTooltipFormatter}
                      contentStyle={TOOLTIP_STYLE}
                    />
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
              <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
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

          <Card>
            <CardHeader>
              <CardTitle className="tracking-tight">Category spending over time</CardTitle>
              <p className="text-sm text-muted-foreground">Expense categories · last 6 months</p>
            </CardHeader>
            <CardContent>
              <div className="h-[min(24rem,60vw)] w-full min-w-0 min-h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={categoryTrendRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatCompact(Number(v))}
                      width={44}
                      className="fill-muted-foreground"
                    />
                    <Tooltip formatter={chartTooltipFormatter} contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ maxHeight: 100, overflowY: 'auto', fontSize: 11 }} />
                    {expenseCategories.map((c, i) => (
                      <Line
                        key={c.id}
                        type="monotone"
                        dataKey={c.id}
                        name={c.name}
                        stroke={c.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey={UNCATEGORIZED_ID}
                      name="Uncategorized"
                      stroke={CHART_PALETTE[CHART_PALETTE.length - 1]}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

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
                      <span className="font-medium truncate">
                        <span className="text-muted-foreground tabular-nums mr-2">{idx + 1}.</span>
                        {row.name}
                      </span>
                      <span className="font-amount tabular-nums shrink-0">{formatCurrency(row.total, currency)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
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
