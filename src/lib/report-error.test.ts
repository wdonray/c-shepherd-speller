import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import type { ErrorEvent } from '@sentry/nextjs'
import { isNetworkError, reportError, sentryBeforeSend } from './report-error'

vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}))

const mockWithScope = Sentry.withScope as unknown as Mock

function mockScope() {
  const scope = { setTag: vi.fn(), setExtras: vi.fn() }
  mockWithScope.mockImplementation((callback: (scope: unknown) => void) => {
    callback(scope)
  })
  return scope
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reportError', () => {
  it('captures Error instances with location tag and extras', () => {
    const scope = mockScope()
    const error = new Error('boom')

    reportError(error, { location: 'Header.handleMenuPhotoSelect', extra: { status: 500 } })

    expect(scope.setTag).toHaveBeenCalledWith('location', 'Header.handleMenuPhotoSelect')
    expect(scope.setExtras).toHaveBeenCalledWith({ status: 500 })
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
  })

  it('wraps non-Error values in an Error', () => {
    mockScope()

    reportError('string failure', { location: 'Somewhere' })

    const captured = vi.mocked(Sentry.captureException).mock.calls[0][0] as Error
    expect(captured).toBeInstanceOf(Error)
    expect(captured.message).toBe('string failure')
  })

  it('skips tags and extras when no options are given', () => {
    const scope = mockScope()

    reportError(new Error('plain'))

    expect(scope.setTag).not.toHaveBeenCalled()
    expect(scope.setExtras).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('ignores AbortError', () => {
    mockScope()

    reportError(new DOMException('aborted', 'AbortError'), { location: 'Somewhere' })

    expect(Sentry.withScope).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports non-abort DOMExceptions', () => {
    mockScope()

    reportError(new DOMException('quota exceeded', 'QuotaExceededError'))

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('ignores network errors', () => {
    mockScope()

    reportError(new TypeError('Failed to fetch'), { location: 'Somewhere' })
    reportError(new TypeError('NetworkError: A network error occurred.'))
    reportError(new DOMException('offline', 'NetworkError'))

    expect(Sentry.withScope).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

describe('isNetworkError', () => {
  it('detects Failed to fetch', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('detects Safari network errors', () => {
    expect(isNetworkError(new TypeError('NetworkError: A network error occurred.'))).toBe(true)
  })

  it('detects NetworkError DOMExceptions', () => {
    expect(isNetworkError(new DOMException('offline', 'NetworkError'))).toBe(true)
  })

  it('detects network error strings', () => {
    expect(isNetworkError('network error')).toBe(true)
    expect(isNetworkError('Failed to fetch')).toBe(true)
  })

  it('rejects app errors', () => {
    expect(isNetworkError(new Error('boom'))).toBe(false)
    expect(isNetworkError(new TypeError('Cannot read properties of null'))).toBe(false)
    expect(isNetworkError(new DOMException('quota exceeded', 'QuotaExceededError'))).toBe(false)
    expect(isNetworkError('something broke')).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(42)).toBe(false)
  })
})

describe('sentryBeforeSend', () => {
  const event = { event_id: 'abc' } as ErrorEvent

  it('drops network errors', () => {
    expect(sentryBeforeSend(event, { originalException: new TypeError('Failed to fetch') })).toBeNull()
    expect(
      sentryBeforeSend(event, {
        originalException: new TypeError('NetworkError: A network error occurred.'),
      })
    ).toBeNull()
    expect(sentryBeforeSend(event, { originalException: new DOMException('offline', 'NetworkError') })).toBeNull()
  })

  it('keeps other events', () => {
    expect(sentryBeforeSend(event, { originalException: new Error('boom') })).toBe(event)
    expect(sentryBeforeSend(event, {})).toBe(event)
  })
})
