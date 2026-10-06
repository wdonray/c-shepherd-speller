'use client'

/**
 * Recent activity for the teacher dashboard: a small localStorage-backed log
 * of what the teacher did (created a list, practiced, presented). Powers the
 * "Recent activity" section on the dashboard. Local only; never leaves the
 * browser.
 */

export type ActivityKind = 'created' | 'practiced' | 'presented'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  /** Human-readable summary, e.g. "Practiced Week 5: Long A, 8 of 10 correct". */
  text: string
  /** Unix milliseconds. */
  at: number
}

const STORAGE_KEY = 'shepherd-speller-activity'
const MAX_EVENTS = 20

function readRaw(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is ActivityEvent =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as ActivityEvent).id === 'string' &&
        typeof (e as ActivityEvent).text === 'string' &&
        typeof (e as ActivityEvent).at === 'number'
    )
  } catch {
    return []
  }
}

/** Most recent first. */
export function getActivity(): ActivityEvent[] {
  return readRaw().sort((a, b) => b.at - a.at)
}

export function logActivity(kind: ActivityKind, text: string): void {
  try {
    const events = readRaw()
    events.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      text,
      at: Date.now(),
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)))
  } catch {
    // Activity is a nicety; never break the app over it.
  }
}

/** For tests: wipe the log. */
export function clearActivity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Relative age for an activity timestamp ("just now", "5m ago", "2h ago",
 * "yesterday", "3d ago").
 */
export function timeAgo(at: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - at) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 2) return 'yesterday'
  return `${days}d ago`
}

/** Time-of-day greeting for the dashboard ("Good morning", ...). */
export function greetingForHour(hour: number): 'Good morning' | 'Good afternoon' | 'Good evening' {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
