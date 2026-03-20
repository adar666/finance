'use client'

import { useMemo, useState, useCallback, type FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Plus,
  Wallet,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Banknote,
  Pencil,
  Trash2,
  Building2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { formatCurrency } from '@/lib/utils/currency'
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from '@/lib/hooks/use-accounts'
import { useCurrency } from '@/lib/hooks/use-currency'
import type { Account, AccountType } from '@/types/database'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { selectItemsFromMap } from '@/lib/utils/select-items'

const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'checking',
  'savings',
  'credit',
  'investment',
  'cash',
]

const TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit',
  investment: 'Investment',
  cash: 'Cash',
}

const ACCOUNT_TYPE_SELECT_ITEMS = selectItemsFromMap(ACCOUNT_TYPE_ORDER, TYPE_LABELS)

const TYPE_ICONS: Record<AccountType, LucideIcon> = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  cash: Banknote,
}

function iconSlugForType(type: AccountType): string {
  const map: Record<AccountType, string> = {
    checking: 'wallet',
    savings: 'piggy-bank',
    credit: 'credit-card',
    investment: 'trending-up',
    cash: 'banknote',
  }
  return map[type]
}

type AccountFormState = {
  name: string
  type: AccountType
  institution: string
  balance: string
  color: string
}

const DEFAULT_FORM: AccountFormState = {
  name: '',
  type: 'checking',
  institution: '',
  balance: '0',
  color: '#2563eb',
}

function parseBalance(value: string): number {
  const n = Number.parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function groupAccountsByType(accounts: Account[]): Map<AccountType, Account[]> {
  const map = new Map<AccountType, Account[]>()
  for (const t of ACCOUNT_TYPE_ORDER) {
    map.set(t, [])
  }
  for (const a of accounts) {
    const list = map.get(a.type)
    if (list) {
      list.push(a)
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }
  return map
}

function NetWorthSummary({ total, currency }: { total: number; currency: string }) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Net worth (active accounts)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            'text-3xl font-bold tracking-tight tabular-nums',
            total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          )}
        >
          {formatCurrency(total, currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sum of balances across all accounts marked active
        </p>
      </CardContent>
    </Card>
  )
}

function AccountTypeIcon({ type, className }: { type: AccountType; className?: string }) {
  const Icon = TYPE_ICONS[type]
  return <Icon className={cn('h-5 w-5', className)} aria-hidden />
}

function AccountCard({
  account,
  currency,
  onEdit,
  onDelete,
}: {
  account: Account
  currency: string
  onEdit: (a: Account) => void
  onDelete: (a: Account) => void
}) {
  const balance = account.balance
  const positive = balance >= 0

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-border/80 transition-shadow hover:shadow-md',
        !account.is_active && 'opacity-70'
      )}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: account.color || 'var(--primary)' }}
        aria-hidden
      />
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2 pl-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted"
            style={{ color: account.color || undefined }}
          >
            <AccountTypeIcon type={account.type} />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-semibold leading-tight">
              {account.name}
            </CardTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-xs font-normal">
                {TYPE_LABELS[account.type]}
              </Badge>
              {!account.is_active && (
                <Badge variant="outline" className="text-xs font-normal">
                  Inactive
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(account)}
            aria-label={`Edit ${account.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(account)}
            aria-label={`Delete ${account.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pl-5">
        {account.institution ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{account.institution}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/70">No institution</p>
        )}
        <p
          className={cn(
            'text-xl font-semibold tabular-nums',
            positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          )}
        >
          {formatCurrency(balance, currency)}
        </p>
      </CardContent>
    </Card>
  )
}

function AccountFormFields({
  form,
  onChange,
  balanceLabel,
}: {
  form: AccountFormState
  onChange: (next: AccountFormState) => void
  balanceLabel: string
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="account-name">Name</Label>
        <Input
          id="account-name"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. Main checking"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="account-type">Type</Label>
        <Select
          value={form.type}
          onValueChange={(v) => onChange({ ...form, type: v as AccountType })}
          items={ACCOUNT_TYPE_SELECT_ITEMS}
        >
          <SelectTrigger id="account-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPE_ORDER.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="account-institution">Institution</Label>
        <Input
          id="account-institution"
          value={form.institution}
          onChange={(e) => onChange({ ...form, institution: e.target.value })}
          placeholder="Bank or card issuer (optional)"
          autoComplete="organization"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="account-balance">{balanceLabel}</Label>
        <Input
          id="account-balance"
          type="number"
          inputMode="decimal"
          step="any"
          value={form.balance}
          onChange={(e) => onChange({ ...form, balance: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="account-color">Color</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="account-color"
            type="color"
            value={
              (() => {
                const c = form.color.trim()
                if (!c) return DEFAULT_FORM.color
                return c.startsWith('#') ? c : `#${c}`
              })()
            }
            onChange={(e) => onChange({ ...form, color: e.target.value })}
            className="h-10 w-14 shrink-0 cursor-pointer p-1"
            aria-label="Pick account color"
          />
          <Input
            value={form.color}
            onChange={(e) => onChange({ ...form, color: e.target.value })}
            placeholder="#2563eb"
            className="min-w-0 flex-1 font-mono text-sm"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}

function AccountsPageSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AccountsPage() {
  const currency = useCurrency()
  const { data: accounts = [], isPending, isError, error } = useAccounts()
  const createMut = useCreateAccount()
  const updateMut = useUpdateAccount()
  const deleteMut = useDeleteAccount()

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)

  const [addForm, setAddForm] = useState<AccountFormState>(DEFAULT_FORM)
  const [editForm, setEditForm] = useState<AccountFormState>(DEFAULT_FORM)

  const netWorth = useMemo(() => {
    return accounts.filter((a) => a.is_active).reduce((sum, a) => sum + a.balance, 0)
  }, [accounts])

  const grouped = useMemo(() => groupAccountsByType(accounts), [accounts])

  const resetAddForm = useCallback(() => setAddForm(DEFAULT_FORM), [])

  const openEdit = useCallback((account: Account) => {
    setEditing(account)
    setEditForm({
      name: account.name,
      type: account.type,
      institution: account.institution ?? '',
      balance: String(account.balance),
      color: account.color || DEFAULT_FORM.color,
    })
    setEditOpen(true)
  }, [])

  const openDelete = useCallback((account: Account) => {
    setDeleting(account)
    setDeleteOpen(true)
  }, [])

  const handleCreate = (e: FormEvent) => {
    e.preventDefault()
    if (!addForm.name.trim()) return
    const balance = parseBalance(addForm.balance)
    const color =
      addForm.color.startsWith('#') ? addForm.color : addForm.color ? `#${addForm.color}` : DEFAULT_FORM.color

    createMut.mutate(
      {
        name: addForm.name.trim(),
        type: addForm.type,
        balance,
        institution: addForm.institution.trim() || null,
        color,
        icon: iconSlugForType(addForm.type),
        is_active: true,
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
    const balance = parseBalance(editForm.balance)
    const color =
      editForm.color.startsWith('#')
        ? editForm.color
        : editForm.color
          ? `#${editForm.color}`
          : DEFAULT_FORM.color

    updateMut.mutate(
      {
        id: editing.id,
        name: editForm.name.trim(),
        type: editForm.type,
        balance,
        institution: editForm.institution.trim() || null,
        color,
        icon: iconSlugForType(editForm.type),
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

  if (isPending) {
    return (
      <>
        <PageHeader title="Accounts" description="Balances, institutions, and account types" />
        <AccountsPageSkeleton />
      </>
    )
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Accounts" description="Balances, institutions, and account types" />
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'Could not load accounts.'}
            </p>
          </CardContent>
        </Card>
      </>
    )
  }

  const isEmpty = accounts.length === 0

  return (
    <>
      <PageHeader title="Accounts" description="Balances, institutions, and account types">
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
                Add account
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md" showCloseButton>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Add account</DialogTitle>
                <DialogDescription>
                  Create a new account. Balances can be updated later from transactions.
                </DialogDescription>
              </DialogHeader>
              <AccountFormFields
                form={addForm}
                onChange={setAddForm}
                balanceLabel="Initial balance"
              />
              <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                  disabled={createMut.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMut.isPending || !addForm.name.trim()}>
                  {createMut.isPending ? 'Saving…' : 'Create account'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {!isEmpty && <NetWorthSummary total={netWorth} currency={currency} />}

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Wallet className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="font-medium">No accounts yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first account to track balances and assign transactions.
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
              Add account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 space-y-10">
          {ACCOUNT_TYPE_ORDER.map((type) => {
            const list = grouped.get(type) ?? []
            if (list.length === 0) return null
            const SectionIcon = TYPE_ICONS[type]
            return (
              <section key={type} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <SectionIcon className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold tracking-tight">{TYPE_LABELS[type]}</h2>
                  <Badge variant="outline" className="ml-1 font-normal">
                    {list.length}
                  </Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      currency={currency}
                      onEdit={openEdit}
                      onDelete={openDelete}
                    />
                  ))}
                </div>
              </section>
            )
          })}
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
              <DialogTitle>Edit account</DialogTitle>
              <DialogDescription>Update details for {editing?.name ?? 'this account'}.</DialogDescription>
            </DialogHeader>
            <AccountFormFields
              form={editForm}
              onChange={setEditForm}
              balanceLabel="Balance"
            />
            <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={updateMut.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMut.isPending || !editForm.name.trim()}>
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
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This will permanently remove{' '}
              <span className="font-medium text-foreground">{deleting?.name}</span> and cannot be undone.
              Linked transactions may be affected depending on your database rules.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-0 bg-transparent p-0 pt-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteMut.isPending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
