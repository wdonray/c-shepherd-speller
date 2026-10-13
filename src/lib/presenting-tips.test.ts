import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isPresentingTipsDismissed, dismissPresentingTips } from './presenting-tips'

const STORAGE_KEY = 'patternspell-presenting-tips-dismissed'

describe('presenting-tips', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to not dismissed', () => {
    expect(isPresentingTipsDismissed()).toBe(false)
  })

  it('persists the dismissal choice', () => {
    dismissPresentingTips()
    expect(isPresentingTipsDismissed()).toBe(true)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('returns false when localStorage throws on read', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(isPresentingTipsDismissed()).toBe(false)
  })

  it('ignores localStorage errors on write', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => dismissPresentingTips()).not.toThrow()
  })
})
