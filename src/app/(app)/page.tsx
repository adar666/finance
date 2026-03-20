'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  startOfMonth,
  endOfMonth,
  format,
  subDays,
  subMonths,
  startOfYear,
  eachMonthOfInterval,
} from 'date-fns'
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
  Plus,
  ArrowRight,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { PrivateMoney, usePrivacyMode } from '@/components/layout/privacy-mode'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccounts } from '@/lib/hooks/use-accounts'
import { useTransactions } from '@/lib/hooks/use-transactions'
import { useBudgets } from '@/lib/hooks/use-budgets'
import { useSavingsGoals } from '@/lib/hooks/use-savings'
import { useInvestments } from '@/lib/hooks/use-investments'
import { useCurrency } from '@/lib/hooks/use-currency'
import { useRecurringAutoGenerate } from '@/lib/hooks/use-recurring-auto'
import { useRecurringRules } from '@/lib/hooks/use-recurring'
import { formatCurrency, formatCompact } from '@/lib/utils/currency'
import { formatDate, formatMonthYear, getCurrentMonthRange } from '@/lib/utils/date'
import { computeBudgetAlertRows } from '@/lib/utils/budget-health'
import { getCategoryDisplayName } from '@/lib/utils/category-display-name'
import { shouldShowFinanceWelcomeHero } from '@/lib/utils/dashboard-onboarding'
import { filterUpcomingRecurringRules } from '@/lib/utils/recurring-upcoming'
import { cn } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'
import type { Account, Transaction, Budget, SavingsGoal, Investment, RecurringRule } from '@/types/database'

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

const CHART_COLORS_RAW = [
  '#2dd4bf', '#10b981', '#f59e0b', '#ef4444',
  '#a855f7', '#ec4899', '#3b82f6', '#f97316',
]

type DateRangeOption = 'this-month' | 'last-30' | 'last-3-months' | 'this-year'

function getPeriodBounds(dateRange: DateRangeOption, now: Date): { start: Date; end: Date } {
  switch (dateRange) {
    case 'this-month':
      return getCurrentMonthRange()
    case 'last-30':
      return { start: subDays(now, 30), end: now }
    case 'last-3-months':
      return { start: startOfMonth(subMonths(now, 2)), end: now }
    case 'this-year':
      return { start: startOfYear(now), end: now }
  }
}

function chartMonthsForRange(dateRange: DateRangeOption, now: Date): Date[] {
  const { start, end } = getPeriodBounds(dateRange, now)
  return eachMonthOfInterval({
    start: startOfMonth(start),
    end: startOfMonth(end),
  })
}

function chartSubtitleForRange(dateRange: DateRangeOption, t: (key: string) => string): string {
  switch (dateRange) {
    case 'this-month':
      return t('dashboard.thisMonth')
    case 'last-30':
      return t('dashboard.last30')
    case 'last-3-months':
      return t('dashboard.last3Months')
    case 'this-year':
      return t('dashboard.thisYear')
  }
}

function incomeExpensePeriodCaption(dateRange: DateRangeOption, now: Date): string {
  const { start, end } = getPeriodBounds(dateRange, now)
  switch (dateRange) {
    case 'this-month':
      return formatMonthYear(start)
    case 'last-30':
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
    case 'last-3-months':
      return `${formatMonthYear(start)} – ${format(end, 'MMM d, yyyy')}`
    case 'this-year':
      return `${format(start, 'yyyy')} (through ${format(end, 'MMM d')})`
  }
}

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

function WelcomeHero() {
  const t = useTranslations()
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-primary/5">
      <CardContent className="p-6 sm:p-8">
        <h2 className="text-xl font-bold tracking-tight mb-1">{t('dashboard.welcomeTitle')}</h2>
        <p className="text-muted-foreground text-sm mb-6">
          {t('dashboard.welcomeDescription')}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { step: 1, label: t('dashboard.addAccount'), href: '/accounts', icon: Wallet },
            { step: 2, label: t('dashboard.addTransaction'), href: '/transactions', icon: Plus },
            { step: 3, label: t('dashboard.setBudget'), href: '/budgets', icon: Target },
          ].map(({ step, label, href, icon: Icon }) => (
            <Link
              key={step}
              href={href}
              className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/80 p-4 hover:border-primary/30 transition-colors group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.step', { step })}</p>
                <p className="text-sm font-medium group-hover:text-primary transition-colors">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function panelTxsForCategory(monthTxs: Transaction[], categoryId: string): number {
  return monthTxs
    .filter(t => t.type === 'expense' && t.category_id != null && t.category_id === categoryId)
    .reduce((sum, t) => sum + t.amount, 0)
}

export default function DashboardPage() {
  const currency = useCurrency()
  const locale = useLocale()
  const t = useTranslations()
  const { enabled: privacyOn } = usePrivacyMode()
  useRecurringAutoGenerate()
  const [dateRange, setDateRange] = useState<DateRangeOption>('this-month')
  const now = new Date()
  const rangeBoundaryKey = `${dateRange}-${format(now, 'yyyy-MM-dd')}`

  const calendarMonthStart = useMemo(() => startOfMonth(new Date()), [])
  const calendarMonthFilters = useMemo(
    () => ({
      startDate: format(calendarMonthStart, 'yyyy-MM-dd'),
      endDate: format(endOfMonth(calendarMonthStart), 'yyyy-MM-dd'),
      type: 'expense' as const,
    }),
    [calendarMonthStart]
  )

  const currentMonthFilters = useMemo(() => {
    const { start, end } = getPeriodBounds(dateRange, now)
    return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') }
  }, [dateRange, rangeBoundaryKey])

  const sixMonthFilters = useMemo(() => {
    const { start, end } = getPeriodBounds(dateRange, now)
    return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') }
  }, [dateRange, rangeBoundaryKey])

  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const { data: investments, isLoading: investmentsLoading } = useInvestments()
  const { data: budgets, isLoading: budgetsLoading } = useBudgets()
  const { data: savingsGoals, isLoading: savingsLoading } = useSavingsGoals()
  const { data: monthTxs = [], isLoading: monthTxsLoading } = useTransactions(currentMonthFilters)
  const { data: recentTxs = [], isLoading: recentLoading } = useTransactions({ limit: 8 })
  const { data: budgetNudgeTxs = [], isLoading: budgetNudgeTxLoading } = useTransactions(calendarMonthFilters)
  const { data: anyTxProbe = [], isLoading: anyTxProbeLoading } = useTransactions({ limit: 1 })
  const { data: recurringRules = [], isLoading: recurringLoading } = useRecurringRules()

  const upcomingRecurring = useMemo(() => {
    return filterUpcomingRecurringRules(recurringRules as RecurringRule[], new Date(), 7, 8)
  }, [recurringRules])

  const budgetAlerts = useMemo(() => {
    if (!budgets?.length) return []
    return computeBudgetAlertRows(budgets, budgetNudgeTxs, calendarMonthStart, locale)
  }, [budgets, budgetNudgeTxs, calendarMonthStart, locale])

  const showWelcomeExtended = shouldShowFinanceWelcomeHero({
    accountsLoaded: !accountsLoading,
    accountCount: accounts?.length ?? 0,
    transactionsProbeLoaded: !anyTxProbeLoading,
    anyTransactionExists: anyTxProbe.length > 0,
  })

  const netWorth = useMemo(() => {
    if (!accounts || !investments) return null
    const activeTotal = accounts.filter((a: Account) => a.is_active).reduce((s, a) => s + a.balance, 0)
    const invTotal = investments.reduce((s: number, inv: Investment) => s + inv.shares * inv.current_price, 0)
    return activeTotal + invTotal
  }, [accounts, investments])

  const monthlyIncome = useMemo(
    () => monthTxs.filter((t: Transaction) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [monthTxs]
  )
  const monthlyExpenses = useMemo(
    () => monthTxs.filter((t: Transaction) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [monthTxs]
  )
  const netThisMonth = monthlyIncome - monthlyExpenses

  const barAndNetData = useMemo(() => {
    const months = chartMonthsForRange(dateRange, now)
    const labelFmt = months.length > 4 ? 'MMM yy' : 'MMM'
    return months.map((m) => {
      const key = format(m, 'yyyy-MM')
      const income = monthTxs
        .filter((t: Transaction) => t.type === 'income' && t.date.startsWith(key))
        .reduce((s, t) => s + t.amount, 0)
      const expenses = monthTxs
        .filter((t: Transaction) => t.type === 'expense' && t.date.startsWith(key))
        .reduce((s, t) => s + t.amount, 0)
      return { label: format(m, labelFmt), monthKey: key, income, expenses, net: income - expenses }
    })
  }, [monthTxs, dateRange, rangeBoundaryKey, sixMonthFilters])

  const categorySpend = useMemo(() => {
    const uncat = t('common.uncategorized')
    const map = new Map<string, { name: string; value: number; color: string }>()
    for (const tx of monthTxs) {
      if (tx.type !== 'expense') continue
      const id = tx.category_id ?? '__other__'
      const cat = tx.category
      const name = cat
        ? getCategoryDisplayName(cat, locale)
        : uncat
      const color = cat?.color ?? CHART_COLORS_RAW[0]
      const prev = map.get(id)
      if (prev) prev.value += tx.amount
      else map.set(id, { name, value: tx.amount, color })
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [monthTxs, locale, t])

  const statsLoading = accountsLoading || investmentsLoading
  const chartTooltipFmt = useCallback(
    (value: unknown) => {
      const n = typeof value === 'number' ? value : Number(value)
      const s = formatCurrency(Number.isFinite(n) ? n : 0, currency)
      return privacyOn ? '••••' : s
    },
    [currency, privacyOn]
  )

  const rangeSummary = chartSubtitleForRange(dateRange, t)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description', { range: rangeSummary.toLowerCase() })}
      />

      {showWelcomeExtended && <WelcomeHero />}

      {!budgetNudgeTxLoading && budgetAlerts.length > 0 && (
        <Card
          className={cn(
            budgetAlerts.some((a) => a.level === 'over')
              ? 'border-destructive/40 bg-destructive/5'
              : 'border-amber-500/40 bg-amber-500/5'
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 tracking-tight">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t('dashboard.budgetHeadsUp')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {budgetAlerts.map((a) => (
              <p
                key={a.id}
                className={cn(
                  a.level === 'over'
                    ? 'text-destructive'
                    : 'text-amber-800 dark:text-amber-400'
                )}
              >
                <strong>{a.name}</strong>:{' '}
                <PrivateMoney>{formatCurrency(a.spent, currency)}</PrivateMoney>
                {' / '}
                <PrivateMoney>{formatCurrency(a.cap, currency)}</PrivateMoney>
                {a.level === 'over' ? ` — ${t('dashboard.overBudget')}` : ` — ${t('dashboard.nearingLimit')}`}
              </p>
            ))}
            <Link
              href="/budgets"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2 inline-flex')}
            >
              {t('dashboard.viewBudgets')}
            </Link>
          </CardContent>
        </Card>
      )}

      {!recurringLoading && upcomingRecurring.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base flex items-center gap-2 tracking-tight">
              <CalendarClock className="h-4 w-4 shrink-0" />
              {t('dashboard.upNext')}
            </CardTitle>
            <Link
              href="/planning"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('dashboard.managePlanning')}
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {upcomingRecurring.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
                  <span className="min-w-0 flex-1 truncate font-medium">{r.description}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {formatDate(r.next_occurrence)}
                  </span>
                  <PrivateMoney>
                    <span
                      className={cn(
                        'font-semibold font-amount whitespace-nowrap',
                        r.type === 'expense' ? 'text-expense' : 'text-income'
                      )}
                    >
                      {formatCurrency(r.amount, currency)}
                    </span>
                  </PrivateMoney>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs
        value={dateRange}
        onValueChange={(v) => v && setDateRange(v as DateRangeOption)}
        className="w-full"
      >
        <TabsList className="flex h-auto w-full max-w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
          <TabsTrigger value="this-month" className="text-xs sm:text-sm">
            {t('dashboard.thisMonth')}
          </TabsTrigger>
          <TabsTrigger value="last-30" className="text-xs sm:text-sm">
            {t('dashboard.last30')}
          </TabsTrigger>
          <TabsTrigger value="last-3-months" className="text-xs sm:text-sm">
            {t('dashboard.last3Months')}
          </TabsTrigger>
          <TabsTrigger value="this-year" className="text-xs sm:text-sm">
            {t('dashboard.thisYear')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading ? (
          <>
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </>
        ) : (
          <>
            <Card className="hover:border-primary/20 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.netWorth')}</CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-amount">
                  {netWorth != null ? (
                    <PrivateMoney>{formatCurrency(netWorth, currency)}</PrivateMoney>
                  ) : (
                    '—'
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{t('dashboard.accountsAndInvestments')}</p>
              </CardContent>
            </Card>
            <Card className="hover:border-primary/20 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('common.income')}</CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-amount text-income">
                  <PrivateMoney>{formatCurrency(monthlyIncome, currency)}</PrivateMoney>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{incomeExpensePeriodCaption(dateRange, now)}</p>
              </CardContent>
            </Card>
            <Card className="hover:border-primary/20 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('common.expense')}</CardTitle>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                  <ArrowDownCircle className="h-4 w-4 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-amount text-expense">
                  <PrivateMoney>{formatCurrency(monthlyExpenses, currency)}</PrivateMoney>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{incomeExpensePeriodCaption(dateRange, now)}</p>
              </CardContent>
            </Card>
            <Card className="hover:border-primary/20 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('transactions.net')}</CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${netThisMonth >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  {netThisMonth >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold font-amount ${netThisMonth >= 0 ? 'text-income' : 'text-expense'}`}>
                  <PrivateMoney>{formatCurrency(netThisMonth, currency)}</PrivateMoney>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{rangeSummary}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {monthTxsLoading ? (
          <><ChartCardSkeleton /><ChartCardSkeleton /></>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="tracking-tight">{t('dashboard.incomeVsExpenses')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('dashboard.byMonth', { range: rangeSummary })}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[220px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barAndNetData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(Number(v))} width={40} className="fill-muted-foreground" />
                      <RTooltip formatter={chartTooltipFmt} contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }} />
                      <Bar dataKey="income" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={800} />
                      <Bar dataKey="expenses" fill="var(--destructive)" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[100px] w-full min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('dashboard.netPerMonth')}</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={barAndNetData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <RTooltip formatter={chartTooltipFmt} contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }} />
                      <Area type="monotone" dataKey="net" stroke="var(--primary)" strokeWidth={2} fill="url(#netFill)" animationDuration={800} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="tracking-tight">{t('dashboard.spendingByCategory')}</CardTitle>
                <p className="text-sm text-muted-foreground">{rangeSummary} ({t('dashboard.expenses')})</p>
              </CardHeader>
              <CardContent>
                {categorySpend.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <PiggyBank className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">{t('dashboard.noCategoryExpenses')}</p>
                  </div>
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
                          animationDuration={800}
                        >
                          {categorySpend.map((entry, i) => (
                            <Cell key={`${entry.name}-${i}`} fill={entry.color || CHART_COLORS_RAW[i % CHART_COLORS_RAW.length]} />
                          ))}
                        </Pie>
                        <RTooltip formatter={chartTooltipFmt} contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 tracking-tight">
                <Target className="h-4 w-4" />
                {t('dashboard.budgetProgress')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t('dashboard.spentVsBudget', { range: rangeSummary })}</p>
            </div>
            <Link
              href="/budgets"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View all <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-5">
            {budgetsLoading || monthTxsLoading ? (
              <>{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</>
            ) : !budgets?.length ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Target className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">{t('dashboard.noBudgets')}</p>
                <Link href="/budgets" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}>
                  {t('dashboard.createBudget')}
                </Link>
              </div>
            ) : (
              budgets.map((b: Budget) => {
                const spent = panelTxsForCategory(monthTxs, b.category_id)
                const pct = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0
                const over = spent > b.amount
                return (
                  <div key={b.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium truncate">
                        {b.category
                          ? getCategoryDisplayName(b.category, locale)
                          : t('common.category')}
                      </span>
                      <span className="text-muted-foreground font-amount shrink-0">
                        <PrivateMoney>{formatCurrency(spent, currency)}</PrivateMoney>
                        {' / '}
                        <PrivateMoney>{formatCurrency(b.amount, currency)}</PrivateMoney>
                      </span>
                    </div>
                    <Progress value={pct} className="w-full" />
                    {over && (
                      <p className="text-xs text-destructive">
                        <PrivateMoney>{t('dashboard.overBudgetBy', { amount: formatCurrency(spent - b.amount, currency) })}</PrivateMoney>
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 tracking-tight">
              <PiggyBank className="h-4 w-4" />
              {t('dashboard.savingsGoals')}
            </CardTitle>
            <Link
              href="/savings"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View all <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {savingsLoading ? (
              <>{[1,2].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</>
            ) : !savingsGoals?.length ? (
              <div className="flex flex-col items-center py-8 text-center sm:col-span-2">
                <PiggyBank className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">{t('dashboard.noSavingsGoals')}</p>
                <Link href="/savings" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}>
                  {t('dashboard.createGoal')}
                </Link>
              </div>
            ) : (
              savingsGoals.map((g: SavingsGoal) => {
                const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0
                return (
                  <div key={g.id} className="rounded-lg border bg-card/50 p-3 space-y-2 hover:border-primary/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm leading-tight">{g.name}</span>
                      <Badge variant="secondary" className="font-amount shrink-0">{pct.toFixed(0)}%</Badge>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: g.color || CHART_COLORS_RAW[0] }} />
                    </div>
                    <p className="text-xs text-muted-foreground font-amount">
                      <PrivateMoney>{formatCurrency(g.current_amount, currency)}</PrivateMoney>
                      {' → '}
                      <PrivateMoney>{formatCurrency(g.target_amount, currency)}</PrivateMoney>
                    </p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="tracking-tight">{t('dashboard.recentTransactions')}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t('dashboard.latest8')}</p>
          </div>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View all <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : recentTxs.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <ArrowUpCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{t('dashboard.noTransactions')}</p>
              <Link href="/transactions" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}>
                {t('dashboard.addFirstTransaction')}
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentTxs.map((t: Transaction) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.category && (
                      <Badge variant="outline" className="max-w-[140px] truncate border-transparent text-foreground" style={{ backgroundColor: `${t.category.color}22`, borderColor: `${t.category.color}44` }}>
                        {getCategoryDisplayName(t.category, locale)}
                      </Badge>
                    )}
                    <span
                      className={`font-semibold font-amount ${t.type === 'income' ? 'text-income' : t.type === 'expense' ? 'text-expense' : 'text-muted-foreground'}`}
                    >
                      <PrivateMoney>
                        <span>
                          {t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}
                          {formatCurrency(t.amount, currency)}
                        </span>
                      </PrivateMoney>
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
