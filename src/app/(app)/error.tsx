'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Something went wrong</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error.message || 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
          <Button onClick={reset} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
