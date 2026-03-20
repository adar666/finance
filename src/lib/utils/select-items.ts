import type { ReactNode } from 'react'
import type { Category } from '@/types/database'
import { getCategoryDisplayName } from '@/lib/utils/category-display-name'

/**
 * Base UI Select: pass `items` on `<Select>` (Root) so `<SelectValue>` shows the option label
 * while the popup is closed. Without it, the trigger often falls back to the raw `value`
 * (e.g. UUIDs or internal enum keys).
 *
 * @see https://base-ui.com/react/components/select — `items` prop
 */

export type SelectItemModel = { value: string; label: ReactNode }

/** `{ id, name }` rows (accounts, categories, …). */
export function selectItemsFromEntities(
  entities: ReadonlyArray<{ id: string; name: string }>
): SelectItemModel[] {
  return entities.map((e) => ({ value: e.id, label: e.name }))
}

/** Leading “none / clear” row plus entity options (same shape as `selectItemsFromEntities`). */
export function selectItemsWithNone(
  noneValue: string,
  noneLabel: ReactNode,
  entities: ReadonlyArray<{ id: string; name: string }>
): SelectItemModel[] {
  return [{ value: noneValue, label: noneLabel }, ...selectItemsFromEntities(entities)]
}

export function selectItemsFromCategories(
  entities: ReadonlyArray<Pick<Category, 'id' | 'name' | 'name_he'>>,
  locale: string
): SelectItemModel[] {
  return entities.map((e) => ({
    value: e.id,
    label: getCategoryDisplayName(e, locale),
  }))
}

export function selectItemsWithNoneCategories(
  noneValue: string,
  noneLabel: ReactNode,
  entities: ReadonlyArray<Pick<Category, 'id' | 'name' | 'name_he'>>,
  locale: string
): SelectItemModel[] {
  return [{ value: noneValue, label: noneLabel }, ...selectItemsFromCategories(entities, locale)]
}

/** Fixed ordering of values with a label map (account type, investment type, …). */
export function selectItemsFromMap(
  orderedValues: readonly string[],
  labelByValue: Readonly<Record<string, ReactNode>>
): SelectItemModel[] {
  return orderedValues.map((value) => ({
    value,
    label: labelByValue[value] ?? value,
  }))
}

/** Currency dropdown: value is ISO code; label is rich text in the list. */
export function selectItemsFromCurrencies(
  currencies: ReadonlyArray<{ code: string; symbol: string; name: string }>
): SelectItemModel[] {
  return currencies.map((c) => ({
    value: c.code,
    label: `${c.symbol} ${c.code} — ${c.name}`,
  }))
}
