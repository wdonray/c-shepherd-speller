import * as Sentry from '@sentry/nextjs'

type ReportErrorOptions = {
  /** Where the error happened, e.g. 'Header.handleMenuPhotoSelect' */
  location?: string
  /** Extra structured context */
  extra?: Record<string, unknown>
}

const NETWORK_ERROR_MESSAGE_PATTERNS = [/network error/i, /failed to fetch/i, /load failed/i]

/**
 * Transient connectivity failures are environmental noise, not app bugs.
 * Safari reports a dropped connection as `TypeError: NetworkError: A network
 * error occurred.` or `TypeError: Load failed`, other browsers as
 * `TypeError: Failed to fetch`.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'NetworkError') return true
  let message = ''
  if (error instanceof Error) message = error.message
  else if (typeof error === 'string') message = error
  return NETWORK_ERROR_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
}

/**
 * Sentry `beforeSend` hook: drop transient connectivity blips before they
 * reach Sentry. Kept as a named export so it can be unit tested;
 * instrumentation-client.ts wires it into Sentry.init.
 */
export function sentryBeforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint): Sentry.ErrorEvent | null {
  if (isNetworkError(hint.originalException)) return null
  return event
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
  // Transient connectivity blips are environmental noise, not app bugs.
  if (isNetworkError(error)) return
  const err = error instanceof Error ? error : new Error(String(error))
  Sentry.withScope((scope) => {
    if (options.location) scope.setTag('location', options.location)
    if (options.extra) scope.setExtras(options.extra)
    Sentry.captureException(err)
  })
}
