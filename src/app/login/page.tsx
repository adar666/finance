'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Loader2, CheckCircle2, BarChart3, PiggyBank, Wallet, Target } from 'lucide-react'

const FEATURES = [
  { icon: Wallet, text: 'Track all your accounts in one place' },
  { icon: BarChart3, text: 'Visualize spending with smart charts' },
  { icon: PiggyBank, text: 'Set budgets and savings goals' },
  { icon: Target, text: 'Monitor investments and net worth' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      <div className="absolute top-1/4 -left-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">Finance</span>
        </div>

        <Card className="border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20 backdrop-blur-sm bg-card/95">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl tracking-tight">{sent ? 'Check your email' : 'Welcome back'}</CardTitle>
            <CardDescription>
              {sent
                ? `We sent a magic link to ${email}`
                : 'Sign in with a magic link sent to your email'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Click the link in your email to sign in. You can close this tab.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSent(false)
                    setEmail('')
                  }}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="h-11"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full h-11 active:scale-[0.98] transition-all" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send magic link
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6 mb-8">
          No account? A magic link will create one automatically.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-3">
              <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span className="text-xs text-muted-foreground leading-snug">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
