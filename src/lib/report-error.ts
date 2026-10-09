import * as Sentry from '@sentry/nextjs'

type ReportErrorOptions = {
  /** Where the error happened, e.g. 'Header.handleMenuPhotoSelect' */
  location?: string
  /** Extra structured context */
  extra?: Record<string, unknown>
}

/**
 * Report a caught error to Sentry. Call this from every catch block instead
 * of swallowing the error: the user-facing fallback behavior stays the same,
 * but the error is no longer invisible.
 *
 * Safe to call when Sentry has no DSN (captureException no-ops).
 */
export function reportError(error: unknown, options: ReportErrorOptions = {}): void {
  // Aborted requests are benign user/system behavior, not errors.
  if (error instanceof DOMException && error.name === 'AbortError') return
  const err = error instanceof Error ? error : new Error(String(error))
  Sentry.withScope((scope) => {
    if (options.location) scope.setTag('location', options.location)
    if (options.extra) scope.setExtras(options.extra)
    Sentry.captureException(err)
  })
}
