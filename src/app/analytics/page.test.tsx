import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AnalyticsPage from './page'
import { getAnalyticsSummary } from '@/lib/analytics'

vi.mock('@/lib/analytics', () => ({ getAnalyticsSummary: vi.fn() }))

const getAnalyticsSummaryMock = vi.mocked(getAnalyticsSummary)

const SUMMARY = {
  pages: [
    {
      path: '/display',
      totalViews: 42,
      uniques: 7,
      daily: [{ day: '2026-10-04', views: 20 }, { day: '2026-10-05', views: 22 }],
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

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the not-configured state when analytics is unavailable', async () => {
    getAnalyticsSummaryMock.mockResolvedValue(null)
    render(await AnalyticsPage())
    expect(
      screen.getByText(/isn't configured on this build yet/i)
    ).toBeInTheDocument()
  })

  it('shows the empty state when no views have been recorded', async () => {
    getAnalyticsSummaryMock.mockResolvedValue({ ...SUMMARY, totalViews: 0 })
    render(await AnalyticsPage())
    expect(screen.getByText(/no page views recorded yet/i)).toBeInTheDocument()
  })

  it('renders headline stats and the daily chart', async () => {
    getAnalyticsSummaryMock.mockResolvedValue(SUMMARY)
    render(await AnalyticsPage())
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Page views per day')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /bar chart of page views per day/i })
    ).toBeInTheDocument()
  })

  it('explains the methodology', async () => {
    getAnalyticsSummaryMock.mockResolvedValue(SUMMARY)
    render(await AnalyticsPage())
    expect(screen.getByText(/how it's measured/i)).toBeInTheDocument()
    expect(screen.getByText(/no cookies are set/i)).toBeInTheDocument()
  })
})
