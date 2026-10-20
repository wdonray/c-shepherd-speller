import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import ReportPageName from './report-page-name'
import { noteNavigation, resetNavigationHistoryForTests } from '@/lib/navigation-history'

vi.mock('@/lib/report-error', () => ({ reportError: vi.fn() }))

const TRAIL_KEY = 'patternspell:nav-trail'

function storedTrail() {
  const raw = window.sessionStorage.getItem(TRAIL_KEY)
  return raw ? (JSON.parse(raw) as { key: string; name?: string }[]) : null
}

describe('ReportPageName', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    resetNavigationHistoryForTests()
    noteNavigation('/lists/prebuilt/w1', '/lists/prebuilt/w1')
  })

  it('renders nothing visible', () => {
    const { container } = render(<ReportPageName name="Week 1: Short a" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('reports the page name for history-aware back controls', () => {
    render(<ReportPageName name="Week 1: Short a" />)
    expect(storedTrail()).toMatchObject([{ name: 'Week 1: Short a' }])
  })

  it('reports again when the name changes', () => {
    const { rerender } = render(<ReportPageName name="Week 1: Short a" />)
    rerender(<ReportPageName name="Week 1: Short a (updated)" />)
    expect(storedTrail()).toMatchObject([{ name: 'Week 1: Short a (updated)' }])
  })
})
