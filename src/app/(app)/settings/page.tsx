'use client'

import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Settings,
  Palette,
  Tag,
  Trash2,
  Plus,
  Pencil,
  Download,
  AlertTriangle,
  DatabaseBackup,
  ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { CURRENCIES } from '@/lib/utils/currency'
import { useProfile, useUpdateProfile } from '@/lib/hooks/use-profile'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/lib/hooks/use-categories'
import { createClient } from '@/lib/supabase/client'
import { TRANSACTION_LIST_SELECT } from '@/lib/supabase/transaction-query'
import type { Category, CategoryType, Transaction } from '@/types/database'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { selectItemsFromCurrencies, selectItemsFromMap } from '@/lib/utils/select-items'

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

async function fetchAllTransactions(): Promise<Transaction[]> {
  const supabase = createClient()
  const pageSize = 1000
  let offset = 0
  const all: Transaction[] = []
  for (;;) {
    const { data, error } = await supabase
      .from('transactions')
      .select(TRANSACTION_LIST_SELECT)
      .order('date', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    const batch = (data ?? []) as Transaction[]
    all.push(...batch)
    if (batch.length < pageSize) break
    offset += pageSize
  }
  return all
}

function transactionsToCsv(rows: Transaction[]): string {
  const headers = [
    'date',
    'type',
    'amount',
    'description',
    'account',
    'category',
    'notes',
    'transfer_to_account_id',
    'recurring_rule_id',
  ]
  const lines = [headers.join(',')]
  for (const t of rows) {
    const accountName = t.account?.name ?? ''
    const categoryName = t.category?.name ?? ''
    const vals = [
      t.date,
      t.type,
      String(t.amount),
      t.description ?? '',
      accountName,
      categoryName,
      t.notes ?? '',
      t.transfer_to_account_id ?? '',
      t.recurring_rule_id ?? '',
    ].map((v) => escapeCsvField(String(v)))
    lines.push(vals.join(','))
  }
  return lines.join('\r\n')
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const BACKUP_TABLES = [
  'profiles',
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'savings_goals',
  'investments',
  'recurring_rules',
] as const

const SETTINGS_CURRENCY_SELECT_ITEMS = selectItemsFromCurrencies(CURRENCIES)

const CATEGORY_FORM_TYPE_ITEMS = selectItemsFromMap(['income', 'expense'], {
  income: 'Income',
  expense: 'Expense',
})

type BackupTable = (typeof BACKUP_TABLES)[number]

async function downloadFullBackup() {
  const supabase = createClient()
  const backup: Record<BackupTable, unknown[]> = {
    profiles: [],
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    savings_goals: [],
    investments: [],
    recurring_rules: [],
  }
  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw error
    backup[table] = data ?? []
  }
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const UPSERT_CHUNK = 150

function sortCategoriesForRestore(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const list = rows.filter((r): r is Record<string, unknown> => typeof r.id === 'string')
  const ids = new Set(list.map((r) => r.id as string))
  const result: Record<string, unknown>[] = []
  const remaining = new Set(list.map((r) => r.id as string))
  let progressed = true
  while (remaining.size > 0 && progressed) {
    progressed = false
    for (const id of [...remaining]) {
      const row = list.find((r) => r.id === id)
      if (!row) {
        remaining.delete(id)
        continue
      }
      const pid = row.parent_id
      const parentOk =
        pid == null ||
        typeof pid !== 'string' ||
        !ids.has(pid) ||
        !remaining.has(pid)
      if (parentOk) {
        result.push(row)
        remaining.delete(id)
        progressed = true
      }
    }
  }
  for (const id of remaining) {
    const row = list.find((r) => r.id === id)
    if (row) result.push(row)
  }
  return result
}

async function upsertChunked(
  supabase: ReturnType<typeof createClient>,
  table: BackupTable,
  rows: Record<string, unknown>[]
) {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' })
    if (error) throw error
  }
}

async function restoreFromBackupPayload(parsed: unknown) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup file must be a JSON object')
  }
  const payload = parsed as Record<string, unknown>
  const supabase = createClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr) throw userErr
  if (!user) throw new Error('Not signed in')

  for (const table of BACKUP_TABLES) {
    const raw = payload[table]
    if (raw === undefined) continue
    if (!Array.isArray(raw)) {
      throw new Error(`Invalid backup: "${table}" must be an array`)
    }
    const rows = raw.filter(
      (r): r is Record<string, unknown> =>
        r !== null && typeof r === 'object' && !Array.isArray(r)
    )
    if (rows.length === 0) continue

    let toUpsert = rows
    if (table === 'profiles') {
      toUpsert = rows.filter((r) => r.id === user.id)
      if (toUpsert.length === 0) continue
    }
    if (table === 'categories') {
      toUpsert = sortCategoriesForRestore(rows)
    }
    await upsertChunked(supabase, table, toUpsert)
  }
}

type CategoryFormState = {
  name: string
  type: CategoryType
  icon: string
  color: string
}

const emptyCategoryForm = (): CategoryFormState => ({
  name: '',
  type: 'expense',
  icon: 'tag',
  color: '#6366f1',
})

export default function SettingsPage() {
  const router = useRouter()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const updateProfile = useUpdateProfile()
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm)
  const [exporting, setExporting] = useState(false)
  const [backupDownloading, setBackupDownloading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const [dangerOpen, setDangerOpen] = useState(false)
  const [dangerConfirm, setDangerConfirm] = useState('')
  const [deletingAll, setDeletingAll] = useState(false)

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income'),
    [categories]
  )
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  )

  const openNewCategory = useCallback(() => {
    setEditing(null)
    setCategoryForm(emptyCategoryForm())
    setCategoryDialogOpen(true)
  }, [])

  const openEditCategory = useCallback((c: Category) => {
    setEditing(c)
    setCategoryForm({
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
    })
    setCategoryDialogOpen(true)
  }, [])

  const saveCategory = useCallback(() => {
    const name = categoryForm.name.trim()
    if (!name) return
    const nextSort =
      editing?.sort_order ??
      (categories.length ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0)

    if (editing) {
      updateCategory.mutate(
        {
          id: editing.id,
          name,
          type: categoryForm.type,
          icon: categoryForm.icon.trim() || 'circle',
          color: categoryForm.color,
        },
        { onSuccess: () => setCategoryDialogOpen(false) }
      )
    } else {
      createCategory.mutate(
        {
          name,
          type: categoryForm.type,
          icon: categoryForm.icon.trim() || 'circle',
          color: categoryForm.color,
          parent_id: null,
          sort_order: nextSort,
        },
        { onSuccess: () => setCategoryDialogOpen(false) }
      )
    }
  }, [categoryForm, editing, categories, createCategory, updateCategory])

  const handleExportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const rows = await fetchAllTransactions()
      const csv = transactionsToCsv(rows)
      const fname = `transactions-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
      triggerDownload(fname, csv, 'text/csv;charset=utf-8')
      toast.success(`Exported ${rows.length} transactions`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }, [])

  const handleDownloadBackup = useCallback(async () => {
    setBackupDownloading(true)
    try {
      await downloadFullBackup()
      toast.success('Backup downloaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backup failed')
    } finally {
      setBackupDownloading(false)
    }
  }, [])

  const handleRestoreFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      setRestoring(true)
      try {
        const text = await file.text()
        const parsed: unknown = JSON.parse(text)
        await restoreFromBackupPayload(parsed)
        toast.success('Backup restored')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Restore failed')
      } finally {
        setRestoring(false)
      }
    },
    []
  )

  const handleDeleteAllData = useCallback(async () => {
    if (dangerConfirm !== 'DELETE') return
    setDeletingAll(true)
    const supabase = createClient()
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser()
      if (userErr) throw userErr
      if (!user) throw new Error('Not signed in')

      const uid = user.id
      const userTables = [
        'transactions',
        'budgets',
        'recurring_rules',
        'savings_goals',
        'investments',
        'categories',
        'accounts',
      ] as const

      for (const table of userTables) {
        const { error } = await supabase.from(table).delete().eq('user_id', uid)
        if (error) throw error
      }

      const { error: profileErr } = await supabase.from('profiles').delete().eq('id', uid)
      if (profileErr) throw profileErr

      toast.success('All data removed')
      setDangerOpen(false)
      setDangerConfirm('')
      await supabase.auth.signOut()
      router.push('/login')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingAll(false)
    }
  }, [dangerConfirm, router])

  const loading = profileLoading || categoriesLoading

  return (
    <div className="pb-24 md:pb-8 space-y-8">
      <PageHeader
        title="Settings"
        description="Preferences, categories, exports, and account data."
      >
        <Settings className="size-8 text-muted-foreground hidden sm:block shrink-0" aria-hidden />
      </PageHeader>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Currency</CardTitle>
          </div>
          <CardDescription>Used for display formatting across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-w-sm">
          {profileLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <>
              <Label>Preferred currency</Label>
              <Select
                value={profile?.currency ?? 'ILS'}
                onValueChange={(code) => {
                  if (code) updateProfile.mutate({ currency: code })
                }}
                disabled={updateProfile.isPending}
                items={SETTINGS_CURRENCY_SELECT_ITEMS}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Categories</CardTitle>
            </div>
            <CardDescription>Income and expense labels used in transactions and budgets.</CardDescription>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={openNewCategory}>
            <Plus className="size-4" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              <CategoryGroup
                title="Income"
                variant="income"
                items={incomeCategories}
                onEdit={openEditCategory}
                onDelete={(id) => deleteCategory.mutate(id)}
                deletePending={deleteCategory.isPending}
              />
              <Separator />
              <CategoryGroup
                title="Expense"
                variant="expense"
                items={expenseCategories}
                onEdit={openEditCategory}
                onDelete={(id) => deleteCategory.mutate(id)}
                deletePending={deleteCategory.isPending}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Export data</CardTitle>
          </div>
          <CardDescription>Download all transactions as a CSV file.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={exporting}>
            <Download className="size-4" />
            {exporting ? 'Exporting…' : 'Download transactions CSV'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DatabaseBackup className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Backup &amp; restore</CardTitle>
          </div>
          <CardDescription>
            Download all tables as one JSON file, or restore from a previous backup. Existing rows with
            the same id are updated.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap">
          <Button
            variant="outline"
            className="gap-2 w-fit"
            onClick={handleDownloadBackup}
            disabled={backupDownloading || restoring}
          >
            <DatabaseBackup className="size-4" />
            {backupDownloading ? 'Preparing…' : 'Download backup'}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={restoreInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={handleRestoreFileChange}
              aria-label="Restore from backup JSON file"
            />
            <Button
              variant="secondary"
              className="gap-2 w-fit"
              disabled={restoring || backupDownloading}
              onClick={() => restoreInputRef.current?.click()}
            >
              {restoring ? 'Restoring…' : 'Restore from backup'}
            </Button>
            <span className="text-xs text-muted-foreground">Choose a .json file exported from this app.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Receipt uploads</CardTitle>
            </div>
            <Badge
              variant="secondary"
              className="shrink-0 pointer-events-none opacity-50 select-none"
              aria-disabled
            >
              Coming soon
            </Badge>
          </div>
          <CardDescription>
            Receipt uploads — Coming soon. Attach receipt photos to transactions using Supabase Storage.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            <CardTitle className="text-base">Danger zone</CardTitle>
          </div>
          <CardDescription>
            Permanently delete all financial data for your account. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="gap-2" onClick={() => setDangerOpen(true)}>
            <Trash2 className="size-4" />
            Delete all my data
          </Button>
        </CardContent>
      </Card>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Groceries"
              />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={categoryForm.type}
                onValueChange={(v) =>
                  setCategoryForm((f) => ({ ...f, type: (v ?? 'expense') as CategoryType }))
                }
                items={CATEGORY_FORM_TYPE_ITEMS}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="cat-color">Color</Label>
                <Input
                  id="cat-color"
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-10 cursor-pointer px-1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-icon">Icon</Label>
                <Input
                  id="cat-icon"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="emoji or label"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveCategory}
              disabled={
                !categoryForm.name.trim() ||
                createCategory.isPending ||
                updateCategory.isPending
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dangerOpen} onOpenChange={(o) => !deletingAll && setDangerOpen(o)}>
        <DialogContent className="sm:max-w-md" showCloseButton={!deletingAll}>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete all data?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes transactions, accounts, categories, budgets, savings goals, investments,
            recurring rules, and your profile row. You will be signed out.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="del-confirm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="del-confirm"
              value={dangerConfirm}
              onChange={(e) => setDangerConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              disabled={deletingAll}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDangerOpen(false)} disabled={deletingAll}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllData}
              disabled={dangerConfirm !== 'DELETE' || deletingAll}
            >
              {deletingAll ? 'Deleting…' : 'Delete everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CategoryGroup({
  title,
  variant,
  items,
  onEdit,
  onDelete,
  deletePending,
}: {
  title: string
  variant: 'income' | 'expense'
  items: Category[]
  onEdit: (c: Category) => void
  onDelete: (id: string) => void
  deletePending: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Badge
          variant="secondary"
          className={cn(
            variant === 'income' &&
              'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
            variant === 'expense' && 'bg-red-600/10 text-red-700 dark:text-red-400'
          )}
        >
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="size-3 rounded-full shrink-0 ring-2 ring-background"
                  style={{ backgroundColor: c.color }}
                  title={c.color}
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.icon}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" onClick={() => onEdit(c)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(c.id)}
                  disabled={deletePending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
