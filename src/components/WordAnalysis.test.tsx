import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import WordAnalysis from './WordAnalysis'
import type { SpellingPattern } from '@/models/WordList'

const pattern: SpellingPattern = {
  id: 'p1',
  sound: 'long a',
  pattern: 'ai',
  frequency: 'common',
  words: ['rain', 'pain'],
}

describe('WordAnalysis', () => {
  const defaultProps = {
    word: 'rain',
    pattern,
    onClose: vi.fn(),
    onSpeak: vi.fn(),
  }

  it('renders the word with the pattern highlighted', () => {
    render(<WordAnalysis {...defaultProps} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Word analysis for rain')
    // The highlighted pattern span inside the heading
    const heading = screen.getByRole('heading', { level: 2 })
    const highlighted = within(heading).getByText('ai')
    expect(highlighted.tagName).toBe('SPAN')
    expect(highlighted.className).toContain('font-extrabold')
  })

  it('renders the word without highlight when the pattern is not found', () => {
    render(<WordAnalysis {...defaultProps} word="xyz" />)
    expect(screen.getByText('xyz')).toBeInTheDocument()
  })

  it('shows the sound and pattern', () => {
    render(<WordAnalysis {...defaultProps} />)
    expect(screen.getByText('long a')).toBeInTheDocument()
    // Pattern appears in the dl (the heading one is scoped separately)
    const patternCells = screen.getAllByText('ai')
    expect(patternCells.length).toBeGreaterThan(0)
  })

  it('shows the odd duck note for irregular patterns', () => {
    render(<WordAnalysis {...defaultProps} pattern={{ ...pattern, isOddDuck: true }} />)
    expect(screen.getByText('Odd duck')).toBeInTheDocument()
    expect(
      screen.getByText('This spelling is irregular. It does not follow the pattern, so memorize the whole word.')
    ).toBeInTheDocument()
  })

  it('highlights the pattern in plum for odd ducks and sun for regular patterns', () => {
    const { rerender } = render(<WordAnalysis {...defaultProps} pattern={{ ...pattern, isOddDuck: true }} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(within(heading).getByText('ai').className).toContain('text-plum-ink')
    rerender(<WordAnalysis {...defaultProps} />)
    expect(within(screen.getByRole('heading', { level: 2 })).getByText('ai').className).toContain('text-sun-ink')
  })

  it('shows the mapping note for a multi-letter pattern', () => {
    render(<WordAnalysis {...defaultProps} />)
    expect(screen.getByText('The letters ai work together to make one sound.')).toBeInTheDocument()
  })

  it('shows the mapping note for a single-letter pattern', () => {
    render(<WordAnalysis {...defaultProps} word="cat" pattern={{ ...pattern, pattern: 'a', sound: 'short a' }} />)
    expect(screen.getByText('The letter a spells short a here.')).toBeInTheDocument()
  })

  it('shows the odd-duck mapping note for irregular patterns', () => {
    render(<WordAnalysis {...defaultProps} pattern={{ ...pattern, isOddDuck: true }} />)
    expect(screen.getByText('This word does not follow the usual pattern. It is an odd duck.')).toBeInTheDocument()
  })

  it('shows word parts for a clean suffix split', () => {
    render(<WordAnalysis {...defaultProps} word="playing" />)
    const line = screen.getByText(/base word/)
    expect(line.textContent).toBe('Word parts: base word \u2018play\u2019 plus the suffix \u2018ing\u2019.')
  })

  it('shows word parts for a clean prefix split', () => {
    render(<WordAnalysis {...defaultProps} word="redo" />)
    const line = screen.getByText(/base word/)
    expect(line.textContent).toBe('Word parts: base word \u2018do\u2019 plus the prefix \u2018re\u2019.')
  })

  it('omits the word parts line when no clean split applies', () => {
    render(<WordAnalysis {...defaultProps} />)
    expect(screen.queryByText(/base word/)).not.toBeInTheDocument()
  })

  it('shows the sentence in a quote card', () => {
    render(<WordAnalysis {...defaultProps} />)
    expect(screen.getByText(/The word is rain\./)).toBeInTheDocument()
  })

  it('speaks the word when Say it is clicked', () => {
    const onSpeak = vi.fn()
    render(<WordAnalysis {...defaultProps} onSpeak={onSpeak} />)
    fireEvent.click(screen.getByRole('button', { name: 'Say it' }))
    expect(onSpeak).toHaveBeenCalledWith('rain')
  })

  it('speaks the sentence when Say sentence is clicked', () => {
    const onSpeak = vi.fn()
    render(<WordAnalysis {...defaultProps} onSpeak={onSpeak} />)
    fireEvent.click(screen.getByRole('button', { name: 'Say sentence' }))
    expect(onSpeak).toHaveBeenCalledWith('The word is rain.')
  })

  it('closes when the X button is clicked', () => {
    const onClose = vi.fn()
    render(<WordAnalysis {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close word analysis' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<WordAnalysis {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close when the dialog content is clicked', () => {
    const onClose = vi.fn()
    render(<WordAnalysis {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('long a'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
