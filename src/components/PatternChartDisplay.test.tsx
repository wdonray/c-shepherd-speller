import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import PatternChartDisplay from './PatternChartDisplay'
import type { WordList } from '@/models/WordList'

const { speak } = vi.hoisted(() => ({ speak: vi.fn() }))
vi.mock('@/lib/tts', () => ({ speak }))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
    { id: 'p3', sound: 'long a', pattern: 'eigh', frequency: 'rare', words: ['eight'], isOddDuck: true },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('PatternChartDisplay', () => {
  it('shows the target sound header without a hear sound button', () => {
    render(<PatternChartDisplay list={list} />)
    expect(screen.getByText('long a')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hear the sound/i })).not.toBeInTheDocument()
  })

  it('falls back to the list name when patterns have no shared sound', () => {
    render(<PatternChartDisplay list={{ ...list, patterns: [] }} />)
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
  })

  it('picks the most common sound when patterns disagree', () => {
    const mixed: WordList = {
      ...list,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] },
        { id: 'p2', sound: 'short e', pattern: 'e', frequency: 'common', words: ['bed'] },
        { id: 'p3', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] },
      ],
    }
    render(<PatternChartDisplay list={mixed} />)
    expect(screen.getByText('long a')).toBeInTheDocument()
    expect(screen.queryByText('short e')).not.toBeInTheDocument()
  })

  it('renders one column per pattern, most common first, all equal width', () => {
    render(<PatternChartDisplay list={list} />)
    const aE = screen.getByRole('region', { name: 'Pattern a_e' })
    const ai = screen.getByRole('region', { name: 'Pattern ai' })
    const eigh = screen.getByRole('region', { name: 'Pattern eigh' })
    expect(aE).toBeInTheDocument()
    expect(ai).toBeInTheDocument()
    // Common sorts before less-common before rare.
    expect(aE.compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ai.compareDocumentPosition(eigh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Equal widths regardless of frequency.
    for (const col of [aE, ai, eigh]) {
      expect(col).toHaveStyle({ flexGrow: '1', flexBasis: '0' })
    }
    // Power bars and frequency labels encode commonness.
    expect(within(aE).getByRole('img', { name: 'Frequency: Common' })).toBeInTheDocument()
    expect(within(aE).getByText('Common')).toBeInTheDocument()
    expect(within(ai).getByText('Less common')).toBeInTheDocument()
    expect(within(eigh).getByText('Rare')).toBeInTheDocument()
  })

  it('explains the frequency encoding in the caption', () => {
    render(<PatternChartDisplay list={list} />)
    expect(
      screen.getByText(/Patterns are ordered by how common the spelling is; longer bars mean more common/)
    ).toBeInTheDocument()
  })

  it('opens the word analysis when a word card is tapped', () => {
    render(<PatternChartDisplay list={list} />)
    fireEvent.click(screen.getByRole('button', { name: 'Analyze the word cake' }))
    expect(screen.getByRole('dialog', { name: 'Word analysis for cake' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close word analysis' }))
    expect(screen.queryByRole('dialog', { name: 'Word analysis for cake' })).not.toBeInTheDocument()
  })

  it('speaks the word when the hear button is pressed', () => {
    render(<PatternChartDisplay list={list} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word cake' }))
    expect(speak).toHaveBeenCalledWith('cake')
    expect(screen.queryByRole('dialog', { name: 'Word analysis for cake' })).not.toBeInTheDocument()
  })

  it('does not show an odd duck band even when a pattern has isOddDuck set', () => {
    render(<PatternChartDisplay list={list} />)
    expect(screen.queryByRole('region', { name: 'Odd ducks' })).not.toBeInTheDocument()
    // The pattern gets a regular column instead
    expect(screen.getByRole('region', { name: 'Pattern eigh' })).toBeInTheDocument()
  })

  it('shows an empty state when the list has no patterns', () => {
    render(<PatternChartDisplay list={{ ...list, patterns: [] }} />)
    expect(screen.getByText(/No patterns in this list yet/)).toBeInTheDocument()
  })

  it('stays light inside the force-light wrapper', () => {
    const { container } = render(<PatternChartDisplay list={list} />)
    expect(container.firstChild).toHaveClass('force-light')
  })

  it('gives word cards a visible hover and matching focus-visible treatment, motion-free', () => {
    render(<PatternChartDisplay list={list} />)
    const card = screen.getByRole('button', { name: 'Analyze the word cake' })
    expect(card).toHaveClass(
      'hover:bg-sky-soft',
      'focus-visible:bg-sky-soft',
      'focus-visible:ring-[3px]',
      'focus-visible:ring-ring/60'
    )
    // No hover translate/lift: it would fight the press effect and break the
    // flat-card convention on projectors.
    expect(card.className).not.toMatch(/hover:translate-/)
  })
})
