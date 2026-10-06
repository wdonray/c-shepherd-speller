import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PracticeMode from './PracticeMode'
import type { WordList } from '@/models/WordList'

vi.mock('@/lib/tts', () => ({
  speak: vi.fn(),
}))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [
    {
      id: 'p1',
      sound: 'long a',
      pattern: 'a_e',
      frequency: 'common',
      words: ['cake', 'bake'],
    },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('PracticeMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an empty state when the list has no words', () => {
    const empty: WordList = { ...list, patterns: [] }
    const onExit = vi.fn()
    render(<PracticeMode list={empty} onExit={onExit} />)
    expect(screen.getByText(/no words yet/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to lists' }))
    expect(onExit).toHaveBeenCalled()
  })

  it('speaks the word when Hear word is clicked', async () => {
    const { speak } = await import('@/lib/tts')
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word' }))
    expect(vi.mocked(speak)).toHaveBeenCalledWith('cake')
  })

  it('speaks the sentence when Sentence is clicked', async () => {
    const { speak } = await import('@/lib/tts')
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word in a sentence' }))
    expect(vi.mocked(speak)).toHaveBeenCalledWith('The word is cake.')
  })

  it('marks a correct spelling', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'cake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Correct!')
    expect(screen.getByText(/1 of 1 correct/)).toBeInTheDocument()
  })

  it('is case-insensitive', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'CAKE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Correct!')
  })

  it('marks an incorrect spelling and shows the correct answer', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'cak' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('alert')).toHaveTextContent('The spelling is: cake')
    expect(screen.getByText(/0 of 1 correct/)).toBeInTheDocument()
  })

  it('adds missed words to the review queue', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    // Miss the first word
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/Review: 1 word\(s\) need practice/)).toBeInTheDocument()
  })

  it('does not duplicate words already in the review queue', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    // Miss cake twice
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    // Should be back to cake (from review queue)
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    // Still 1 word in review (not duplicated)
    expect(screen.getByText(/Review: 1 word\(s\) need practice/)).toBeInTheDocument()
  })

  it('requires two correct spellings to clear a word from review', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    const input = screen.getByLabelText('Type the spelling')

    // Miss cake
    fireEvent.change(input, { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))

    // The next word should be cake again (from review queue)
    // Spell it correctly once
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'cake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByText(/Review: 1 word\(s\) need practice/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))

    // Spell it correctly again to clear
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'cake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))

    // Review queue should be empty
    expect(screen.queryByText(/Review:/)).not.toBeInTheDocument()
  })

  it('shows a streak after two consecutive correct answers', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)

    // Correct cake
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'cake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))

    // Correct bake
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'bake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    expect(screen.getByText(/Streak: 2/)).toBeInTheDocument()
  })

  it('resets the streak on an incorrect answer', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)

    // Correct cake
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'cake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))

    // Miss bake
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    expect(screen.queryByText(/Streak:/)).not.toBeInTheDocument()
  })

  it('disables Check when the input is empty', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled()
  })

  it('disables input after submitting', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Type the spelling'), { target: { value: 'cake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByLabelText('Type the spelling')).toBeDisabled()
  })

  it('exits practice when Exit is clicked', () => {
    const onExit = vi.fn()
    render(<PracticeMode list={list} onExit={onExit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Exit practice' }))
    expect(onExit).toHaveBeenCalled()
  })

  it('does not submit when already showing feedback', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    const input = screen.getByLabelText('Type the spelling')
    fireEvent.change(input, { target: { value: 'cake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    // Try to submit again via form (should be ignored)
    fireEvent.submit(input.closest('form')!)
    expect(screen.getByText(/1 of 1 correct/)).toBeInTheDocument()
  })
})
