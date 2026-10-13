/**
 * Dismissal memory for the one-time "Presenting tips" bar on the present
 * chart view. The choice persists in localStorage so the bar only shows
 * until the teacher dismisses it, per browser.
 */

import { reportError } from './report-error'

const STORAGE_KEY = 'patternspell-presenting-tips-dismissed'

export function isPresentingTipsDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch (error) {
    reportError(error, { location: 'presenting-tips.isPresentingTipsDismissed' })
    return false
  }
}

export function dismissPresentingTips(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true')
  } catch (error) {
    // Storage unavailable; the bar stays visible for this session.
    reportError(error, { location: 'presenting-tips.dismissPresentingTips' })
  }
}
