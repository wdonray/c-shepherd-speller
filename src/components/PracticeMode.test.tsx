import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PracticeMode from './PracticeMode'
import type { WordList } from '@/models/WordList'

vi.mock('@/lib/tts', () => ({
  speak: vi.fn(),
  buildSentencePrompt: (word: string) => `The word is ${word}. Can you spell ${word}?`,
}))
const { logActivity } = vi.hoisted(() => ({ logActivity: vi.fn() }))
vi.mock('@/lib/activity', () => ({ logActivity }))
const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/track-event', () => ({ trackEvent }))

beforeEach(() => {
  trackEvent.mockClear()
})

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

function answerInput() {
  return screen.getByLabelText('Spell the word you hear')
}

function check() {
  fireEvent.click(screen.getByRole('button', { name: 'Check' }))
}

function answerCorrect(word: string) {
  fireEvent.change(answerInput(), { target: { value: word } })
  check()
  fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
}

function answerWrong() {
  fireEvent.change(answerInput(), { target: { value: 'zzz' } })
  check()
  fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
}

describe('PracticeMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an empty state when the list has no words', () => {
    const empty: WordList = { ...list, patterns: [] }
    const onExit = vi.fn()
    render(<PracticeMode list={empty} onExit={onExit} />)
    expect(screen.getByText('This list has no words yet')).toBeInTheDocument()
    expect(screen.getByText('Add words to your patterns first, then come back to practice.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to lists' }))
    expect(onExit).toHaveBeenCalled()
  })

  it('renders the prompt header, progress, and hear block', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Practice: Week 5' })).toBeInTheDocument()
    expect(screen.getByText('Listen, then type the spelling.')).toBeInTheDocument()
    expect(screen.getByText('0 of 0 correct (0%)')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Practice progress' })).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('button', { name: 'Hear the word' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hear it in a sentence' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled()
  })

  it('exits practice from the header', () => {
    const onExit = vi.fn()
    render(<PracticeMode list={list} onExit={onExit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Exit practice' }))
    expect(onExit).toHaveBeenCalled()
  })

  it('speaks the word when Hear the word is clicked', async () => {
    const { speak } = await import('@/lib/tts')
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word' }))
    expect(vi.mocked(speak)).toHaveBeenCalledWith('cake')
  })

  it('speaks the sentence when Hear it in a sentence is clicked', async () => {
    const { speak } = await import('@/lib/tts')
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear it in a sentence' }))
    expect(vi.mocked(speak)).toHaveBeenCalledWith('The word is cake. Can you spell cake?')
  })

  it('marks a correct spelling and advances', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.change(answerInput(), { target: { value: 'cake' } })
    check()
    expect(screen.getByRole('status')).toHaveTextContent('Correct! Nice work.')
    expect(screen.getByText('1 of 1 correct (100%)')).toBeInTheDocument()
    expect(answerInput()).toHaveClass('bg-leaf-soft')
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    expect(screen.getByRole('button', { name: 'Hear the word' })).toBeInTheDocument()
  })

  it('is case-insensitive', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.change(answerInput(), { target: { value: 'CAKE' } })
    check()
    expect(screen.getByRole('status')).toHaveTextContent('Correct! Nice work.')
  })

  it('shows the streak pill after consecutive correct answers', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    answerCorrect('cake')
    expect(screen.queryByText('Streak 2')).not.toBeInTheDocument()
    fireEvent.change(answerInput(), { target: { value: 'bake' } })
    check()
    expect(screen.getByText('Streak 2')).toBeInTheDocument()
  })

  it('marks an incorrect spelling with the answer and pattern hint', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.change(answerInput(), { target: { value: 'kake' } })
    check()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Not quite. The word is:')
    expect(alert).toHaveTextContent('cake')
    expect(alert).toHaveTextContent('Look at the a_e pattern, then try again.')
    expect(answerInput()).toHaveClass('bg-coral-soft')
    expect(screen.getByText('Review: 1 word')).toBeInTheDocument()
    expect(screen.getByText(/"kake" joined your review list/)).toBeInTheDocument()
  })

  it('omits the pattern hint when the pattern is blank', () => {
    const blank: WordList = {
      ...list,
      patterns: [{ id: 'p1', sound: 'long a', pattern: '', frequency: 'common', words: ['cake'] }],
    }
    render(<PracticeMode list={blank} onExit={vi.fn()} />)
    fireEvent.change(answerInput(), { target: { value: 'kake' } })
    check()
    expect(screen.getByRole('alert')).not.toHaveTextContent('Look at the')
  })

  it('resets the streak on an incorrect answer', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    answerCorrect('cake')
    fireEvent.change(answerInput(), { target: { value: 'bake' } })
    check()
    expect(screen.getByText('Streak 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    fireEvent.change(answerInput(), { target: { value: 'zzz' } })
    check()
    expect(screen.queryByText(/Streak/)).not.toBeInTheDocument()
  })

  it('try again retries the same word without advancing', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    fireEvent.change(answerInput(), { target: { value: 'kake' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(answerInput()).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Hear the word' })).toBeInTheDocument()
    // The word is still cake: answering it correctly advances past it.
    fireEvent.change(answerInput(), { target: { value: 'cake' } })
    check()
    expect(screen.getByRole('status')).toHaveTextContent('Correct! Nice work.')
  })

  it('completes the list and logs activity', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    answerCorrect('cake')
    answerCorrect('bake')
    fireEvent.change(answerInput(), { target: { value: 'rain' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))

    expect(screen.getByRole('heading', { name: 'List complete!' })).toBeInTheDocument()
    expect(screen.getByText('3 of 3 correct')).toBeInTheDocument()
    expect(screen.getByText('Best streak: 3')).toBeInTheDocument()
    expect(screen.getByLabelText('3 of 3 stars')).toBeInTheDocument()
    expect(logActivity).toHaveBeenCalledWith('practiced', 'Week 5')
    expect(trackEvent).toHaveBeenCalledWith('practice-session')
    expect(trackEvent).toHaveBeenCalledWith('words-practiced', 3)
    // No misses, so no review button.
    expect(screen.queryByRole('button', { name: 'Review missed words' })).not.toBeInTheDocument()
  })

  it('awards two stars at eighty percent', () => {
    const five: WordList = {
      ...list,
      patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['a', 'b', 'c', 'd', 'e'] }],
    }
    render(<PracticeMode list={five} onExit={vi.fn()} />)
    answerCorrect('a')
    answerCorrect('b')
    answerCorrect('c')
    answerCorrect('d')
    answerWrong()
    expect(screen.getByLabelText('2 of 3 stars')).toBeInTheDocument()
    expect(screen.getByText('4 of 5 correct')).toBeInTheDocument()
  })

  it('awards one star below eighty percent', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    answerCorrect('cake')
    answerCorrect('bake')
    fireEvent.change(answerInput(), { target: { value: 'zzz' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    expect(screen.getByLabelText('1 of 3 stars')).toBeInTheDocument()
  })

  it('awards no stars when nothing is correct', () => {
    const two: WordList = {
      ...list,
      patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] }],
    }
    render(<PracticeMode list={two} onExit={vi.fn()} />)
    answerWrong()
    fireEvent.change(answerInput(), { target: { value: 'zzz' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    expect(screen.getByLabelText('0 of 3 stars')).toBeInTheDocument()
  })

  it('backs out to lists from the complete card', () => {
    const onExit = vi.fn()
    render(<PracticeMode list={list} onExit={onExit} />)
    answerCorrect('cake')
    answerCorrect('bake')
    answerCorrect('rain')
    fireEvent.click(screen.getByRole('button', { name: 'Back to lists' }))
    expect(onExit).toHaveBeenCalled()
  })

  it('runs the full review flow until the queue clears', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    // Miss cake, spell the rest right.
    fireEvent.change(answerInput(), { target: { value: 'kake' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    answerCorrect('bake')
    fireEvent.change(answerInput(), { target: { value: 'rain' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))

    expect(screen.getByRole('heading', { name: 'List complete!' })).toBeInTheDocument()
    expect(screen.getByText('2 of 3 correct')).toBeInTheDocument()

    // Enter review mode.
    fireEvent.click(screen.getByRole('button', { name: 'Review missed words' }))
    expect(screen.getByRole('heading', { name: 'Review time' })).toBeInTheDocument()
    expect(screen.getByText('Review 1 of 1')).toBeInTheDocument()

    // Miss again: still in review, count unchanged.
    fireEvent.change(answerInput(), { target: { value: 'kake' } })
    check()
    expect(screen.getByText(/"kake" is still your review list/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    // Spell right once: not cleared yet.
    fireEvent.change(answerInput(), { target: { value: 'cake' } })
    check()
    expect(screen.getByRole('status')).toHaveTextContent('Correct! Nice work.')
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    expect(screen.getByText('Review 1 of 1')).toBeInTheDocument()

    // Spell right twice: cleared.
    fireEvent.change(answerInput(), { target: { value: 'cake' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))

    expect(screen.getByRole('heading', { name: 'Review complete!' })).toBeInTheDocument()
    expect(screen.getByText('You cleared every missed word.')).toBeInTheDocument()

    // Practice again restarts the session.
    fireEvent.click(screen.getByRole('button', { name: 'Practice again' }))
    expect(screen.getByRole('heading', { name: 'Practice: Week 5' })).toBeInTheDocument()
    expect(screen.getByText('0 of 0 correct (0%)')).toBeInTheDocument()
  })

  it('stays on the next word when a review word clears', () => {
    render(<PracticeMode list={list} onExit={vi.fn()} />)
    // Miss two words, spell the third right.
    answerWrong() // cake
    answerWrong() // bake
    answerCorrect('rain')
    fireEvent.click(screen.getByRole('button', { name: 'Review missed words' }))
    expect(screen.getByText('Review 1 of 2')).toBeInTheDocument()

    // Clear cake with two correct answers; bake remains.
    fireEvent.change(answerInput(), { target: { value: 'cake' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    expect(screen.getByText('Review 2 of 2')).toBeInTheDocument()
    fireEvent.change(answerInput(), { target: { value: 'bake' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    expect(screen.getByText('Review 1 of 2')).toBeInTheDocument()
    fireEvent.change(answerInput(), { target: { value: 'cake' } })
    check()
    // Cake clears; the next word (bake) slides into its index.
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    expect(screen.getByText('Review 1 of 1')).toBeInTheDocument()

    // Clear bake too.
    fireEvent.change(answerInput(), { target: { value: 'bake' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    expect(screen.getByRole('heading', { name: 'Review complete!' })).toBeInTheDocument()
  })

  it('backs out to lists from the review-complete card', () => {
    const onExit = vi.fn()
    render(<PracticeMode list={list} onExit={onExit} />)
    answerWrong()
    answerCorrect('bake')
    answerCorrect('rain')
    fireEvent.click(screen.getByRole('button', { name: 'Review missed words' }))
    fireEvent.change(answerInput(), { target: { value: 'cake' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    fireEvent.change(answerInput(), { target: { value: 'cake' } })
    check()
    fireEvent.click(screen.getByRole('button', { name: 'Next word' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to lists' }))
    expect(onExit).toHaveBeenCalled()
  })
})
