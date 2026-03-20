/**
 * Next.js `NextResponse.next({ request })` expects real Web `Headers` (Node undici),
 * not happy-dom's polyfill — keep this file on the Node test environment.
 * @vitest-environment node
 */
import { NextRequest } from 'next/server'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const getUserMock = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}))

import { updateSession } from './middleware'

describe('updateSession', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  beforeEach(() => {
    getUserMock.mockReset()
  })

  it('redirects unauthenticated users from protected paths to /login', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const res = await updateSession(new NextRequest(new URL('http://localhost:3000/transactions')))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toMatch(/\/login$/)
  })

  it('redirects unauthenticated users from transactions add deep link to /login', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const res = await updateSession(
      new NextRequest(new URL('http://localhost:3000/transactions?add=1'))
    )
    expect(res.status).toBe(307)
    const loc = res.headers.get('location') ?? ''
    expect(loc).toMatch(/\/login/)
    expect(loc).toContain('add=1')
  })

  it('allows unauthenticated access to /login', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const res = await updateSession(new NextRequest(new URL('http://localhost:3000/login')))
    expect(res.status).toBe(200)
  })

  it('allows unauthenticated access to /auth/callback', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const res = await updateSession(
      new NextRequest(new URL('http://localhost:3000/auth/callback?code=x'))
    )
    expect(res.status).toBe(200)
  })

  it('redirects authenticated users away from /login to /', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    const res = await updateSession(new NextRequest(new URL('http://localhost:3000/login')))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toMatch(/http:\/\/localhost:3000\/?$/)
  })

  it('continues when authenticated on a protected path', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    const res = await updateSession(new NextRequest(new URL('http://localhost:3000/')))
    expect(res.status).toBe(200)
  })
})
