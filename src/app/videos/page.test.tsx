import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import VideosPage, { metadata } from './page'

vi.mock('@/components/SongVideoBrowser', () => ({
  default: () => <div data-testid="song-video-browser" />,
}))

describe('VideosPage', () => {
  it('has browse metadata', () => {
    expect(metadata.title).toBe('Song videos | PatternSpell')
    expect(metadata.description).toContain('Search by title')
  })

  it('renders the page header, back link, and video browser', () => {
    render(<VideosPage />)
    expect(screen.getByRole('heading', { name: 'Song videos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home')
    expect(screen.getByTestId('song-video-browser')).toBeInTheDocument()
  })
})
