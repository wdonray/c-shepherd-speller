import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getErrorMessage, getToastMessage, toastError, subscribeToErrorToasts, HttpError } from './error-toast'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getErrorMessage', () => {
  it('maps fetch TypeError to the network message', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toBe(
      "Couldn't reach the server. Check your connection and try again."
    )
  })

  it('maps a Response by status', () => {
    expect(getErrorMessage(new Response(null, { status: 400 }))).toBe("That didn't work. Please try again.")
    expect(getErrorMessage(new Response(null, { status: 401 }))).toBe('Your session expired. Please sign in again.')
    expect(getErrorMessage(new Response(null, { status: 403 }))).toBe("You don't have permission to do that.")
    expect(getErrorMessage(new Response(null, { status: 404 }))).toBe(
      "That wasn't found. It may have been moved or deleted."
    )
    expect(getErrorMessage(new Response(null, { status: 409 }))).toBe('That already exists.')
    expect(getErrorMessage(new Response(null, { status: 429 }))).toBe(
      'Too many requests. Please wait a moment and try again.'
    )
  })

  it('maps 5xx statuses to the server message', () => {
    for (const status of [500, 502, 503, 599]) {
      expect(getErrorMessage(new Response(null, { status }))).toBe(
        "Something went wrong on our end. We're looking into it."
      )
    }
  })

  it('reads numeric status from plain objects', () => {
    expect(getErrorMessage({ status: 404 })).toBe("That wasn't found. It may have been moved or deleted.")
    expect(getErrorMessage({ status: 418 })).toBe('Something went wrong. Please try again.')
  })

  it('maps HttpError by its status', () => {
    expect(getErrorMessage(new HttpError('nope', 404))).toBe("That wasn't found. It may have been moved or deleted.")
    expect(getErrorMessage(new HttpError('nope', 503))).toBe("Something went wrong on our end. We're looking into it.")
  })

  it('falls back to the generic message for anything else', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.')
    expect(getErrorMessage('a string failure')).toBe('Something went wrong. Please try again.')
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.')
    expect(getErrorMessage(undefined)).toBe('Something went wrong. Please try again.')
    expect(getErrorMessage({ status: '404' })).toBe('Something went wrong. Please try again.')
  })
})

describe('getToastMessage', () => {
  it('uses the mapped message for network failures', () => {
    expect(getToastMessage(new TypeError('Failed to fetch'))).toBe(
      "Couldn't reach the server. Check your connection and try again."
    )
  })

  it('uses the mapped message for HTTP errors', () => {
    expect(getToastMessage(new HttpError('nope', 404))).toBe("That wasn't found. It may have been moved or deleted.")
  })

  it('uses the error message for validation-style errors', () => {
    expect(getToastMessage(new Error('Please choose a JPEG, PNG, WebP, or HEIC image.'))).toBe(
      'Please choose a JPEG, PNG, WebP, or HEIC image.'
    )
  })

  it('falls back to the generic message for non-Errors', () => {
    expect(getToastMessage('string failure')).toBe('Something went wrong. Please try again.')
    expect(getToastMessage(null)).toBe('Something went wrong. Please try again.')
  })
})

describe('toastError / subscribeToErrorToasts', () => {
  it('notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToErrorToasts(listener)
    toastError('hello')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('hello')
    unsubscribe()
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToErrorToasts(listener)
    unsubscribe()
    toastError('hello')
    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies multiple subscribers', () => {
    const first = vi.fn()
    const second = vi.fn()
    const unsubscribeFirst = subscribeToErrorToasts(first)
    const unsubscribeSecond = subscribeToErrorToasts(second)
    toastError('hello')
    expect(first).toHaveBeenCalledWith('hello')
    expect(second).toHaveBeenCalledWith('hello')
    unsubscribeFirst()
    unsubscribeSecond()
  })
})
