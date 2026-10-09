/**
 * User-facing error toasts. Call `toastError(getErrorMessage(error))` from
 * catch blocks that need to inform the user. `reportError()` (Sentry) is the
 * separate reporting layer; every error should still be reported there.
 */

type ToastListener = (message: string) => void

const listeners = new Set<ToastListener>()

/** Show an error toast. Safe to call from anywhere, even outside React. */
export function toastError(message: string): void {
  for (const listener of Array.from(listeners)) {
    listener(message)
  }
}

/**
 * Subscribe to error toasts. Used by <ErrorToaster />.
 * Returns an unsubscribe function.
 */
export function subscribeToErrorToasts(listener: ToastListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Map an error to a user-facing message. Status-code specific but generic:
 * no jargon, no raw codes, no blame. Copy approved 2026-10-09.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return "Couldn't reach the server. Check your connection and try again."
  }
  const status = getHttpStatus(error)
  if (status === 400) return "That didn't work. Please try again."
  if (status === 401) return 'Your session expired. Please sign in again.'
  if (status === 403) return "You don't have permission to do that."
  if (status === 404) return "That wasn't found. It may have been moved or deleted."
  if (status === 409) return 'That already exists.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status !== undefined && status >= 500 && status <= 599) {
    return "Something went wrong on our end. We're looking into it."
  }
  return 'Something went wrong. Please try again.'
}

function getHttpStatus(error: unknown): number | undefined {
  if (error instanceof Response) return error.status
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status
    if (typeof status === 'number') return status
  }
  return undefined
}

/**
 * Get the message to show in a toast. HTTP/network failures use the mapped
 * status-specific message. Other Errors (e.g. validation from
 * processProfileImage) already carry a user-friendly message, so that is
 * shown directly.
 */
export function getToastMessage(error: unknown): string {
  if (error instanceof TypeError || getHttpStatus(error) !== undefined) {
    return getErrorMessage(error)
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return getErrorMessage(error)
}
export class HttpError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}
