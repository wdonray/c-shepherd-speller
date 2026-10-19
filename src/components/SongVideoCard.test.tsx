import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SongVideoCard from './SongVideoCard'
import { PATTERN_VIDEOS } from '@/data/pattern-videos'

const entry = PATTERN_VIDEOS[0]

describe('SongVideoCard', () => {
  it('renders the thumbnail, title, channel, and patterns', () => {
    render(<SongVideoCard entry={entry} onPlay={vi.fn()} />)
    expect(screen.getByRole('button', { name: `Play ${entry.title}` })).toBeInTheDocument()
    expect(screen.getByText(entry.title)).toBeInTheDocument()
    expect(screen.getByText(entry.channel)).toBeInTheDocument()
    expect(screen.getByText(`Patterns: ${entry.patterns.join(', ')}`)).toBeInTheDocument()
  })

  it('plays the video when the card is clicked', () => {
    const onPlay = vi.fn()
    render(<SongVideoCard entry={entry} onPlay={onPlay} />)
    fireEvent.click(screen.getByRole('button', { name: `Play ${entry.title}` }))
    expect(onPlay).toHaveBeenCalledWith(entry)
  })

  it('shows no Hide button without onHide', () => {
    render(<SongVideoCard entry={entry} onPlay={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^Hide / })).not.toBeInTheDocument()
  })

  it('hides the video via the overlay action', () => {
    const onHide = vi.fn()
    render(<SongVideoCard entry={entry} onPlay={vi.fn()} onHide={onHide} />)
    fireEvent.click(screen.getByRole('button', { name: `Hide ${entry.title}` }))
    expect(onHide).toHaveBeenCalledWith(entry)
  })

  it('omits the channel and patterns lines for a pasted video that has neither (issue #458)', () => {
    render(
      <SongVideoCard
        entry={{ videoId: 'dQw4w9WgXcQ', title: 'My pasted song', channel: '', patterns: [] }}
        onPlay={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Play My pasted song' })).toBeInTheDocument()
    expect(screen.queryByText(/^Patterns:/)).not.toBeInTheDocument()
  })
})
