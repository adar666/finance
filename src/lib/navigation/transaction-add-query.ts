/**
 * Deep link from command palette: /transactions?add=1 opens the add-transaction dialog once, then URL is cleaned.
 */

export function shouldOpenAddTransactionFromSearch(search: string): boolean {
  const q = search.startsWith('?') ? search.slice(1) : search
  return new URLSearchParams(q).get('add') === '1'
}

/**
 * Returns true if `?add=1` was present; clears it from the URL via replaceState (browser only).
 */
export function consumeAddTransactionQueryParam(pathname: string = '/transactions'): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('add') !== '1') return false
  window.history.replaceState({}, '', pathname)
  return true
}
