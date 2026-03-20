'use client'

import { useCallback, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { format, parseISO, startOfMonth, endOfMonth, isBefore, isAfter } from 'date-fns'
import {
  Plus,
  Calculator,
  CalendarDays,
  TrendingUp,
  Repeat,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from 'recharts'

import { PageHeader } from '@/components/layout/page-header'
import { formatCurrency } from '@/lib/utils/currency'
import { useCurrency } from '@/lib/hooks/use-currency'
import { formatDate, addMonths } from '@/lib/utils/date'
import {
  useRecurringRules,
  useCreateRecurringRule,
  useDeleteRecurringRule,
  useUpdateRecurringRule,
} from '@/lib/hooks/use-recurring'
import { useAccounts } from '@/lib/hooks/use-accounts'
import { useCategories } from '@/lib/hooks/use-categories'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import type { RecurringRule, RecurringFrequency, TransactionType } from '@/types/database'
import { cn } from '@/lib/utils'
import {
  selectItemsFromEntities,
  selectItemsFromMap,
  selectItemsWithNoneCategories,
} from '@/lib/utils/select-items'
import { getCategoryDisplayName } from '@/lib/utils/category-display-name'

const NONE = '__none__'


type FlowType = 'income' | 'expense'

function monthlyOccurrencesPerRule(frequency: RecurringFrequency): number {
  switch (frequency) {
    case 'daily':
      return 365.25 / 12
    case 'weekly':
      return 52 / 12
    case 'monthly':
      return 1
    case 'yearly':
      return 1 / 12
    default:
      return 0
  }
}

function ruleAppliesInMonth(rule: RecurringRule, monthStart: Date, monthEnd: Date): boolean {
  if (!rule.is_active) return false
  if (rule.type !== 'income' && rule.type !== 'expense') return false
  const start = parseISO(rule.start_date)
  const ruleEnd = rule.end_date ? parseISO(rule.end_date) : null
  if (isAfter(start, monthEnd)) return false
  if (ruleEnd && isBefore(ruleEnd, monthStart)) return false
  return true
}

function projectMonth(
  rules: RecurringRule[],
  monthStart: Date,
  monthEnd: Date
): { income: number; expense: number } {
  let income = 0
  let expense = 0
  const occ = monthlyOccurrencesPerRule
  for (const rule of rules) {
    if (!ruleAppliesInMonth(rule, monthStart, monthEnd)) continue
    const mult = occ(rule.frequency)
    if (rule.type === 'income') income += rule.amount * mult
    else if (rule.type === 'expense') expense += rule.amount * mult
  }
  return { income, expense }
}

function retirementFV(
  pv: number,
  pmt: number,
  annualRatePct: number,
  years: number
): { fv: number; totalContributions: number; totalInterest: number; series: { year: number; balance: number }[] } {
  const n = Math.max(0, Math.round(years * 12))
  const r = annualRatePct / 100 / 12
  let fv: number
  if (n === 0) {
    fv = pv
  } else if (Math.abs(r) < 1e-12) {
    fv = pv + pmt * n
  } else {
    const pow = (1 + r) ** n
    fv = pv * pow + (pmt * (pow - 1)) / r
  }
  const totalContributions = pv + pmt * n
  const totalInterest = fv - totalContributions

  const series: { year: number; balance: number }[] = []
  const yMax = Math.max(1, Math.ceil(years))
  for (let y = 0; y <= yMax; y++) {
    const months = Math.min(n, y * 12)
    let bal: number
    if (months === 0) bal = pv
    else if (Math.abs(r) < 1e-12) bal = pv + pmt * months
    else {
      const powM = (1 + r) ** months
      bal = pv * powM + (pmt * (powM - 1)) / r
    }
    series.push({ year: y, balance: bal })
  }

  return { fv, totalContributions, totalInterest, series }
}

type RuleForm = {
  description: string
  type: FlowType
  amount: string
  frequency: RecurringFrequency
  day_of_month: string
  account_id: string
  category_id: string
  start_date: string
}

const defaultRuleForm = (): RuleForm => ({
  description: '',
  type: 'expense',
  amount: '',
  frequency: 'monthly',
  day_of_month: '1',
  account_id: '',
  category_id: NONE,
  start_date: format(new Date(), 'yyyy-MM-dd'),
})

export default function PlanningPage() {
  const t = useTranslations()
  const locale = useLocale()
  const currency = useCurrency()

  const RECURRING_FLOW_SELECT_ITEMS = useMemo(
    () =>
      selectItemsFromMap(['income', 'expense'], {
        income: t('common.income'),
        expense: t('common.expense'),
      }),
    [t]
  )

  const RECURRING_FREQUENCY_SELECT_ITEMS = useMemo(
    () =>
      selectItemsFromMap(['daily', 'weekly', 'monthly', 'yearly'], {
        daily: t('common.daily'),
        weekly: t('common.weekly'),
        monthly: t('common.monthly'),
        yearly: t('common.yearly'),
      }),
    [t]
  )

  const { data: rules = [], isLoading: rulesLoading } = useRecurringRules()
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts()
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()
  const createRule = useCreateRecurringRule()
  const deleteRule = useDeleteRecurringRule()
  const updateRule = useUpdateRecurringRule()

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<RuleForm>(defaultRuleForm)
  const [extraSavings, setExtraSavings] = useState('0')

  const [retPV, setRetPV] = useState('100000')
  const [retPMT, setRetPMT] = useState('2000')
  const [retRate, setRetRate] = useState('7')
  const [retYears, setRetYears] = useState('25')

  const loading = rulesLoading || accountsLoading || categoriesLoading

  const extraSavingsNum = Number(extraSavings) || 0

  const projectionRows = useMemo(() => {
    const base = startOfMonth(new Date())
    const rows: {
      key: string
      label: string
      income: number
      expense: number
      net: number
      cumulative: number
    }[] = []
    let cumulative = accounts.reduce((s, a) => s + a.balance, 0)
    for (let i = 0; i < 12; i++) {
      const mStart = addMonths(base, i)
      const mEnd = endOfMonth(mStart)
      const { income, expense } = projectMonth(rules, mStart, mEnd)
      const net = income - expense + extraSavingsNum
      cumulative += net
      rows.push({
        key: format(mStart, 'yyyy-MM'),
        label: formatDate(format(mStart, 'yyyy-MM-dd'), 'MMM yyyy'),
        income,
        expense,
        net,
        cumulative,
      })
    }
    return rows
  }, [rules, accounts, extraSavingsNum])

  const chartData = useMemo(
    () =>
      projectionRows.map((r) => ({
        month: r.label,
        cumulative: Math.round(r.cumulative * 100) / 100,
      })),
    [projectionRows]
  )

  const retirement = useMemo(() => {
    const pv = Number(retPV) || 0
    const pmt = Number(retPMT) || 0
    const rate = Number(retRate) || 0
    const years = Math.max(0, Number(retYears) || 0)
    return retirementFV(pv, pmt, rate, years)
  }, [retPV, retPMT, retRate, retYears])

  const retChartData = useMemo(
    () =>
      retirement.series.map((p) => ({
        year: p.year === 0 ? 'Now' : `Year ${p.year}`,
        balance: Math.round(p.balance * 100) / 100,
      })),
    [retirement.series]
  )

  const openAdd = useCallback(() => {
    setForm(defaultRuleForm())
    setAddOpen(true)
  }, [])

  const submitRule = useCallback(() => {
    const amount = Number(form.amount)
    if (!form.description.trim() || !form.account_id || !Number.isFinite(amount) || amount <= 0) return

    const start = form.start_date
    const day =
      form.frequency === 'monthly'
        ? Math.min(28, Math.max(1, parseInt(form.day_of_month, 10) || 1))
        : null

    const payload: Omit<RecurringRule, 'id' | 'user_id' | 'created_at' | 'account' | 'category'> = {
      account_id: form.account_id,
      category_id: form.category_id === NONE ? null : form.category_id,
      amount,
      type: form.type as TransactionType,
      description: form.description.trim(),
      frequency: form.frequency,
      day_of_month: day,
      start_date: start,
      end_date: null,
      next_occurrence: start,
      is_active: true,
    }

    createRule.mutate(payload, {
      onSuccess: () => {
        setAddOpen(false)
        setForm(defaultRuleForm())
      },
    })
  }, [form, createRule])

  const categoriesByType = useCallback(
    (t: FlowType) => categories.filter((c) => c.type === t),
    [categories]
  )

  const recurringAccountItems = useMemo(() => selectItemsFromEntities(accounts), [accounts])

  const recurringCategoryItems = useMemo(
    () =>
      selectItemsWithNoneCategories(
        NONE,
        t('common.none'),
        categories.filter((c) => c.type === form.type),
        locale
      ),
    [categories, form.type, t, locale]
  )

  return (
    <div className="pb-24 md:pb-8">
      <PageHeader
        title={t('planning.title')}
        description={t('planning.description')}
      />

      <Tabs defaultValue="recurring" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="recurring" className="gap-1.5">
            <Repeat className="size-3.5" />
            {t('planning.recurring')}
          </TabsTrigger>
          <TabsTrigger value="projections" className="gap-1.5">
            <TrendingUp className="size-3.5" />
            {t('planning.projections')}
          </TabsTrigger>
          <TabsTrigger value="retirement" className="gap-1.5">
            <Calculator className="size-3.5" />
            {t('planning.retirement')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recurring" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openAdd} size="sm" className="gap-1.5">
              <Plus className="size-4" />
              {t('planning.addRule')}
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                {t('planning.recurringTransactions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 pt-0">
              {loading ? (
                <div className="p-6 space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('common.description')}</TableHead>
                        <TableHead>{t('common.type')}</TableHead>
                        <TableHead className="text-end">{t('common.amount')}</TableHead>
                        <TableHead>{t('planning.frequency')}</TableHead>
                        <TableHead>{t('common.account')}</TableHead>
                        <TableHead>{t('planning.next')}</TableHead>
                        <TableHead className="w-[100px]">{t('planning.active')}</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                            {t('planning.noRulesYet')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        rules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {rule.description}
                            </TableCell>
                            <TableCell>
                              {rule.type === 'income' ? (
                                <Badge className="gap-1 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-0">
                                  <ArrowUpCircle className="size-3" />
                                  {t('common.income')}
                                </Badge>
                              ) : rule.type === 'expense' ? (
                                <Badge className="gap-1 bg-red-600/10 text-red-700 dark:text-red-400 border-0">
                                  <ArrowDownCircle className="size-3" />
                                  {t('common.expense')}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">{rule.type}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-end tabular-nums">
                              {formatCurrency(rule.amount, currency)}
                            </TableCell>
                            <TableCell className="capitalize">{rule.frequency}</TableCell>
                            <TableCell className="max-w-[140px] truncate">
                              {rule.account?.name ?? '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                              {formatDate(rule.next_occurrence)}
                            </TableCell>
                            <TableCell>
                              <Checkbox
                                checked={rule.is_active}
                                onCheckedChange={(v) =>
                                  updateRule.mutate({ id: rule.id, is_active: v === true })
                                }
                                disabled={updateRule.isPending}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (!window.confirm(t('planning.deleteRuleConfirm'))) return
                                  deleteRule.mutate(rule.id)
                                }}
                                disabled={deleteRule.isPending}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="sm:max-w-md" showCloseButton>
              <DialogHeader>
                <DialogTitle>{t('planning.addRecurringRule')}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="rule-desc">{t('common.description')}</Label>
                  <Input
                    id="rule-desc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={t('planning.descriptionPlaceholder')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>{t('common.type')}</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => setForm((f) => ({ ...f, type: v as FlowType }))}
                      items={RECURRING_FLOW_SELECT_ITEMS}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">{t('common.income')}</SelectItem>
                        <SelectItem value="expense">{t('common.expense')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rule-amt">{t('common.amount')}</Label>
                    <Input
                      id="rule-amt"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>{t('planning.frequency')}</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, frequency: v as RecurringFrequency }))
                    }
                    items={RECURRING_FREQUENCY_SELECT_ITEMS}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('common.daily')}</SelectItem>
                      <SelectItem value="weekly">{t('common.weekly')}</SelectItem>
                      <SelectItem value="monthly">{t('common.monthly')}</SelectItem>
                      <SelectItem value="yearly">{t('common.yearly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.frequency === 'monthly' && (
                  <div className="grid gap-2">
                    <Label htmlFor="rule-dom">{t('planning.dayOfMonth')}</Label>
                    <Input
                      id="rule-dom"
                      type="number"
                      min={1}
                      max={28}
                      value={form.day_of_month}
                      onChange={(e) => setForm((f) => ({ ...f, day_of_month: e.target.value }))}
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>{t('common.account')}</Label>
                  <Select
                    value={form.account_id || null}
                    onValueChange={(v) => setForm((f) => ({ ...f, account_id: v ?? '' }))}
                    items={recurringAccountItems}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('transactions.selectAccount')} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t('common.category')}</Label>
                  <Select
                    value={form.category_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, category_id: v ?? NONE }))}
                    items={recurringCategoryItems}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.optional')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                      {categoriesByType(form.type).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {getCategoryDisplayName(c, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rule-start">{t('planning.startDate')}</Label>
                  <Input
                    id="rule-start"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={submitRule}
                  disabled={
                    createRule.isPending ||
                    !form.description.trim() ||
                    !form.account_id ||
                    !(Number(form.amount) > 0)
                  }
                >
                  {t('planning.saveRule')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="projections" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('planning.cumulativeBalance')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('planning.cumulativeHint')}
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      tickFormatter={(v) => formatCurrency(Number(v), currency)}
                    />
                    <RTooltip
                      formatter={(value) => {
                        const n = typeof value === 'number' ? value : Number(value ?? 0)
                        return [formatCurrency(Number.isFinite(n) ? n : 0, currency), t('planning.cumulative')]
                      }}
                      contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="var(--primary)"
                      fill="var(--primary)"
                      fillOpacity={0.2}
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('planning.whatIf')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="extra-save">{t('planning.additionalSavings')}</Label>
              <Input
                id="extra-save"
                type="number"
                step="0.01"
                value={extraSavings}
                onChange={(e) => setExtraSavings(e.target.value)}
                className="max-w-xs"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('planning.monthByMonth')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('planning.month')}</TableHead>
                      <TableHead className="text-end">{t('common.income')}</TableHead>
                      <TableHead className="text-end">{t('common.expense')}</TableHead>
                      <TableHead className="text-end">{t('transactions.net')}</TableHead>
                      <TableHead className="text-end">{t('planning.cumulative')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectionRows.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell>{r.label}</TableCell>
                        <TableCell className="text-end tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(r.income, currency)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums text-red-600 dark:text-red-400">
                          {formatCurrency(r.expense, currency)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-end tabular-nums font-medium',
                            r.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {formatCurrency(r.net, currency)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {formatCurrency(r.cumulative, currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retirement" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('planning.currentSavings')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  step="0.01"
                  value={retPV}
                  onChange={(e) => setRetPV(e.target.value)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('planning.monthlyContribution')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  step="0.01"
                  value={retPMT}
                  onChange={(e) => setRetPMT(e.target.value)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('planning.expectedReturn')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  step="0.01"
                  value={retRate}
                  onChange={(e) => setRetRate(e.target.value)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('planning.yearsUntilRetirement')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={retYears}
                  onChange={(e) => setRetYears(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t('planning.projectedAmount')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(retirement.fv, currency)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t('planning.totalContributions')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(retirement.totalContributions, currency)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t('planning.totalInterest')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-primary">
                  {formatCurrency(retirement.totalInterest, currency)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('planning.growthOverTime')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('planning.growthHint')}</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={retChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      tickFormatter={(v) => formatCurrency(Number(v), currency)}
                    />
                    <RTooltip
                      formatter={(value) => {
                        const n = typeof value === 'number' ? value : Number(value ?? 0)
                        return [formatCurrency(Number.isFinite(n) ? n : 0, currency), t('planning.balance')]
                      }}
                      contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="var(--chart-2)"
                      fill="var(--chart-2)"
                      fillOpacity={0.2}
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
