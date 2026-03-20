'use client'

import { useMemo } from 'react'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Target,
  PiggyBank,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccounts } from '@/lib/hooks/use-accounts'
import { useTransactions } from '@/lib/hooks/use-transactions'
import { useBudgets } from '@/lib/hooks/use-budgets'
import { useSavingsGoals } from '@/lib/hooks/use-savings'
import { useInvestments } from '@/lib/hooks/use-investments'
import { formatCurrency, formatCompact } from '@/lib/utils/currency'
import {
  formatDate,
  formatMonthYear,
  getCurrentMonthRange,
  getPreviousMonths,
} from '@/lib/utils/date'
import type { Account } from '@/types/database'
import type { Transaction } from '@/types/database'
import type { Budget } from '@/types/database'
import type { SavingsGoal } from '@/types/database'
import type { Investment } from '@/types/database'

const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
]

const INCOME_BAR = '#10b981'
const EXPENSE_BAR = '#ef4444'

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
}

function ChartCardSkeleton() {
  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[260px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function panelTxsForCategory(
  monthTxs: Transaction[],
  categoryId: string
): number {
  return monthTxs
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.category_id != null &&
        t.category_id === categoryId
    )
    .reduce((sum, t) => sum + t.amount, 0)
}

export default function DashboardPage() {
  const monthKey = format(new Date(), 'yyyy-MM')

  const currentMonthFilters = useMemo(() => {
    const { start, end } = getCurrentMonthRange()
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    }
  }, [monthKey])

  const sixMonthFilters = useMemo(() => {
    const prev = getPreviousMonths(6)
    return {
      startDate: format(startOfMonth(prev[0]), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(prev[prev.length - 1]), 'yyyy-MM-dd'),
    }
  }, [monthKey])

  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const { data: investments, isLoading: investmentsLoading } = useInvestments()
  const { data: budgets, isLoading: budgetsLoading } = useBudgets()
  const { data: savingsGoals, isLoading: savingsLoading } = useSavingsGoals()
  const { data: monthTxs = [], isLoading: monthTxsLoading } =
    useTransactions(currentMonthFilters)
  const { data: rangeTxs = [], isLoading: rangeTxsLoading } =
    useTransactions(sixMonthFilters)
  const { data: recentTxs = [], isLoading: recentLoading } = useTransactions({
    limit: 8,
  })

  const netWorth = useMemo(() => {
    if (!accounts || !investments) return null
    const activeTotal = accounts
      .filter((a: Account) => a.is_active)
      .reduce((s, a) => s + a.balance, 0)
    const invTotal = investments.reduce(
      (s: number, inv: Investment) => s + inv.shares * inv.current_price,
      0
    )
    return activeTotal + invTotal
  }, [accounts, investments])

  const monthlyIncome = useMemo(
    () =>
      monthTxs
        .filter((t: Transaction) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0),
    [monthTxs]
  )

  const monthlyExpenses = useMemo(
    () =>
      monthTxs
        .filter((t: Transaction) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0),
    [monthTxs]
  )

  const netThisMonth = monthlyIncome - monthlyExpenses

  const barAndNetData = useMemo(() => {
    const months = getPreviousMonths(6)
    return months.map((m) => {
      const key = format(m, 'yyyy-MM')
      const income = rangeTxs
        .filter((t: Transaction) => t.type === 'income' && t.date.startsWith(key))
        .reduce((s, t) => s + t.amount, 0)
      const expenses = rangeTxs
        .filter((t: Transaction) => t.type === 'expense' && t.date.startsWith(key))
        .reduce((s, t) => s + t.amount, 0)
      return {
        label: format(m, 'MMM'),
        monthKey: key,
        income,
        expenses,
        net: income - expenses,
      }
    })
  }, [rangeTxs])

  const categorySpend = useMemo(() => {
    const map = new Map<
      string,
      { name: string; value: number; color: string }
    >()
    for (const t of monthTxs) {
      if (t.type !== 'expense') continue
      const id = t.category_id ?? '__other__'
      const name = t.category?.name ?? 'Uncategorized'
      const color = t.category?.color ?? CHART_COLORS[0]
      const prev = map.get(id)
      if (prev) {
        prev.value += t.amount
      } else {
        map.set(id, { name, value: t.amount, color })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [monthTxs])

  const statsLoading = accountsLoading || investmentsLoading

  const chartTooltipFmt = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value)
    return formatCurrency(Number.isFinite(n) ? n : 0, 'ILS')
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your finances this month"
      />

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net worth
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">
                  {netWorth != null ? formatCurrency(netWorth, 'ILS') : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Accounts + investments
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Monthly income
                </CardTitle>
                <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-emerald-600">
                  {formatCurrency(monthlyIncome, 'ILS')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatMonthYear(getCurrentMonthRange().start)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Monthly expenses
                </CardTitle>
                <ArrowDownCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-red-500">
                  {formatCurrency(monthlyExpenses, 'ILS')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatMonthYear(getCurrentMonthRange().start)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net this month
                </CardTitle>
                {netThisMonth >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold tabular-nums ${
                    netThisMonth >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {formatCurrency(netThisMonth, 'ILS')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Income − expenses
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {rangeTxsLoading ? (
          <>
            <ChartCardSkeleton />
            <ChartCardSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Income vs expenses</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Last 6 months
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[220px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barAndNetData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => formatCompact(Number(v))}
                        width={40}
                      />
                      <RTooltip formatter={chartTooltipFmt} />
                      <Bar dataKey="income" fill={INCOME_BAR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="expenses" fill={EXPENSE_BAR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[100px] w-full min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Net per month
                  </p>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={barAndNetData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <RTooltip formatter={chartTooltipFmt} />
                      <Area
                        type="monotone"
                        dataKey="net"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#netFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Spending by category</CardTitle>
                <p className="text-sm text-muted-foreground">
                  This month (expenses)
                </p>
              </CardHeader>
              <CardContent>
                {categorySpend.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    No expense transactions with categories this month.
                  </p>
                ) : (
                  <div className="h-[280px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categorySpend}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={88}
                          paddingAngle={2}
                        >
                          {categorySpend.map((entry, i) => (
                            <Cell
                              key={`${entry.name}-${i}`}
                              fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RTooltip formatter={chartTooltipFmt} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Budgets & savings */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Budget progress
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Spent vs budget (this month)
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {budgetsLoading || monthTxsLoading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : !budgets?.length ? (
              <p className="text-sm text-muted-foreground">No budgets yet.</p>
            ) : (
              budgets.map((b: Budget) => {
                const spent = panelTxsForCategory(monthTxs, b.category_id)
                const pct =
                  b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0
                const over = spent > b.amount
                return (
                  <div key={b.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium truncate">
                        {b.category?.name ?? 'Category'}
                      </span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {formatCurrency(spent, 'ILS')} /{' '}
                        {formatCurrency(b.amount, 'ILS')}
                      </span>
                    </div>
                    <Progress value={pct} className="w-full" />
                    {over && (
                      <p className="text-xs text-red-500">
                        Over budget by{' '}
                        {formatCurrency(spent - b.amount, 'ILS')}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4" />
              Savings goals
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {savingsLoading ? (
              <>
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
              </>
            ) : !savingsGoals?.length ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                No savings goals yet.
              </p>
            ) : (
              savingsGoals.map((g: SavingsGoal) => {
                const pct =
                  g.target_amount > 0
                    ? Math.min(
                        100,
                        (g.current_amount / g.target_amount) * 100
                      )
                    : 0
                return (
                  <div
                    key={g.id}
                    className="rounded-lg border bg-card/50 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm leading-tight">
                        {g.name}
                      </span>
                      <Badge variant="secondary" className="tabular-nums shrink-0">
                        {pct.toFixed(0)}%
                      </Badge>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: g.color || CHART_COLORS[0],
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(g.current_amount, 'ILS')} →{' '}
                      {formatCurrency(g.target_amount, 'ILS')}
                    </p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <p className="text-sm text-muted-foreground">Latest 8</p>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentTxs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentTxs.map((t: Transaction) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(t.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.category && (
                      <Badge
                        variant="outline"
                        className="max-w-[140px] truncate border-transparent text-foreground"
                        style={{
                          backgroundColor: `${t.category.color}22`,
                          borderColor: `${t.category.color}44`,
                        }}
                      >
                        {t.category.name}
                      </Badge>
                    )}
                    <span
                      className={`font-semibold tabular-nums ${
                        t.type === 'income'
                          ? 'text-emerald-600'
                          : t.type === 'expense'
                            ? 'text-red-500'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}
                      {formatCurrency(t.amount, 'ILS')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
