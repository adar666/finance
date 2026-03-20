'use client'

import { useMemo, useState, useCallback, type FormEvent } from 'react'
import {
  Plus,
  Target,
  Pencil,
  Trash2,
  Calendar,
  TrendingUp,
  Minus,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { formatCurrency } from '@/lib/utils/currency'
import {
  formatDate,
  differenceInDays,
  parseISO,
} from '@/lib/utils/date'
import {
  useSavingsGoals,
  useCreateSavingsGoal,
  useUpdateSavingsGoal,
  useDeleteSavingsGoal,
} from '@/lib/hooks/use-savings'
import { useCurrency } from '@/lib/hooks/use-currency'
import type { SavingsGoal } from '@/types/database'
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
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const DEFAULT_COLOR = '#10b981'
const DEFAULT_ICON = 'target'

const AVG_DAYS_PER_MONTH = 30.4375

type GoalFormState = {
  name: string
  target_amount: string
  current_amount: string
  target_date: string
  color: string
}

const EMPTY_FORM: GoalFormState = {
  name: '',
  target_amount: '',
  current_amount: '0',
  target_date: '',
  color: DEFAULT_COLOR,
}

function normalizeColor(hex: string): string {
  const t = hex.trim()
  if (!t) return DEFAULT_COLOR
  return t.startsWith('#') ? t : `#${t}`
}

function parseAmount(value: string): number {
  const n = Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function goalProgressPercent(goal: SavingsGoal): number {
  if (goal.target_amount <= 0) return 0
  return (goal.current_amount / goal.target_amount) * 100
}

function ProgressRing({
  percentage,
  color,
  size = 92,
  strokeWidth = 7,
}: {
  percentage: number
  color: string
  size?: number
  strokeWidth?: number
}) {
  const pct = Math.min(100, Math.max(0, percentage))
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct / 100)
  const cx = size / 2
  const cy = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/25"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </g>
    </svg>
  )
}

type ProjectionInfo = {
  daysToTarget: number | null
  avgMonthlySaved: number | null
  projectedDate: Date | null
}

function computeProjection(goal: SavingsGoal): ProjectionInfo {
  if (!goal.target_date || goal.current_amount <= 0) {
    return { daysToTarget: null, avgMonthlySaved: null, projectedDate: null }
  }

  const today = new Date()
  const targetDay = parseISO(goal.target_date)
  const daysToTarget = differenceInDays(targetDay, today)

  const created = parseISO(goal.created_at)
  const daysElapsed = Math.max(1, differenceInDays(today, created))

  const monthsElapsed = daysElapsed / AVG_DAYS_PER_MONTH
  const avgMonthlySaved = goal.current_amount / monthsElapsed

  const remaining = goal.target_amount - goal.current_amount
  if (remaining <= 0) {
    return { daysToTarget, avgMonthlySaved, projectedDate: null }
  }

  const dailySaved = goal.current_amount / daysElapsed
  if (dailySaved <= 0) {
    return { daysToTarget, avgMonthlySaved, projectedDate: null }
  }

  const daysToComplete = remaining / dailySaved
  const projected = new Date(today)
  projected.setHours(0, 0, 0, 0)
  projected.setDate(projected.getDate() + Math.ceil(daysToComplete))

  return { daysToTarget, avgMonthlySaved, projectedDate: projected }
}

function SavingsSummary({
  totalSaved,
  totalTarget,
  currency,
}: {
  totalSaved: number
  totalTarget: number
  currency: string
}) {
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0
  const barValue = Math.min(100, Math.max(0, overallPct))

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          All goals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Total saved</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalSaved, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total target</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {formatCurrency(totalTarget, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Overall progress</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {overallPct.toFixed(1)}%
            </p>
          </div>
        </div>
        <Progress value={barValue} className="w-full" />
      </CardContent>
    </Card>
  )
}

function GoalFormFields({
  form,
  onChange,
}: {
  form: GoalFormState
  onChange: (next: GoalFormState) => void
}) {
  const colorValue = normalizeColor(form.color)

  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="goal-name">Name</Label>
        <Input
          id="goal-name"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. Emergency fund"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="goal-target">Target amount</Label>
          <Input
            id="goal-target"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={form.target_amount}
            onChange={(e) => onChange({ ...form, target_amount: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="goal-current">Current amount</Label>
          <Input
            id="goal-current"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={form.current_amount}
            onChange={(e) => onChange({ ...form, current_amount: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="goal-target-date">Target date (optional)</Label>
        <Input
          id="goal-target-date"
          type="date"
          value={form.target_date}
          onChange={(e) => onChange({ ...form, target_date: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="goal-color">Color</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="goal-color"
            type="color"
            value={colorValue}
            onChange={(e) => onChange({ ...form, color: e.target.value })}
            className="h-10 w-14 shrink-0 cursor-pointer p-1"
            aria-label="Pick goal color"
          />
          <Input
            value={form.color}
            onChange={(e) => onChange({ ...form, color: e.target.value })}
            placeholder={DEFAULT_COLOR}
            className="min-w-0 flex-1 font-mono text-sm"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}

function SavingsPageSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function GoalCard({
  goal,
  currency,
  onEdit,
  onDelete,
  onContribute,
  onWithdraw,
}: {
  goal: SavingsGoal
  currency: string
  onEdit: (g: SavingsGoal) => void
  onDelete: (g: SavingsGoal) => void
  onContribute: (g: SavingsGoal) => void
  onWithdraw: (g: SavingsGoal) => void
}) {
  const accent = goal.color?.trim() ? normalizeColor(goal.color) : DEFAULT_COLOR
  const pct = goalProgressPercent(goal)
  const ringPct = Math.min(100, Math.max(0, pct))
  const projection = computeProjection(goal)

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-border/80 transition-shadow hover:shadow-md'
      )}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3 pl-5">
        <div className="min-w-0 flex-1 pr-2">
          <CardTitle className="text-base font-semibold leading-tight">
            {goal.name}
          </CardTitle>
          {goal.target_date && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Target {formatDate(goal.target_date)}
              </span>
              {projection.daysToTarget !== null && (
                <Badge variant="secondary" className="font-normal tabular-nums">
                  {projection.daysToTarget >= 0
                    ? `${projection.daysToTarget}d left`
                    : `${Math.abs(projection.daysToTarget)}d overdue`}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(goal)}
            aria-label={`Edit ${goal.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(goal)}
            aria-label={`Delete ${goal.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pl-5">
        <div className="flex items-center gap-5">
          <div className="relative grid place-items-center">
            <ProgressRing percentage={ringPct} color={accent} />
            <span className="pointer-events-none absolute max-w-[3.25rem] text-center text-xs font-semibold tabular-nums leading-tight sm:text-sm">
              {Math.round(pct)}%
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-lg font-semibold tabular-nums leading-tight">
              {formatCurrency(goal.current_amount, currency)}
              <span className="text-sm font-normal text-muted-foreground">
                {' '}
                / {formatCurrency(goal.target_amount, currency)}
              </span>
            </p>
            {goal.target_date &&
              goal.current_amount > 0 &&
              projection.avgMonthlySaved !== null && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    ~{formatCurrency(projection.avgMonthlySaved, currency)}/mo avg. saved
                    {projection.projectedDate && (
                      <>
                        {' '}
                        · at this pace:{' '}
                        <span className="font-medium text-foreground">
                          {formatDate(projection.projectedDate)}
                        </span>
                      </>
                    )}
                  </span>
                </p>
              )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => onContribute(goal)}
          >
            <Plus className="h-3.5 w-3.5" />
            Contribute
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onWithdraw(goal)}
            disabled={goal.current_amount <= 0}
          >
            <Minus className="h-3.5 w-3.5" />
            Withdraw
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SavingsPage() {
  const currency = useCurrency()
  const { data: goals = [], isPending, isError, error } = useSavingsGoals()
  const createMut = useCreateSavingsGoal()
  const updateMut = useUpdateSavingsGoal()
  const deleteMut = useDeleteSavingsGoal()

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const [addForm, setAddForm] = useState<GoalFormState>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<GoalFormState>(EMPTY_FORM)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null)
  const [adjustGoal, setAdjustGoal] = useState<SavingsGoal | null>(null)
  const [adjustMode, setAdjustMode] = useState<'contribute' | 'withdraw'>('contribute')
  const [adjustAmount, setAdjustAmount] = useState('')

  const resetAddForm = useCallback(() => setAddForm(EMPTY_FORM), [])

  const totals = useMemo(() => {
    const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0)
    const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)
    return { totalSaved, totalTarget }
  }, [goals])

  const openEdit = useCallback((goal: SavingsGoal) => {
    setEditing(goal)
    setEditForm({
      name: goal.name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      target_date: goal.target_date
        ? goal.target_date.length >= 10
          ? goal.target_date.slice(0, 10)
          : goal.target_date
        : '',
      color: goal.color || DEFAULT_COLOR,
    })
    setEditOpen(true)
  }, [])

  const openDelete = useCallback((goal: SavingsGoal) => {
    setDeleting(goal)
    setDeleteOpen(true)
  }, [])

  const openAdjust = useCallback((goal: SavingsGoal, mode: 'contribute' | 'withdraw') => {
    setAdjustGoal(goal)
    setAdjustMode(mode)
    setAdjustAmount('')
    setAdjustOpen(true)
  }, [])

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    if (!addForm.name.trim()) return
    const target_amount = parseAmount(addForm.target_amount)
    const current_amount = parseAmount(addForm.current_amount)
    if (target_amount <= 0) return

    const target_date = addForm.target_date.trim() || null
    const color = normalizeColor(addForm.color)

    createMut.mutate(
      {
        name: addForm.name.trim(),
        target_amount,
        current_amount,
        target_date,
        icon: DEFAULT_ICON,
        color,
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
    if (!editing || !editForm.name.trim()) return
    const target_amount = parseAmount(editForm.target_amount)
    const current_amount = parseAmount(editForm.current_amount)
    if (target_amount <= 0) return

    const target_date = editForm.target_date.trim() || null
    const color = normalizeColor(editForm.color)

    updateMut.mutate(
      {
        id: editing.id,
        name: editForm.name.trim(),
        target_amount,
        current_amount,
        target_date,
        color,
        icon: editing.icon || DEFAULT_ICON,
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

  const handleAdjustSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!adjustGoal) return
    const amt = parseAmount(adjustAmount)
    if (!Number.isFinite(amt) || amt <= 0) return

    const delta = adjustMode === 'contribute' ? amt : -amt
    let next = adjustGoal.current_amount + delta
    if (adjustMode === 'withdraw') {
      next = Math.max(0, next)
    }

    updateMut.mutate(
      { id: adjustGoal.id, current_amount: next },
      {
        onSuccess: () => {
          setAdjustOpen(false)
          setAdjustGoal(null)
          setAdjustAmount('')
        },
      }
    )
  }

  if (isPending) {
    return (
      <>
        <PageHeader
          title="Savings goals"
          description="Track targets, contributions, and projected completion"
        />
        <SavingsPageSkeleton />
      </>
    )
  }

  if (isError) {
    return (
      <>
        <PageHeader
          title="Savings goals"
          description="Track targets, contributions, and projected completion"
        />
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'Could not load savings goals.'}
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const isEmpty = goals.length === 0

  return (
    <>
      <PageHeader
        title="Savings goals"
        description="Track targets, contributions, and projected completion"
      >
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
                Add goal
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md" showCloseButton>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Add savings goal</DialogTitle>
                <DialogDescription>
                  Set a target and optional deadline. You can contribute or withdraw anytime.
                </DialogDescription>
              </DialogHeader>
              <GoalFormFields form={addForm} onChange={setAddForm} />
              <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                  disabled={createMut.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMut.isPending ||
                    !addForm.name.trim() ||
                    parseAmount(addForm.target_amount) <= 0
                  }
                >
                  {createMut.isPending ? 'Saving…' : 'Create goal'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {!isEmpty && (
        <SavingsSummary
          totalSaved={totals.totalSaved}
          totalTarget={totals.totalTarget}
          currency={currency}
        />
      )}

      {isEmpty ? (
        <Card className="mt-6 border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Target className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="font-medium">No savings goals yet</p>
              <p className="text-sm text-muted-foreground">
                Create a goal to visualize progress, set deadlines, and log contributions.
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
              Add goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              currency={currency}
              onEdit={openEdit}
              onDelete={openDelete}
              onContribute={(g) => openAdjust(g, 'contribute')}
              onWithdraw={(g) => openAdjust(g, 'withdraw')}
            />
          ))}
        </div>
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
              <DialogTitle>Edit goal</DialogTitle>
              <DialogDescription>
                Update amounts, deadline, or appearance for {editing?.name ?? 'this goal'}.
              </DialogDescription>
            </DialogHeader>
            <GoalFormFields form={editForm} onChange={setEditForm} />
            <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={updateMut.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  updateMut.isPending ||
                  !editForm.name.trim() ||
                  parseAmount(editForm.target_amount) <= 0
                }
              >
                {updateMut.isPending ? 'Saving…' : 'Save changes'}
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
            <DialogTitle>Delete goal?</DialogTitle>
            <DialogDescription>
              This will permanently remove{' '}
              <span className="font-medium text-foreground">{deleting?.name}</span>. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteMut.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adjustOpen}
        onOpenChange={(open) => {
          setAdjustOpen(open)
          if (!open) {
            setAdjustGoal(null)
            setAdjustAmount('')
          }
        }}
      >
        <DialogContent className="sm:max-w-sm" showCloseButton>
          <form onSubmit={handleAdjustSubmit}>
            <DialogHeader>
              <DialogTitle>
                {adjustMode === 'contribute' ? 'Contribute' : 'Withdraw'}
              </DialogTitle>
              <DialogDescription>
                {adjustGoal?.name ? (
                  <>
                    {adjustMode === 'contribute' ? 'Add to' : 'Subtract from'}{' '}
                    <span className="font-medium text-foreground">{adjustGoal.name}</span>.
                    Current balance:{' '}
                    <span className="tabular-nums">
                      {adjustGoal
                        ? formatCurrency(adjustGoal.current_amount, currency)
                        : '—'}
                    </span>
                    .
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="adjust-amount">Amount ({currency})</Label>
              <Input
                id="adjust-amount"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
              {adjustMode === 'withdraw' && adjustGoal && (
                <p className="text-xs text-muted-foreground">
                  Withdraws cannot exceed your current balance.
                </p>
              )}
            </div>
            <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustOpen(false)}
                disabled={updateMut.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  updateMut.isPending ||
                  parseAmount(adjustAmount) <= 0 ||
                  (adjustMode === 'withdraw' &&
                    adjustGoal !== null &&
                    parseAmount(adjustAmount) > adjustGoal.current_amount)
                }
              >
                {updateMut.isPending
                  ? 'Updating…'
                  : adjustMode === 'contribute'
                    ? 'Add'
                    : 'Withdraw'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
