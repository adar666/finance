/**
 * Allow only same-origin relative paths for post-auth redirects.
 * Rejects protocol-relative URLs (`//evil.com`) and non-relative paths (`https://...`).
 */
export function sanitizeNextPath(raw: string | null | undefined): string {
  const value = raw ?? '/'
  return value.startsWith('/') && !value.startsWith('//') ? value : '/'
}
