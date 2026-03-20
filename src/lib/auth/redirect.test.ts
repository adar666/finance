import { describe, expect, it } from 'vitest'
import { sanitizeNextPath } from './redirect'

describe('sanitizeNextPath', () => {
  it('allows simple relative paths', () => {
    expect(sanitizeNextPath('/settings')).toBe('/settings')
    expect(sanitizeNextPath('/')).toBe('/')
    expect(sanitizeNextPath('/deep/nested')).toBe('/deep/nested')
  })

  it('defaults null/undefined to /', () => {
    expect(sanitizeNextPath(null)).toBe('/')
    expect(sanitizeNextPath(undefined)).toBe('/')
  })

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeNextPath('//evil.com')).toBe('/')
    expect(sanitizeNextPath('//evil.com/path')).toBe('/')
  })

  it('rejects absolute and scheme-like paths', () => {
    expect(sanitizeNextPath('https://evil.com')).toBe('/')
    expect(sanitizeNextPath('http://evil.com')).toBe('/')
    expect(sanitizeNextPath('javascript:alert(1)')).toBe('/')
  })

  it('treats empty string as unsafe and returns /', () => {
    expect(sanitizeNextPath('')).toBe('/')
  })
})
