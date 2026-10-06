import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { clearActivity, getActivity, greetingForHour, logActivity, timeAgo } from './activity'

describe('activity log', () => {
  beforeEach(() => {
    clearActivity()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty list when nothing was logged', () => {
    expect(getActivity()).toEqual([])
  })

  it('logs events most-recent-first', () => {
    logActivity('created', 'Created Week 5: Long A')
    vi.setSystemTime(new Date('2026-10-06T12:00:01Z'))
    logActivity('practiced', 'Practiced Week 5: Long A, 8 of 10 correct')

    const events = getActivity()
    expect(events).toHaveLength(2)
    expect(events[0].text).toBe('Practiced Week 5: Long A, 8 of 10 correct')
    expect(events[0].kind).toBe('practiced')
    expect(events[1].text).toBe('Created Week 5: Long A')
    expect(typeof events[0].id).toBe('string')
    expect(events[0].at).toBeGreaterThan(events[1].at)
  })

  it('caps the log at 20 events', () => {
    for (let i = 0; i < 25; i++) {
      vi.setSystemTime(new Date(`2026-10-06T12:00:${String(i).padStart(2, '0')}Z`))
      logActivity('created', `List ${i}`)
    }
    const events = getActivity()
    expect(events).toHaveLength(20)
    expect(events[0].text).toBe('List 24')
  })

  it('clears the log', () => {
    logActivity('created', 'Created Week 5: Long A')
    clearActivity()
    expect(getActivity()).toEqual([])
  })

  it('ignores corrupt stored data', () => {
    localStorage.setItem('shepherd-speller-activity', 'not json')
    expect(getActivity()).toEqual([])

    localStorage.setItem('shepherd-speller-activity', JSON.stringify({ not: 'an array' }))
    expect(getActivity()).toEqual([])

    localStorage.setItem('shepherd-speller-activity', JSON.stringify([{ bogus: true }, 'nope', null]))
    expect(getActivity()).toEqual([])
  })

  it('survives storage errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => logActivity('created', 'Created Week 5: Long A')).not.toThrow()
    vi.restoreAllMocks()
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-10-06T12:00:00Z').getTime()

  it('says "just now" for recent events', () => {
    expect(timeAgo(now - 30_000, now)).toBe('just now')
  })

  it('shows minutes under an hour', () => {
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5m ago')
  })

  it('shows hours under a day', () => {
    expect(timeAgo(now - 2 * 3_600_000, now)).toBe('2h ago')
  })

  it('says "yesterday" for events one day old', () => {
    expect(timeAgo(now - 30 * 3_600_000, now)).toBe('yesterday')
  })

  it('shows days beyond that', () => {
    expect(timeAgo(now - 3 * 86_400_000, now)).toBe('3d ago')
  })

  it('clamps future timestamps to "just now"', () => {
    expect(timeAgo(now + 60_000, now)).toBe('just now')
  })
})

describe('greetingForHour', () => {
  it('greets by time of day', () => {
    expect(greetingForHour(7)).toBe('Good morning')
    expect(greetingForHour(11)).toBe('Good morning')
    expect(greetingForHour(12)).toBe('Good afternoon')
    expect(greetingForHour(17)).toBe('Good afternoon')
    expect(greetingForHour(18)).toBe('Good evening')
    expect(greetingForHour(23)).toBe('Good evening')
  })
})
