import { useSyncExternalStore } from 'react'
import { reportError } from '@/lib/report-error'

/**
 * History-aware back-button support (issue #504).
 *
 * The iOS model: a back control is labeled with the title of the page the
 * user actually came from, and activates a real history-back. NN/g's
 * "breadcrumbs show hierarchy, not history" rule is about breadcrumb
 * *trails*; a single back control is the history-showing control, which NN/g
 * explicitly contrasts with the browser's native Back button.
 *
 * Mechanism: a per-tab trail of in-app navigations (see NavigationTracker).
 * The tracker calls noteNavigation() on every client-side navigation; the
 * trail mirrors the session-history stack for push navigations and pops on
 * history-back, so the "previous page" is always the entry a real
 * history-back would land on, even across same-pathname search-param steps
 * (DisplayMode picker -> chart) and back-out-then-onward flows. The trail
 * lives in sessionStorage, so it is per-tab: a deep link or refresh in a new
 * tab has no in-app referrer and falls back to the parent-named link.
 * document.referrer was rejected: it does not update on SPA (pushState)
 * navigations and cannot supply friendly titles.
 *
 * This module never touches window at import time, so server components can
 * import the pure helpers safely. All storage access is wrapped: when
 * sessionStorage throws (private mode), history stays memory-only.
 */

export interface PreviousPage {
  path: string
  name: string
}

const TRAIL_KEY = 'patternspell:nav-trail'
/** Long enough for any realistic back-chain; the control only needs the last two. */
const MAX_TRAIL_LENGTH = 50

/** Dispatched on window after every navigation bookkeeping update. */
export const NAV_CHANGE_EVENT = 'patternspell:nav-change'

/**
 * Friendly names for routes that can be the page you came from. Matches the
 * labels the app already uses for these pages (issue #378 idiom).
 */
const PAGE_NAMES: Record<string, string> = {
  '/': 'PatternSpell',
  '/home': 'Home',
  '/lists': 'My spelling lists',
  '/lists/new': 'New word list',
  '/display': 'Present a list',
  '/practice': 'Practice',
  '/profile': 'Profile',
  '/feedback': 'Feedback',
  '/videos': 'Song videos',
  '/analytics': 'Analytics',
  '/version': 'Version',
  '/privacy': 'Privacy policy',
  '/terms': 'Terms of service',
}

/** Dynamic routes whose friendly name is static. */
function patternPageName(pathname: string): string | undefined {
  if (/\/worksheets$/.test(pathname)) return 'Printable worksheets'
  if (/\/print$/.test(pathname)) return 'Print pattern chart'
  return undefined
}

/**
 * Friendly name for a page that could be navigated away from. Returns
 * undefined for dynamic pages (e.g. /lists/[id]) until they report their
 * name via reportPageName(); a nameless previous page falls back to the
 * parent-named link.
 */
export function resolvePageName(pathname: string): string | undefined {
  return PAGE_NAMES[pathname] ?? patternPageName(pathname)
}

interface TrailEntry {
  /** pathname plus search string: identifies the history entry. */
  key: string
  path: string
  name?: string
}

let trail: TrailEntry[] = []
let lastNotedKey: string | null = null
/**
 * Bumped on every trail mutation. getSnapshot re-reads only when the
 * version changed, so it can never serve a value older than the latest
 * mutation, no matter the order of store updates vs. subscriptions.
 */
let trailVersion = 0

function isTrailEntry(value: unknown): value is TrailEntry {
  if (typeof value !== 'object' || value === null) return false
  const { key, path, name } = value as { key?: unknown; path?: unknown; name?: unknown }
  return typeof key === 'string' && typeof path === 'string' && (name === undefined || typeof name === 'string')
}

/** The persisted trail, or null when there is nothing usable (fresh tab). */
function readTrail(): TrailEntry[] | null {
  try {
    const raw = sessionStorage.getItem(TRAIL_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isTrailEntry)) return null
    return parsed
  } catch (error) {
    reportError(error, { location: 'navigation-history.readTrail' })
    return null
  }
}

function persistTrail(): void {
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail))
  } catch (error) {
    reportError(error, { location: 'navigation-history.persistTrail' })
  }
}

function dispatchChange(): void {
  window.dispatchEvent(new Event(NAV_CHANGE_EVENT))
}

/**
 * Record that the tab is now showing `pathname` (fullKey is pathname plus
 * the search string, so same-route search-param steps like the DisplayMode
 * picker -> chart are distinct trail entries).
 *
 * Push navigations append; a note for the entry below the top is a
 * history-back and pops the trail, so the previous page always matches what
 * a real history-back would land on. The first note per tab bootstraps from
 * storage: a matching trail means refresh/remount (kept); otherwise this
 * tab landed directly (deep link, new tab, typed URL) and the trail restarts
 * with no previous page.
 */
export function noteNavigation(fullKey: string, pathname: string): void {
  if (lastNotedKey === fullKey) return
  lastNotedKey = fullKey

  if (trail.length === 0) {
    const stored = readTrail()
    if (stored !== null && stored[stored.length - 1].key === fullKey) {
      // Refresh or remount of the same entry: keep the trail.
      trail = stored
      trailVersion += 1
      return
    }
    // Direct landing in this tab: no in-app referrer.
    trail = [{ key: fullKey, path: pathname, name: resolvePageName(pathname) }]
  } else if (trail.length >= 2 && trail[trail.length - 2].key === fullKey) {
    // History-back to the previous entry.
    trail.pop()
  } else {
    trail.push({ key: fullKey, path: pathname, name: resolvePageName(pathname) })
    if (trail.length > MAX_TRAIL_LENGTH) trail = trail.slice(-MAX_TRAIL_LENGTH)
  }

  trailVersion += 1
  persistTrail()
  dispatchChange()
}

/**
 * Lets a page with a dynamic title (a list's name, a ready-made week's
 * title) name itself for the back control. Updates the current (top) trail
 * entry so the name is there when this page later becomes someone's
 * previous page.
 */
export function reportPageName(name: string): void {
  const current = trail[trail.length - 1]
  if (!current || current.name === name) return
  trail[trail.length - 1] = { ...current, name }
  trailVersion += 1
  persistTrail()
  dispatchChange()
}

/**
 * The page the user arrived from via in-app navigation, or null on direct
 * landing (or when the previous page never got a friendly name).
 */
export function readPreviousPage(): PreviousPage | null {
  if (trail.length < 2) return null
  const prev = trail[trail.length - 2]
  if (!prev.name) return null
  return { path: prev.path, name: prev.name }
}

let cachedPrevious: PreviousPage | null = null
let cachedVersion = -1

function getSnapshot(): PreviousPage | null {
  if (cachedVersion !== trailVersion) {
    cachedPrevious = readPreviousPage()
    cachedVersion = trailVersion
  }
  return cachedPrevious
}

function subscribe(onChange: () => void): () => void {
  const onStoreChange = () => {
    onChange()
  }
  window.addEventListener(NAV_CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener(NAV_CHANGE_EVENT, onStoreChange)
  }
}

/**
 * Reactive view of the previous page for back controls. The server snapshot
 * is null, so SSR renders the parent-named fallback and hydration never
 * mismatches; the client value resolves right after hydration.
 */
export function usePreviousPage(): PreviousPage | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

/** Test-only: reset module state between tests. */
export function resetNavigationHistoryForTests(): void {
  trail = []
  lastNotedKey = null
  trailVersion += 1
  cachedVersion = -1
}
