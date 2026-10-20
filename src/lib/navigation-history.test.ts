import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { renderHook, act } from '@testing-library/react'
import {
  NAV_CHANGE_EVENT,
  noteNavigation,
  readPreviousPage,
  reportPageName,
  resetNavigationHistoryForTests,
  resolvePageName,
  usePreviousPage,
} from './navigation-history'
import { reportError } from '@/lib/report-error'

vi.mock('@/lib/report-error', () => ({ reportError: vi.fn() }))

const TRAIL_KEY = 'patternspell:nav-trail'

function storedTrail() {
  const raw = window.sessionStorage.getItem(TRAIL_KEY)
  return raw ? (JSON.parse(raw) as { key: string; path: string; name?: string }[]) : null
}

describe('resolvePageName', () => {
  it('names static routes with the existing idiom', () => {
    expect(resolvePageName('/home')).toBe('Home')
    expect(resolvePageName('/lists')).toBe('My spelling lists')
    expect(resolvePageName('/lists/new')).toBe('New word list')
    expect(resolvePageName('/display')).toBe('Present a list')
    expect(resolvePageName('/practice')).toBe('Practice')
    expect(resolvePageName('/profile')).toBe('Profile')
    expect(resolvePageName('/feedback')).toBe('Feedback')
    expect(resolvePageName('/videos')).toBe('Song videos')
  })

  it('names worksheet and print pages by pattern', () => {
    expect(resolvePageName('/lists/abc/worksheets')).toBe('Printable worksheets')
    expect(resolvePageName('/lists/prebuilt/w1/worksheets')).toBe('Printable worksheets')
    expect(resolvePageName('/lists/abc/print')).toBe('Print pattern chart')
  })

  it('returns undefined for dynamic pages until they report a name', () => {
    expect(resolvePageName('/lists/abc')).toBeUndefined()
    expect(resolvePageName('/lists/prebuilt/w1')).toBeUndefined()
    expect(resolvePageName('/nope')).toBeUndefined()
  })
})

describe('noteNavigation', () => {
  beforeEach(() => {
    vi.mocked(reportError).mockClear()
    window.sessionStorage.clear()
    resetNavigationHistoryForTests()
  })

  it('treats the first page in a tab as a direct landing with no previous page', () => {
    noteNavigation('/lists/abc', '/lists/abc')
    expect(readPreviousPage()).toBeNull()
    expect(storedTrail()).toHaveLength(1)
  })

  it('records the previous page on in-app navigation', () => {
    noteNavigation('/home', '/home')
    noteNavigation('/lists/abc', '/lists/abc')
    expect(readPreviousPage()).toEqual({ path: '/home', name: 'Home' })
  })

  it('ignores repeat notes for the same entry', () => {
    const changes: Event[] = []
    const onChange = (event: Event) => changes.push(event)
    window.addEventListener(NAV_CHANGE_EVENT, onChange)
    try {
      noteNavigation('/home', '/home')
      noteNavigation('/home', '/home')
      expect(changes).toHaveLength(1)
    } finally {
      window.removeEventListener(NAV_CHANGE_EVENT, onChange)
    }
  })

  it('treats same-route search-param steps as distinct entries', () => {
    noteNavigation('/display', '/display')
    noteNavigation('/display?list=abc', '/display')
    // The picker becomes the previous page, so the chart's back control
    // names it instead of wherever the teacher was before.
    expect(readPreviousPage()).toEqual({ path: '/display', name: 'Present a list' })
  })

  it('pops the trail on history-back so the previous page stays truthful', () => {
    noteNavigation('/home', '/home')
    noteNavigation('/display', '/display')
    noteNavigation('/display?list=abc', '/display')
    // Browser-back from the chart to the picker.
    noteNavigation('/display', '/display')
    // The previous page is now Home (where a real back would land), not the
    // chart we just came back from.
    expect(readPreviousPage()).toEqual({ path: '/home', name: 'Home' })
  })

  it('empties the previous page after backing to the first entry', () => {
    noteNavigation('/home', '/home')
    noteNavigation('/lists', '/lists')
    noteNavigation('/home', '/home')
    expect(readPreviousPage()).toBeNull()
  })

  it('pushes again when navigating onward after a history-back', () => {
    noteNavigation('/home', '/home')
    noteNavigation('/display', '/display')
    noteNavigation('/home', '/home')
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toEqual({ path: '/home', name: 'Home' })
  })

  it('clears the previous page when it never got a friendly name', () => {
    noteNavigation('/lists/abc', '/lists/abc')
    // List name not reported yet (still loading); navigating away falls back.
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toBeNull()
  })

  it('keeps the reported name when the previous page named itself', () => {
    noteNavigation('/lists/abc', '/lists/abc')
    reportPageName('My ai list')
    noteNavigation('/lists/abc/worksheets', '/lists/abc/worksheets')
    expect(readPreviousPage()).toEqual({ path: '/lists/abc', name: 'My ai list' })
  })

  it('keeps the trail across a refresh of the same entry', () => {
    noteNavigation('/home', '/home')
    noteNavigation('/lists/abc', '/lists/abc')
    expect(readPreviousPage()).toEqual({ path: '/home', name: 'Home' })

    // Simulate a reload: module state is gone, storage survives.
    resetNavigationHistoryForTests()
    noteNavigation('/lists/abc', '/lists/abc')
    expect(readPreviousPage()).toEqual({ path: '/home', name: 'Home' })
  })

  it('restarts the trail when the stored trail belongs to another entry', () => {
    noteNavigation('/home', '/home')
    resetNavigationHistoryForTests()
    // A different tab, a typed URL, or a cross-entry jump.
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toBeNull()
    expect(storedTrail()).toHaveLength(1)
  })

  it('restarts the trail when the stored trail is corrupt JSON', () => {
    window.sessionStorage.setItem(TRAIL_KEY, 'not json')
    noteNavigation('/lists', '/lists')
    expect(vi.mocked(reportError)).toHaveBeenCalled()
    expect(readPreviousPage()).toBeNull()
  })

  it('restarts the trail when the stored value is not an array', () => {
    window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify({ key: '/lists' }))
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toBeNull()
  })

  it('restarts the trail when the stored array is empty', () => {
    window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify([]))
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toBeNull()
  })

  it('restarts the trail when a stored entry is malformed', () => {
    window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify([{ key: '/lists' }]))
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toBeNull()
  })

  it('restarts the trail when a stored entry has a non-string name', () => {
    window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify([{ key: '/lists', path: '/lists', name: 42 }]))
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toBeNull()
  })

  it('restarts the trail when a stored entry is null', () => {
    window.sessionStorage.setItem(TRAIL_KEY, JSON.stringify([null]))
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toBeNull()
  })

  it('caps the trail length', () => {
    for (let i = 0; i < 55; i++) {
      noteNavigation(`/page-${i}`, `/page-${i}`)
    }
    expect(storedTrail()).toHaveLength(50)
    expect(storedTrail()?.[49].key).toBe('/page-54')
  })

  it('survives sessionStorage throwing on write', () => {
    const setItem = vi.spyOn(window.sessionStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    try {
      expect(() => noteNavigation('/home', '/home')).not.toThrow()
      expect(vi.mocked(reportError)).toHaveBeenCalled()
    } finally {
      setItem.mockRestore()
    }
  })
})

describe('reportPageName', () => {
  beforeEach(() => {
    vi.mocked(reportError).mockClear()
    window.sessionStorage.clear()
    resetNavigationHistoryForTests()
  })

  it('is a no-op before the first navigation note', () => {
    expect(() => reportPageName('My ai list')).not.toThrow()
    expect(storedTrail()).toBeNull()
  })

  it('names the current trail entry', () => {
    noteNavigation('/lists/abc', '/lists/abc')
    reportPageName('My ai list')
    expect(storedTrail()).toMatchObject([{ name: 'My ai list' }])
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toEqual({ path: '/lists/abc', name: 'My ai list' })
  })

  it('skips the write when the name is unchanged', () => {
    noteNavigation('/lists/abc', '/lists/abc')
    reportPageName('My ai list')
    const changes: Event[] = []
    const onChange = (event: Event) => changes.push(event)
    window.addEventListener(NAV_CHANGE_EVENT, onChange)
    try {
      reportPageName('My ai list')
      expect(changes).toHaveLength(0)
    } finally {
      window.removeEventListener(NAV_CHANGE_EVENT, onChange)
    }
  })
})

describe('readPreviousPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    resetNavigationHistoryForTests()
  })

  it('returns null with fewer than two entries', () => {
    noteNavigation('/home', '/home')
    expect(readPreviousPage()).toBeNull()
  })

  it('returns null when the previous entry has no name', () => {
    noteNavigation('/lists/abc', '/lists/abc')
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toBeNull()
  })

  it('returns the previous entry path and name', () => {
    noteNavigation('/home', '/home')
    noteNavigation('/lists', '/lists')
    expect(readPreviousPage()).toEqual({ path: '/home', name: 'Home' })
  })
})

describe('usePreviousPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    resetNavigationHistoryForTests()
  })

  it('starts null and updates when navigation is noted', () => {
    const { result } = renderHook(() => usePreviousPage())
    expect(result.current).toBeNull()

    act(() => {
      noteNavigation('/home', '/home')
      noteNavigation('/lists/abc', '/lists/abc')
    })
    expect(result.current).toEqual({ path: '/home', name: 'Home' })
  })

  it('reacts to the nav-change event', () => {
    const { result } = renderHook(() => usePreviousPage())
    expect(result.current).toBeNull()

    act(() => {
      noteNavigation('/home', '/home')
    })
    // Single entry: still no previous page.
    expect(result.current).toBeNull()

    act(() => {
      noteNavigation('/lists', '/lists')
    })
    expect(result.current).toEqual({ path: '/home', name: 'Home' })
  })

  it('unsubscribes on unmount', () => {
    const { result, unmount } = renderHook(() => usePreviousPage())
    unmount()
    act(() => {
      window.dispatchEvent(new Event(NAV_CHANGE_EVENT))
    })
    expect(result.current).toBeNull()
  })

  it('uses a null server snapshot so SSR renders the parent-named fallback', () => {
    noteNavigation('/home', '/home')
    noteNavigation('/lists', '/lists')
    const html = renderToString(createElement(Probe))
    expect(html).toContain('fallback')
    expect(html).not.toContain('Home')
  })
})

function Probe() {
  const prev = usePreviousPage()
  return createElement('span', null, prev ? prev.name : 'fallback')
}
