import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import VersionPage from './page'

const RELEASES = [
  {
    tag_name: 'v0.1.4',
    html_url: 'https://github.com/wdonray/c-shepherd-speller/releases/tag/v0.1.4',
    published_at: '2026-10-05T10:00:00Z',
    body: '  - Fix display mode user ID (abc1234)',
  },
]

describe('VersionPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => RELEASES,
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the current build version and server-fetched releases', async () => {
    render(await VersionPage())
    expect(screen.getByText(/every deploy to patternspell/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Fix display mode user ID')).toBeInTheDocument()
    })
    // "This build" appears as the row label and as a badge on the matching release.
    await waitFor(() => {
      expect(screen.getAllByText('This build').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders gracefully when the GitHub API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    render(await VersionPage())
    expect(screen.getByText(/every deploy to patternspell/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('v0.1.4')).toBeInTheDocument()
    })
  })

  it('renders gracefully when GitHub returns an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    render(await VersionPage())
    expect(screen.getByText(/every deploy to patternspell/i)).toBeInTheDocument()
  })

  it('renders gracefully when GitHub returns a non-array payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: 'oops' }) }))
    render(await VersionPage())
    expect(screen.getByText(/every deploy to patternspell/i)).toBeInTheDocument()
  })

  it('sends the GitHub token when GITHUB_TOKEN is set', async () => {
    process.env.GITHUB_TOKEN = 'test-token'
    try {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
      vi.stubGlobal('fetch', fetchMock)
      render(await VersionPage())
      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      const [, init] = fetchMock.mock.calls[0]
      expect(init.headers.Authorization).toBe('Bearer test-token')
    } finally {
      delete process.env.GITHUB_TOKEN
    }
  })

  it('handles null items in the releases payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [null, ...RELEASES] }))
    render(await VersionPage())
    await waitFor(() => {
      expect(screen.getByText('Fix display mode user ID')).toBeInTheDocument()
    })
  })
})
