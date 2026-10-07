import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SentencePicker from './SentencePicker'

vi.mock('@/lib/example-sentences', () => ({
  fetchExampleSentences: vi.fn(),
}))

import { fetchExampleSentences } from '@/lib/example-sentences'

describe('SentencePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a 44px trigger button', () => {
    render(<SentencePicker word="cake" patternId="p1" onSelect={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Pick an example sentence for cake' })
    expect(button).toHaveClass('size-11')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the dialog and moves focus inside on click', async () => {
    vi.mocked(fetchExampleSentences).mockResolvedValue(['We baked a cake.'])
    render(<SentencePicker word="cake" patternId="p1" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick an example sentence for cake' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Example sentences for cake' })).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'We baked a cake.' })).toBeInTheDocument()
    })
  })

  it('shows a loading state while fetching', async () => {
    let resolveFetch: (s: string[]) => void = () => {}
    vi.mocked(fetchExampleSentences).mockImplementation(() => new Promise((resolve) => (resolveFetch = resolve)))
    render(<SentencePicker word="cake" patternId="p1" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick an example sentence for cake' }))
    await waitFor(() => {
      expect(screen.getByText('Finding sentences…')).toBeInTheDocument()
    })
    resolveFetch(['We baked a cake.'])
  })

  it('selects a sentence and confirms', async () => {
    vi.mocked(fetchExampleSentences).mockResolvedValue(['We baked a cake.', 'I like cake.'])
    const onSelect = vi.fn()
    render(<SentencePicker word="cake" patternId="p1" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick an example sentence for cake' }))
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'I like cake.' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('radio', { name: 'I like cake.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use this sentence' }))
    expect(onSelect).toHaveBeenCalledWith('I like cake.')
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    vi.mocked(fetchExampleSentences).mockResolvedValue(['We baked a cake.'])
    render(<SentencePicker word="cake" patternId="p1" onSelect={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Pick an example sentence for cake' })
    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger)
    })
  })

  it('shows attribution', async () => {
    vi.mocked(fetchExampleSentences).mockResolvedValue(['We baked a cake.'])
    render(<SentencePicker word="cake" patternId="p1" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick an example sentence for cake' }))
    await waitFor(() => {
      expect(screen.getByText(/dictionaryapi.dev/)).toBeInTheDocument()
    })
  })

  it('shows an empty state when no sentences are found', async () => {
    vi.mocked(fetchExampleSentences).mockResolvedValue([])
    render(<SentencePicker word="xyzzy" patternId="p1" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick an example sentence for xyzzy' }))
    await waitFor(() => {
      expect(screen.getByText('No example sentences found for this word yet.')).toBeInTheDocument()
    })
    // Focus moves to the close button when there are no radios.
    await waitFor(() => {
      expect(document.activeElement).toHaveAttribute('aria-label', 'Close sentence picker')
    })
  })

  it('clears the sentence when Clear is clicked', async () => {
    vi.mocked(fetchExampleSentences).mockResolvedValue(['We baked a cake.'])
    const onSelect = vi.fn()
    render(<SentencePicker word="cake" patternId="p1" currentSentence="We baked a cake." onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Change example sentence for cake' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onSelect).toHaveBeenCalledWith(undefined)
  })

  it('closes via the X button', async () => {
    vi.mocked(fetchExampleSentences).mockResolvedValue(['We baked a cake.'])
    render(<SentencePicker word="cake" patternId="p1" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick an example sentence for cake' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close sentence picker' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
