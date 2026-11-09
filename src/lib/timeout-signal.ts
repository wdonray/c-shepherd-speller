/**
 * Returns a signal that aborts after `ms` milliseconds.
 *
 * `AbortSignal.timeout()` is missing in older browsers (Safari before 17.4),
 * where calling it throws `TypeError: AbortSignal.timeout is not a function`
 * (see #558: the version poller hit this on every page load). The fallback
 * builds the same behavior from an AbortController plus a timer, aborting
 * with a TimeoutError so callers see the same rejection `AbortSignal.timeout`
 * would have produced.
 */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms)
  const controller = new AbortController()
  setTimeout(() => {
    controller.abort(new DOMException('The operation timed out.', 'TimeoutError'))
  }, ms)
  return controller.signal
}
