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
    // requestAnimationFrame is not implemented in jsdom; run callbacks synchronously.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
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
      expect(screen.getByRole('dialog', { name: 'Example sentences for \u201ccake\u201d' })).toBeInTheDocument()
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
    const focusSpy = vi.spyOn(trigger, 'focus')
    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(focusSpy).toHaveBeenCalled()
    focusSpy.mockRestore()
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
      expect(screen.getByText(/No example sentences found for this word yet/)).toBeInTheDocument()
    })
    // Focus moves to the close button when there are no radios.
    await waitFor(() => {
      expect(document.activeElement).toHaveAttribute('aria-label', 'Close sentence picker')
    })
  })

  it('lets the teacher add a custom sentence when none are found', async () => {
    vi.mocked(fetchExampleSentences).mockResolvedValue([])
    const onSelect = vi.fn()
    render(<SentencePicker word="xyzzy" patternId="p1" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick an example sentence for xyzzy' }))
    await waitFor(() => {
      expect(screen.getByLabelText(/or write your own/i)).toBeInTheDocument()
    })
    const input = screen.getByLabelText(/or write your own/i)
    fireEvent.change(input, { target: { value: 'The xyzzy glowed brightly.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    // The custom sentence becomes selected and can be confirmed.
    fireEvent.click(screen.getByRole('button', { name: 'Use this sentence' }))
    expect(onSelect).toHaveBeenCalledWith('The xyzzy glowed brightly.')
  })

  it('lets the teacher add a custom sentence alongside API sentences', async () => {
    vi.mocked(fetchExampleSentences).mockResolvedValue(['We baked a cake.'])
    const onSelect = vi.fn()
    render(<SentencePicker word="cake" patternId="p1" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick an example sentence for cake' }))
    await waitFor(() => {
      expect(screen.getByText('We baked a cake.')).toBeInTheDocument()
    })
    const input = screen.getByLabelText(/or write your own/i)
    fireEvent.change(input, { target: { value: 'I like cake.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use this sentence' }))
    expect(onSelect).toHaveBeenCalledWith('I like cake.')
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

  it('ignores non-Escape keys', async () => {
    vi.mocked(fetchExampleSentences).mockResolvedValue(['We baked a cake.'])
    render(<SentencePicker word="cake" patternId="p1" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick an example sentence for cake' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    fireEvent.keyDown(document, { key: 'Enter' })
    // Dialog stays open.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
