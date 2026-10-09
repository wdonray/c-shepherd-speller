'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/report-error'

/**
 * Last-resort error UI: replaces the whole page when a route crashes.
 * The error is reported to Sentry; the teacher gets a friendly retry.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, {
      location: 'GlobalError',
      extra: error.digest ? { digest: error.digest } : undefined,
    })
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div
            role="alert"
            className="mx-auto max-w-xl rounded-[20px] border-2 border-coral bg-coral-soft p-8 text-center"
          >
            <h2 className="mb-2 text-2xl font-bold text-coral-ink">Something went wrong</h2>
            <p className="mb-6">This page ran into a problem. Try again, and your work is safe.</p>
            <Button variant="destructive" onClick={reset}>
              Try again
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
