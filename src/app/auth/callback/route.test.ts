import { beforeEach, describe, expect, it, vi } from 'vitest'

const exchangeCodeForSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession,
    },
  })),
}))

import { GET } from './route'

describe('GET /auth/callback', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset()
  })

  it('redirects to origin + next on successful code exchange', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const res = await GET(
      new Request('https://app.example.com/auth/callback?code=abc&next=/settings')
    )
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://app.example.com/settings')
  })

  it('blocks open redirects by falling back next to /', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const res = await GET(
      new Request(
        'https://app.example.com/auth/callback?code=abc&next=' + encodeURIComponent('//evil.com')
      )
    )
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://app.example.com/')
  })

  it('blocks absolute https next param', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })
    const res = await GET(
      new Request(
        'https://app.example.com/auth/callback?code=abc&next=' +
          encodeURIComponent('https://evil.com')
      )
    )
    expect(res.headers.get('location')).toBe('https://app.example.com/')
  })

  it('redirects to login when there is no code', async () => {
    const res = await GET(new Request('https://app.example.com/auth/callback'))
    expect(res.headers.get('location')).toBe('https://app.example.com/login?error=auth')
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('redirects to login when exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('invalid') })
    const res = await GET(
      new Request('https://app.example.com/auth/callback?code=bad')
    )
    expect(res.headers.get('location')).toBe('https://app.example.com/login?error=auth')
  })
})
