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
    expect(screen.getByText(/every deploy to shepherd speller/i)).toBeInTheDocument()
    // "This build" appears as the row label and as a badge on the matching release.
    expect(screen.getAllByText('This build').length).toBeGreaterThanOrEqual(1)
    await waitFor(() => {
      expect(screen.getByText('Fix display mode user ID')).toBeInTheDocument()
    })
  })

  it('renders gracefully when the GitHub API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down'))
    )
    render(await VersionPage())
    expect(screen.getByText(/every deploy to shepherd speller/i)).toBeInTheDocument()
    expect(screen.getByText('v0.1.4')).toBeInTheDocument()
  })
})
