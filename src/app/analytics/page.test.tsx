import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AnalyticsPage from './page'
import { getAnalyticsSummary, getEventCount } from '@/lib/analytics'

vi.mock('@/lib/analytics', () => ({ getAnalyticsSummary: vi.fn(), getEventCount: vi.fn() }))

const getAnalyticsSummaryMock = vi.mocked(getAnalyticsSummary)
const getEventCountMock = vi.mocked(getEventCount)

const SUMMARY = {
  pages: [
    {
      path: '/display',
      totalViews: 42,
      uniques: 7,
      daily: [
        { day: '2026-10-04', views: 20 },
        { day: '2026-10-05', views: 22 },
      ],
    },
  ],
  totalViews: 42,
  totalUniques: 7,
  dailyTotals: [
    { day: '2026-10-04', views: 20 },
    { day: '2026-10-05', views: 22 },
  ],
  fetchedAt: '2026-10-05T12:00:00.000Z',
}

function mockEvents(lists = 18, sessions = 42, words = 96) {
  getEventCountMock.mockImplementation(async (event: string) => {
    if (event === 'list-created') return lists
    if (event === 'practice-session') return sessions
    if (event === 'words-practiced') return words
    return 0
  })
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEvents()
  })

  it('shows the not-configured state when analytics is unavailable', async () => {
    getAnalyticsSummaryMock.mockResolvedValue(null)
    getEventCountMock.mockResolvedValue(null)
    render(await AnalyticsPage())
    expect(screen.getByText(/isn't configured on this build yet/i)).toBeInTheDocument()
  })

  it('renders the four stat cards', async () => {
    getAnalyticsSummaryMock.mockResolvedValue(SUMMARY)
    render(await AnalyticsPage())
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument()
    expect(screen.getByText('How the app is used. Counts update daily.')).toBeInTheDocument()
    // Page views, 30 days = sum of daily totals (20 + 22); practice sessions also 42
    expect(screen.getAllByText('42')).toHaveLength(2)
    expect(screen.getByText('Page views, 30 days')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('Lists created')).toBeInTheDocument()
    expect(screen.getByText('Practice sessions')).toBeInTheDocument()
    expect(screen.getByText('96')).toBeInTheDocument()
    expect(screen.getByText('Words practiced')).toBeInTheDocument()
  })

  it('treats missing event counts as zero', async () => {
    getAnalyticsSummaryMock.mockResolvedValue(SUMMARY)
    getEventCountMock.mockResolvedValue(null)
    render(await AnalyticsPage())
    expect(screen.getByText('Lists created')).toBeInTheDocument()
    // The three event cards render zero; page views still come from the summary
    expect(screen.getAllByText('0')).toHaveLength(3)
  })

  it('explains the methodology', async () => {
    getAnalyticsSummaryMock.mockResolvedValue(SUMMARY)
    render(await AnalyticsPage())
    expect(screen.getByText('How these numbers are measured')).toBeInTheDocument()
    expect(screen.getByText(/bots are filtered out/i)).toBeInTheDocument()
    expect(screen.getByText(/estimates of usage, not exact headcounts/i)).toBeInTheDocument()
  })
})
