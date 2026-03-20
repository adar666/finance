'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import {
  Plus,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  Upload,
  Trash2,
  Filter,
  Loader2,
  Receipt,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { PageHeader } from '@/components/layout/page-header'
import { PrivateMoney } from '@/components/layout/privacy-mode'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import {
  useTransactions,
  useCreateTransaction,
  useDeleteTransaction,
  useBulkCreateTransactions,
} from '@/lib/hooks/use-transactions'
import { useCurrency } from '@/lib/hooks/use-currency'
import { useAccounts } from '@/lib/hooks/use-accounts'
import { useCategories } from '@/lib/hooks/use-categories'
import { parseCSV, mapCSVToTransactions, type ColumnMapping } from '@/lib/utils/csv-parser'
import { parseBankPDF } from '@/lib/parsers/parse-bank-pdf'
import type { ParsedTransaction, BankDetectionResult } from '@/lib/parsers/types'
import { useCategorizationRules } from '@/lib/hooks/use-categorization-rules'
import { applyCategoryRules, matchIsracardCategory } from '@/lib/utils/auto-categorize'
import type { Transaction, TransactionType, Category } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { consumeAddTransactionQueryParam } from '@/lib/navigation/transaction-add-query'
import {
  selectItemsFromEntities,
  selectItemsWithNone,
  selectItemsWithNoneCategories,
} from '@/lib/utils/select-items'
import { getCategoryDisplayName } from '@/lib/utils/category-display-name'

const PAGE_SIZE = 50
const NONE = '__none__'

type TypeFilter = 'all' | TransactionType

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function normalizeImportedDate(raw: string): string {
  const t = raw.trim()
  if (!t) return todayISO()
  const isoTry = parseISO(t)
  if (isValid(isoTry)) return format(isoTry, 'yyyy-MM-dd')
  const d = new Date(t)
  if (isValid(d)) return format(d, 'yyyy-MM-dd')
  return todayISO()
}

function resolveCategoryId(
  categories: Category[],
  type: 'income' | 'expense',
  name: string | undefined
): string | null {
  if (!name?.trim()) return null
  const n = name.trim().toLowerCase()
  const match = categories.find((c) => {
    if (c.type !== type) return false
    if (c.name.toLowerCase() === n) return true
    const he = c.name_he?.trim().toLowerCase()
    return he === n
  })
  return match?.id ?? null
}

function summaryFromTransactions(list: Transaction[]) {
  let income = 0
  let expense = 0
  for (const t of list) {
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return { income, expense, net: income - expense }
}

function typeIcon(t: TransactionType) {
  switch (t) {
    case 'income':
      return <ArrowUpCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
    case 'expense':
      return <ArrowDownCircle className="size-4 text-red-600 dark:text-red-400" />
    default:
      return <ArrowLeftRight className="size-4 text-muted-foreground" />
  }
}

export default function TransactionsPage() {
  const currency = useCurrency()
  const locale = useLocale()
  const t = useTranslations()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [fetchLimit, setFetchLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => window.clearTimeout(id)
  }, [searchInput])

  const filters = useMemo(
    () => ({
      ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(minAmount.trim() ? { minAmount: parseFloat(minAmount) } : {}),
      ...(maxAmount.trim() ? { maxAmount: parseFloat(maxAmount) } : {}),
    }),
    [typeFilter, startDate, endDate, debouncedSearch, minAmount, maxAmount]
  )

  useEffect(() => {
    setFetchLimit(PAGE_SIZE)
  }, [typeFilter, startDate, endDate, debouncedSearch, minAmount, maxAmount])

  const { data: allFiltered = [] } = useTransactions(filters)
  const {
    data: transactions = [],
    isLoading,
    isError,
    error,
  } = useTransactions({ ...filters, limit: fetchLimit })
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts()
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()
  const createTx = useCreateTransaction(t('transactions.transactionAdded'))
  const deleteTx = useDeleteTransaction(t('transactions.transactionDeleted'))
  const bulkCreate = useBulkCreateTransactions()
  const { data: catRules = [] } = useCategorizationRules()

  const summary = useMemo(() => summaryFromTransactions(allFiltered), [allFiltered])

  const accountMap = useMemo(() => {
    const m = new Map<string, (typeof accounts)[0]>()
    for (const a of accounts) m.set(a.id, a)
    return m
  }, [accounts])

  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    if (consumeAddTransactionQueryParam('/transactions')) {
      setAddOpen(true)
    }
  }, [])

  const [formType, setFormType] = useState<TransactionType>('expense')
  const [formAmount, setFormAmount] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDate, setFormDate] = useState(() => todayISO())
  const [formAccountId, setFormAccountId] = useState('')
  const [formToAccountId, setFormToAccountId] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const resetAddForm = useCallback(() => {
    setFormType('expense')
    setFormAmount('')
    setFormDescription('')
    setFormDate(todayISO())
    setFormAccountId('')
    setFormToAccountId('')
    setFormCategoryId('')
    setFormNotes('')
  }, [])

  const categoriesForType = useMemo(() => {
    if (formType === 'transfer') return []
    return categories.filter((c) => c.type === formType)
  }, [categories, formType])

  const importAccountSelectItems = useMemo(() => selectItemsFromEntities(accounts), [accounts])

  const addTxAccountItems = useMemo(() => selectItemsWithNone(NONE, '—', accounts), [accounts])

  const addTxToAccountItems = useMemo(
    () => selectItemsWithNone(NONE, '—', accounts.filter((a) => a.id !== formAccountId)),
    [accounts, formAccountId]
  )

  const addTxCategoryItems = useMemo(
    () => selectItemsWithNoneCategories(NONE, t('common.none'), categoriesForType, locale),
    [categoriesForType, t, locale]
  )

  useEffect(() => {
    if (formType === 'transfer') {
      setFormCategoryId('')
    } else if (formCategoryId) {
      const stillValid = categoriesForType.some((c) => c.id === formCategoryId)
      if (!stillValid) setFormCategoryId('')
    }
  }, [formType, formCategoryId, categoriesForType])

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(formAmount.replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) return
    if (!formAccountId) return
    if (formType === 'transfer') {
      if (!formToAccountId || formToAccountId === formAccountId) return
      createTx.mutate(
        {
          account_id: formAccountId,
          transfer_to_account_id: formToAccountId,
          category_id: null,
          amount,
          type: 'transfer',
          description: formDescription.trim() || 'Transfer',
          date: formDate,
          notes: formNotes.trim() || null,
          recurring_rule_id: null,
        },
        {
          onSuccess: () => {
            setAddOpen(false)
            resetAddForm()
          },
        }
      )
      return
    }
    let resolvedCategoryId = formCategoryId || null
    if (!resolvedCategoryId && formDescription.trim()) {
      resolvedCategoryId = applyCategoryRules(formDescription.trim(), catRules) || null
    }
    createTx.mutate(
      {
        account_id: formAccountId,
        transfer_to_account_id: null,
        category_id: resolvedCategoryId,
        amount,
        type: formType,
        description: formDescription.trim() || (formType === 'income' ? 'Income' : 'Expense'),
        date: formDate,
        notes: formNotes.trim() || null,
        recurring_rule_id: null,
      },
      {
        onSuccess: () => {
          setAddOpen(false)
          resetAddForm()
        },
      }
    )
  }

  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [csvParseErrors, setCsvParseErrors] = useState<string[]>([])
  const [mapDate, setMapDate] = useState('')
  const [mapAmount, setMapAmount] = useState('')
  const [mapDescription, setMapDescription] = useState('')
  const [mapCategory, setMapCategory] = useState('')
  const [mapNotes, setMapNotes] = useState('')
  const [importAccountId, setImportAccountId] = useState('')

  const [importMode, setImportMode] = useState<'csv' | 'pdf'>('csv')
  const [pdfParsing, setPdfParsing] = useState(false)
  const [pdfBank, setPdfBank] = useState<BankDetectionResult | null>(null)
  const [pdfTransactions, setPdfTransactions] = useState<ParsedTransaction[]>([])
  const [pdfErrors, setPdfErrors] = useState<string[]>([])
  const [pdfSelected, setPdfSelected] = useState<Set<number>>(new Set())
  const [dragging, setDragging] = useState(false)

  const csvMappingItemsDashNone = useMemo(
    () => [{ value: NONE, label: '—' }, ...csvHeaders.map((h) => ({ value: h, label: h }))],
    [csvHeaders]
  )

  const csvMappingItemsNoneNone = useMemo(
    () => [{ value: NONE, label: t('common.none') }, ...csvHeaders.map((h) => ({ value: h, label: h }))],
    [csvHeaders, t]
  )

  const resetImport = useCallback(() => {
    setImportStep(1)
    setCsvFile(null)
    setCsvHeaders([])
    setCsvRows([])
    setCsvParseErrors([])
    setMapDate('')
    setMapAmount('')
    setMapDescription('')
    setMapCategory('')
    setMapNotes('')
    setImportAccountId('')
    setImportMode('csv')
    setPdfParsing(false)
    setPdfBank(null)
    setPdfTransactions([])
    setPdfErrors([])
    setPdfSelected(new Set())
    setDragging(false)
  }, [])

  async function onImportFileChange(file: File | null) {
    setCsvFile(file)
    setCsvHeaders([])
    setCsvRows([])
    setCsvParseErrors([])
    setPdfTransactions([])
    setPdfErrors([])
    setPdfBank(null)
    setPdfSelected(new Set())
    if (!file) return

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'

    if (isPdf) {
      setImportMode('pdf')
      setPdfParsing(true)
      try {
        const result = await parseBankPDF(file)
        setPdfBank(result.bank)

        const dates = result.transactions.map((tx) => tx.date).filter(Boolean)
        let existingTxs: Transaction[] = []
        if (dates.length > 0) {
          const minDate = dates.reduce((a, b) => (a < b ? a : b))
          const maxDate = dates.reduce((a, b) => (a > b ? a : b))
          const supabase = (await import('@/lib/supabase/client')).createClient()
          const { data } = await supabase
            .from('transactions')
            .select('date, amount')
            .gte('date', minDate)
            .lte('date', maxDate)
          existingTxs = (data ?? []) as Transaction[]
        }

        const flagged = result.transactions.map((tx) => {
          const isDup = existingTxs.some(
            (e) => e.date === tx.date && Math.abs(e.amount - tx.amount) < 0.01
          )
          if (isDup && !tx.flags?.includes('duplicate_suspect')) {
            return { ...tx, flags: [...(tx.flags ?? []), 'duplicate_suspect' as const] }
          }
          return tx
        })

        setPdfTransactions(flagged)
        setPdfErrors(result.errors)
        const selected = new Set<number>()
        flagged.forEach((tx, i) => {
          if (!tx.flags?.includes('credit_card_aggregate')) {
            selected.add(i)
          }
        })
        setPdfSelected(selected)
      } catch (err) {
        setPdfErrors([err instanceof Error ? err.message : 'Failed to parse PDF'])
      } finally {
        setPdfParsing(false)
      }
    } else {
      setImportMode('csv')
      const result = await parseCSV(file)
      setCsvParseErrors(result.errors)
      setCsvHeaders(result.headers)
      setCsvRows(result.rows)
      const h = result.headers
      const guess = (candidates: string[]) =>
        h.find((x) => candidates.some((c) => x.toLowerCase().includes(c))) ?? ''
      setMapDate(guess(['date', 'תאריך']))
      setMapAmount(guess(['amount', 'sum', 'סכום']))
      setMapDescription(guess(['description', 'memo', 'details', 'payee', 'תיאור']))
      setMapCategory(guess(['category', 'קטגוריה']))
      setMapNotes(guess(['note', 'notes', 'comment']))
    }
  }

  function togglePdfRow(idx: number) {
    setPdfSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const columnMapping: ColumnMapping = useMemo(
    () => ({
      date: mapDate,
      amount: mapAmount,
      description: mapDescription,
      ...(mapCategory ? { category: mapCategory } : {}),
      ...(mapNotes ? { notes: mapNotes } : {}),
    }),
    [mapDate, mapAmount, mapDescription, mapCategory, mapNotes]
  )

  const mappingValid = Boolean(
    mapDate &&
      mapAmount &&
      mapDescription &&
      csvHeaders.includes(mapDate) &&
      csvHeaders.includes(mapAmount) &&
      csvHeaders.includes(mapDescription)
  )

  const previewMapped = useMemo(() => {
    if (!mappingValid || csvRows.length === 0) return []
    const base = mapCSVToTransactions(csvRows, columnMapping)
    return base.slice(0, 15).map((row, i) => {
      const rawRow = csvRows[i]
      const catName = mapCategory && rawRow ? rawRow[mapCategory] : ''
      return { ...row, _categoryName: catName }
    })
  }, [mappingValid, csvRows, columnMapping, mapCategory])

  const bulkPayload = useMemo(() => {
    if (!mappingValid || !importAccountId) return []
    const mapped = mapCSVToTransactions(csvRows, columnMapping)
    return mapped
      .map((row, i) => {
        const rawRow = csvRows[i]
        const catName = mapCategory && rawRow ? rawRow[mapCategory]?.trim() : ''
        const category_id = resolveCategoryId(categories, row.type, catName)
        return {
          account_id: importAccountId,
          category_id,
          amount: row.amount,
          type: row.type,
          description: row.description.trim() || 'Imported',
          date: normalizeImportedDate(row.date),
          notes: row.notes,
          transfer_to_account_id: null,
          recurring_rule_id: null,
        }
      })
      .filter((row) => row.amount > 0 && row.description)
  }, [mappingValid, importAccountId, csvRows, columnMapping, categories, mapCategory])

  const pdfBulkPayload = useMemo(() => {
    if (!importAccountId || pdfTransactions.length === 0) return []
    return pdfTransactions
      .filter((_, i) => pdfSelected.has(i))
      .map((tx) => {
        let category_id: string | null = null
        const ruleMatch = applyCategoryRules(tx.description, catRules)
        if (ruleMatch) {
          category_id = ruleMatch
        } else if (tx.sourceCategory) {
          const mapped = matchIsracardCategory(tx.sourceCategory, categories)
          if (mapped) category_id = mapped
        }
        return {
          account_id: importAccountId,
          category_id,
          amount: tx.amount,
          type: tx.type,
          description: tx.description.trim() || 'Imported',
          date: tx.date,
          notes: tx.sourceCategory || null,
          transfer_to_account_id: null,
          recurring_rule_id: null,
        }
      })
      .filter((row) => row.amount > 0 && row.description)
  }, [importAccountId, pdfTransactions, pdfSelected, catRules, categories])

  const activePayload = importMode === 'pdf' ? pdfBulkPayload : bulkPayload

  function handleBulkImport() {
    if (activePayload.length === 0) return
    bulkCreate.mutate(activePayload, {
      onSuccess: () => {
        setImportOpen(false)
        resetImport()
      },
    })
  }

  const canProceedStep1Csv = Boolean(csvFile && csvRows.length > 0 && csvParseErrors.length === 0)
  const canProceedStep1Pdf = Boolean(csvFile && pdfTransactions.length > 0 && !pdfParsing)

  function handleDelete(id: string) {
    if (!window.confirm(t('transactions.deleteConfirm'))) return
    deleteTx.mutate(id)
  }

  const headerSelectItem = (key: string) => (
    <SelectItem key={key} value={key}>
      {key}
    </SelectItem>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('transactions.title')}
        description={t('transactions.description')}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="size-4" />
          {t('transactions.importFile')}
        </Button>
        <Dialog
          open={importOpen}
          onOpenChange={(o) => {
            setImportOpen(o)
            if (!o) resetImport()
          }}
        >
          <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('transactions.importDialogTitle')}</DialogTitle>
            </DialogHeader>
            <div className="flex gap-1 text-xs text-muted-foreground">
              <span className={importStep >= 1 ? 'font-medium text-foreground' : ''}>{t('transactions.stepUpload')}</span>
              <span>→</span>
              {importMode === 'csv' && (
                <>
                  <span className={importStep >= 2 ? 'font-medium text-foreground' : ''}>{t('transactions.stepMap')}</span>
                  <span>→</span>
                </>
              )}
              <span className={importStep >= 3 ? 'font-medium text-foreground' : ''}>{t('transactions.stepPreview')}</span>
            </div>

            {importStep === 1 && (
              <div className="space-y-4">
                <div
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors',
                    dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
                    'cursor-pointer hover:border-primary/50'
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    const file = e.dataTransfer.files[0]
                    if (file) onImportFileChange(file)
                  }}
                  onClick={() => document.getElementById('import-file-input')?.click()}
                >
                  <Upload className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('transactions.dragDropHint')}</p>
                  <p className="text-xs text-muted-foreground">{t('transactions.acceptedFormats')}</p>
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".csv,.pdf,text/csv,application/pdf"
                    className="hidden"
                    onChange={(e) => onImportFileChange(e.target.files?.[0] ?? null)}
                  />
                </div>

                {csvFile && (
                  <div className="flex items-center gap-2 text-sm">
                    <Receipt className="size-4" />
                    <span className="font-medium">{csvFile.name}</span>
                    {importMode === 'csv' && (
                      <span className="text-muted-foreground">— {csvRows.length} row{csvRows.length === 1 ? '' : 's'}</span>
                    )}
                    {importMode === 'pdf' && pdfParsing && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> {t('transactions.parsingPdf')}
                      </span>
                    )}
                    {importMode === 'pdf' && !pdfParsing && pdfTransactions.length > 0 && (
                      <>
                        {pdfBank && (
                          <Badge variant="secondary" className="capitalize">
                            {pdfBank.bank === 'unknown' ? t('transactions.unknownBank') : pdfBank.bank}
                          </Badge>
                        )}
                        <span className="text-muted-foreground">
                          — {t('transactions.transactionsFound', { count: pdfTransactions.length })}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {csvParseErrors.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {csvParseErrors.slice(0, 3).map((err) => (
                      <p key={err}>{err}</p>
                    ))}
                  </div>
                )}
                {pdfErrors.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {pdfErrors.slice(0, 3).map((err) => (
                      <p key={err}>{err}</p>
                    ))}
                  </div>
                )}

                {importMode === 'pdf' && !pdfParsing && pdfTransactions.some(tx => tx.flags?.includes('credit_card_aggregate')) && (
                  <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                    {t('transactions.creditCardAggregateWarning')}
                  </div>
                )}

                <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  {importMode === 'csv' ? (
                    <Button type="button" disabled={!canProceedStep1Csv} onClick={() => setImportStep(2)}>
                      {t('common.next')}
                    </Button>
                  ) : (
                    <Button type="button" disabled={!canProceedStep1Pdf} onClick={() => setImportStep(3)}>
                      {t('transactions.reviewTransactions')}
                    </Button>
                  )}
                </DialogFooter>
              </div>
            )}

            {importStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('transactions.matchColumns', { count: csvHeaders.length })}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('transactions.dateColumn')}</Label>
                    <Select
                      value={mapDate || NONE}
                      onValueChange={(v) => setMapDate(v == null || v === NONE ? '' : v)}
                      items={csvMappingItemsDashNone}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('transactions.selectColumn')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {csvHeaders.map(headerSelectItem)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('transactions.amountColumn')}</Label>
                    <Select
                      value={mapAmount || NONE}
                      onValueChange={(v) => setMapAmount(v == null || v === NONE ? '' : v)}
                      items={csvMappingItemsDashNone}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('transactions.selectColumn')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {csvHeaders.map(headerSelectItem)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>{t('transactions.descriptionColumn')}</Label>
                    <Select
                      value={mapDescription || NONE}
                      onValueChange={(v) => setMapDescription(v == null || v === NONE ? '' : v)}
                      items={csvMappingItemsDashNone}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('transactions.selectColumn')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {csvHeaders.map(headerSelectItem)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('transactions.categoryOptional')}</Label>
                    <Select
                      value={mapCategory || NONE}
                      onValueChange={(v) =>
                        setMapCategory(v != null && v !== NONE ? v : '')
                      }
                      items={csvMappingItemsNoneNone}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('common.none')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                        {csvHeaders.map(headerSelectItem)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('transactions.notesOptional')}</Label>
                    <Select
                      value={mapNotes || NONE}
                      onValueChange={(v) => setMapNotes(v == null || v === NONE ? '' : v)}
                      items={csvMappingItemsNoneNone}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('common.none')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                        {csvHeaders.map(headerSelectItem)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setImportStep(1)}>
                    {t('common.back')}
                  </Button>
                  <Button type="button" disabled={!mappingValid} onClick={() => setImportStep(3)}>
                    {t('common.next')}
                  </Button>
                </DialogFooter>
              </div>
            )}

            {importStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('transactions.defaultAccount')}</Label>
                  <Select
                    value={importAccountId || null}
                    onValueChange={(v) => setImportAccountId(v ?? '')}
                    items={importAccountSelectItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={accountsLoading ? t('common.loading') : t('transactions.selectAccount')} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('transactions.importHelperText')}
                  </p>
                </div>

                {importMode === 'csv' && (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('common.date')}</TableHead>
                            <TableHead>{t('common.type')}</TableHead>
                            <TableHead>{t('common.description')}</TableHead>
                            <TableHead className="text-end">{t('common.amount')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewMapped.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                {t('transactions.noPreviewRows')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            previewMapped.map((row, i) => (
                              <TableRow key={i}>
                                <TableCell className="whitespace-nowrap">{normalizeImportedDate(row.date)}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="capitalize">
                                    {row.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[180px] truncate">{row.description}</TableCell>
                                <TableCell
                                  className={cn(
                                    'text-end tabular-nums',
                                    row.type === 'income' && 'text-emerald-600 dark:text-emerald-400',
                                    row.type === 'expense' && 'text-red-600 dark:text-red-400'
                                  )}
                                >
                                  <PrivateMoney>{formatCurrency(row.amount, currency)}</PrivateMoney>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {csvRows.length > previewMapped.length && (
                      <p className="text-xs text-muted-foreground">
                        Showing first {previewMapped.length} of {csvRows.length} rows. Import will include all valid rows (
                        {bulkPayload.length} ready).
                      </p>
                    )}
                    {csvRows.length <= previewMapped.length && (
                      <p className="text-xs text-muted-foreground">{bulkPayload.length} transaction(s) ready to import.</p>
                    )}
                  </>
                )}

                {importMode === 'pdf' && (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>{t('common.date')}</TableHead>
                            <TableHead>{t('common.type')}</TableHead>
                            <TableHead>{t('common.description')}</TableHead>
                            <TableHead className="text-end">{t('common.amount')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pdfTransactions.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">
                                {t('transactions.noPreviewRows')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            pdfTransactions.map((tx, i) => {
                              const isCcAgg = tx.flags?.includes('credit_card_aggregate')
                              const isDupSuspect = tx.flags?.includes('duplicate_suspect')
                              return (
                                <TableRow key={i} className={cn(isCcAgg && 'opacity-60', isDupSuspect && 'bg-orange-500/5')}>
                                  <TableCell>
                                    <Checkbox
                                      checked={pdfSelected.has(i)}
                                      onCheckedChange={() => togglePdfRow(i)}
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">{tx.date}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <Badge variant="secondary" className="capitalize">{tx.type}</Badge>
                                      {isCcAgg && (
                                        <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400 text-[10px]">
                                          {t('transactions.ccAggregate')}
                                        </Badge>
                                      )}
                                      {isDupSuspect && (
                                        <Badge variant="outline" className="border-orange-500 text-orange-600 dark:text-orange-400 text-[10px]">
                                          {t('transactions.duplicateSuspect')}
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-[180px] truncate">
                                    {tx.description}
                                    {tx.sourceCategory && (
                                      <span className="ms-1 text-xs text-muted-foreground">({tx.sourceCategory})</span>
                                    )}
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      'text-end tabular-nums',
                                      tx.type === 'income' && 'text-emerald-600 dark:text-emerald-400',
                                      tx.type === 'expense' && 'text-red-600 dark:text-red-400'
                                    )}
                                  >
                                    <PrivateMoney>{formatCurrency(tx.amount, currency)}</PrivateMoney>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('transactions.pdfImportReady', { selected: pdfSelected.size, total: pdfTransactions.length })}
                    </p>
                  </>
                )}

                <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setImportStep(importMode === 'csv' ? 2 : 1)}>
                    {t('common.back')}
                  </Button>
                  <Button
                    type="button"
                    disabled={!importAccountId || activePayload.length === 0 || bulkCreate.isPending}
                    onClick={handleBulkImport}
                    className="gap-1.5"
                  >
                    {bulkCreate.isPending && <Loader2 className="size-4 animate-spin" />}
                    {t('transactions.importCount', { count: activePayload.length })}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Button type="button" size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          {t('transactions.addTransaction')}
        </Button>
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o)
            if (!o) resetAddForm()
          }}
        >
          <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('transactions.newTransaction')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <Tabs
                value={formType}
                onValueChange={(v) => v && setFormType(v as TransactionType)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="income" className="gap-1 text-xs sm:text-sm">
                    <ArrowUpCircle className="size-3.5 shrink-0" />
                    {t('common.income')}
                  </TabsTrigger>
                  <TabsTrigger value="expense" className="gap-1 text-xs sm:text-sm">
                    <ArrowDownCircle className="size-3.5 shrink-0" />
                    {t('common.expense')}
                  </TabsTrigger>
                  <TabsTrigger value="transfer" className="gap-1 text-xs sm:text-sm">
                    <ArrowLeftRight className="size-3.5 shrink-0" />
                    {t('common.transfer')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-2">
                <Label htmlFor="tx-amount">{t('common.amount')}</Label>
                <Input
                  id="tx-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-desc">{t('common.description')}</Label>
                <Input
                  id="tx-desc"
                  placeholder={t('transactions.whatWasThis')}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tx-date">{t('common.date')}</Label>
                <Input id="tx-date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>{formType === 'transfer' ? t('transactions.fromAccount') : t('common.account')}</Label>
                <Select
                  value={formAccountId || NONE}
                  onValueChange={(v) => setFormAccountId(v == null || v === NONE ? '' : v)}
                  items={addTxAccountItems}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={accountsLoading ? t('common.loading') : t('transactions.selectAccount')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formType === 'transfer' && (
                <div className="space-y-2">
                  <Label>{t('transactions.toAccount')}</Label>
                  <Select
                    value={formToAccountId || NONE}
                    onValueChange={(v) => setFormToAccountId(v == null || v === NONE ? '' : v)}
                    items={addTxToAccountItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('transactions.selectDestination')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {accounts
                        .filter((a) => a.id !== formAccountId)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formType !== 'transfer' && (
                <div className="space-y-2">
                  <Label>{t('common.category')}</Label>
                  <Select
                    value={formCategoryId || NONE}
                    onValueChange={(v) => setFormCategoryId(v == null || v === NONE ? '' : v)}
                    disabled={categoriesLoading}
                    items={addTxCategoryItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('common.optional')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t('common.none')}</SelectItem>
                      {categoriesForType.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {getCategoryDisplayName(c, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="tx-notes">{t('common.notes')}</Label>
                <Textarea
                  id="tx-notes"
                  rows={3}
                  placeholder={t('transactions.optionalDetails')}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={createTx.isPending} className="gap-1.5">
                  {createTx.isPending && <Loader2 className="size-4 animate-spin" />}
                  {t('common.save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground">{t('transactions.totalIncome')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              <PrivateMoney>{formatCurrency(summary.income, currency)}</PrivateMoney>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground">{t('transactions.totalExpenses')}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
              <PrivateMoney>{formatCurrency(summary.expense, currency)}</PrivateMoney>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground">{t('transactions.net')}</p>
            <p
              className={cn(
                'mt-1 text-lg font-semibold tabular-nums',
                summary.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              <PrivateMoney>{formatCurrency(summary.net, currency)}</PrivateMoney>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder={t('transactions.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label={t('transactions.searchAriaLabel')}
            />
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t('common.type')}</p>
              <Tabs value={typeFilter} onValueChange={(v) => v && setTypeFilter(v as TypeFilter)}>
                <TabsList>
                  <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
                  <TabsTrigger value="income" className="gap-1">
                    <ArrowUpCircle className="size-3.5" />
                    {t('common.income')}
                  </TabsTrigger>
                  <TabsTrigger value="expense" className="gap-1">
                    <ArrowDownCircle className="size-3.5" />
                    {t('common.expense')}
                  </TabsTrigger>
                  <TabsTrigger value="transfer" className="gap-1">
                    <ArrowLeftRight className="size-3.5" />
                    {t('common.transfer')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="size-4 shrink-0" />
                <span className="text-xs font-medium">{t('transactions.dateRange')}</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-start" className="text-xs">
                  {t('common.from')}
                </Label>
                <Input id="filter-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-end" className="text-xs">
                  {t('common.to')}
                </Label>
                <Input id="filter-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-min-amount" className="text-xs">
                  {t('common.min')}
                </Label>
                <Input
                  id="filter-min-amount"
                  className="w-24"
                  inputMode="decimal"
                  placeholder="0"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-max-amount" className="text-xs">
                  {t('common.max')}
                </Label>
                <Input
                  id="filter-max-amount"
                  className="w-24"
                  inputMode="decimal"
                  placeholder="0"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isError && (
        <p className="text-sm text-destructive" role="alert">
          {error instanceof Error ? error.message : t('transactions.failedToLoad')}
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.description')}</TableHead>
                  <TableHead>{t('common.category')}</TableHead>
                  <TableHead>{t('common.account')}</TableHead>
                  <TableHead className="text-end">{t('common.amount')}</TableHead>
                  <TableHead className="w-12 text-end">
                    <span className="sr-only">{t('common.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48">
                      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                          <Receipt className="size-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{t('transactions.noTransactionsYet')}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t('transactions.addOrImport')}
                          </p>
                        </div>
                        <Button
                          size="default"
                          className="gap-1.5 min-h-11 w-full max-w-xs sm:w-auto"
                          onClick={() => setAddOpen(true)}
                        >
                          <Plus className="size-4" />
                          {t('transactions.addTransaction')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => {
                    const fromAcc = tx.account ?? accountMap.get(tx.account_id)
                    const toAcc = tx.transfer_to_account_id
                      ? accountMap.get(tx.transfer_to_account_id)
                      : undefined
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="w-10">{typeIcon(tx.type)}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell className="font-medium">{tx.description}</TableCell>
                        <TableCell>
                          {tx.type === 'transfer' ? (
                            <span className="text-muted-foreground">—</span>
                          ) : tx.category ? (
                            <Badge variant="outline" className="font-normal">
                              {getCategoryDisplayName(tx.category, locale)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{t('common.uncategorized')}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {tx.type === 'transfer' && toAcc ? (
                            <span className="truncate text-sm">
                              {fromAcc?.name ?? t('common.account')} → {toAcc.name}
                            </span>
                          ) : (
                            <span className="truncate text-sm">{fromAcc?.name ?? '—'}</span>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-end font-medium tabular-nums',
                            tx.type === 'income' && 'text-emerald-600 dark:text-emerald-400',
                            tx.type === 'expense' && 'text-red-600 dark:text-red-400',
                            tx.type === 'transfer' && 'text-foreground'
                          )}
                        >
                          <PrivateMoney>
                            <span>
                              {tx.type === 'expense' && '−'}
                              {tx.type === 'income' && '+'}
                              {tx.type === 'transfer' && '↔ '}
                              {formatCurrency(tx.amount, currency)}
                            </span>
                          </PrivateMoney>
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={t('transactions.deleteAriaLabel')}
                            disabled={deleteTx.isPending}
                            onClick={() => handleDelete(tx.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {!isLoading && transactions.length > 0 && transactions.length === fetchLimit && (
            <div className="flex justify-center border-t px-4 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFetchLimit((n) => n + PAGE_SIZE)}
              >
                {t('common.loadMore')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
