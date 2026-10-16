import * as Sentry from '@sentry/nextjs'

type ReportErrorOptions = {
  /** Where the error happened, e.g. 'Header.handleMenuPhotoSelect' */
  location?: string
  /** Extra structured context */
  extra?: Record<string, unknown>
}

const NETWORK_ERROR_MESSAGE_PATTERNS = [/network error/i, /failed to fetch/i, /load failed/i]

/** DOMException names the browser uses when a media blob cannot be played or decoded. */
const MEDIA_FORMAT_ERROR_NAMES = ['NotSupportedError', 'EncodingError']

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
 * A media blob the browser cannot decode or play (unsupported codec, corrupt
 * or empty file) is environmental noise, not an app bug: the rejection
 * describes this device's handling of that one file, and there is nothing in
 * the app to fix. Playback-failure rejections like these used to file Sentry
 * issues for one-off device media problems (see #342: an iPhone whose own
 * recording failed both decodeAudioData and audio.play()).
 */
export function isMediaFormatError(error: unknown): boolean {
  return error instanceof DOMException && MEDIA_FORMAT_ERROR_NAMES.includes(error.name)
}

/**
 * Sentry `beforeSend` hook: drop transient connectivity blips and
 * unplayable-media noise before they reach Sentry. Kept as a named export so
 * it can be unit tested; instrumentation-client.ts wires it into Sentry.init.
 */
export function sentryBeforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint): Sentry.ErrorEvent | null {
  if (isNetworkError(hint.originalException) || isMediaFormatError(hint.originalException)) return null
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
  // Aborted or timed-out requests are benign user/system behavior, not errors.
  // AbortSignal.timeout() rejects with TimeoutError, not AbortError.
  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) return
  // The platform could not decode audio or image bytes: e.g. iOS Safari's
  // decodeAudioData rejects MediaRecorder-produced blobs with an
  // EncodingError even though the recording itself plays fine. That is a
  // known browser limitation, not an app bug.
  if (error instanceof DOMException && error.name === 'EncodingError') return
  // Transient connectivity blips are environmental noise, not app bugs.
  if (isNetworkError(error)) return
  // Unsupported or undecodable media on this device is environmental noise,
  // not an app bug.
  if (isMediaFormatError(error)) return
  const err = error instanceof Error ? error : new Error(String(error))
  Sentry.withScope((scope) => {
    if (options.location) scope.setTag('location', options.location)
    if (options.extra) scope.setExtras(options.extra)
    Sentry.captureException(err)
  })
}
