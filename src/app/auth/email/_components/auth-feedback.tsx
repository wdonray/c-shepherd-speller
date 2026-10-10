'use client'

import { cn } from '@/lib/utils'

/**
 * Inline form feedback for the email auth pages. Errors use role="alert";
 * success notes use role="status".
 */
export function AuthFeedback({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border-2 px-4 py-3 text-sm leading-5',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-green-700/30 bg-green-700/10 text-green-800 dark:text-green-300'
      )}
    >
      {children}
    </div>
  )
}
