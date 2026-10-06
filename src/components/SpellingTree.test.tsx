import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SpellingTree from './SpellingTree'
import type { WordList } from '@/models/WordList'

vi.mock('@/lib/tts', () => ({
  speak: vi.fn(),
}))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  patterns: [
    {
      id: 'p1',
      sound: 'long a',
      pattern: 'a_e',
      frequency: 'common',
      words: ['cake', 'bake'],
    },
    {
      id: 'p2',
      sound: 'long a',
      pattern: 'ai',
      frequency: 'less-common',
      words: ['rain'],
    },
    {
      id: 'p3',
      sound: 'long a',
      pattern: 'eigh',
      frequency: 'rare',
      words: ['eight'],
      isOddDuck: true,
    },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('SpellingTree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the sound at the center', () => {
    render(<SpellingTree list={list} />)
    // Center sound appears in the SVG circle and the hear button label
    expect(screen.getByLabelText('Hear the sound long a')).toBeInTheDocument()
  })

  it('renders pattern labels for regular patterns', () => {
    const { container } = render(<SpellingTree list={list} />)
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts).toContain('a_e')
    expect(texts).toContain('ai')
  })

  it('renders words as clickable leaves', () => {
    render(<SpellingTree list={list} />)
    expect(screen.getByRole('button', { name: 'Analyze the word cake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze the word rain' })).toBeInTheDocument()
  })

  it('shows the odd ducks label when odd ducks exist', () => {
    const { container } = render(<SpellingTree list={list} />)
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts.some((t) => t?.includes('Odd ducks'))).toBe(true)
  })

  it('opens word analysis when a word is clicked', () => {
    render(<SpellingTree list={list} />)
    fireEvent.click(screen.getByRole('button', { name: 'Analyze the word cake' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Word analysis for cake')
  })

  it('opens word analysis via keyboard', () => {
    render(<SpellingTree list={list} />)
    const word = screen.getByRole('button', { name: 'Analyze the word rain' })
    fireEvent.keyDown(word, { key: 'Enter' })
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Word analysis for rain')
  })

  it('closes word analysis', () => {
    render(<SpellingTree list={list} />)
    fireEvent.click(screen.getByRole('button', { name: 'Analyze the word cake' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close word analysis' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('speaks the sound when Hear sound is clicked', async () => {
    const { speak } = await import('@/lib/tts')
    render(<SpellingTree list={list} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear the sound long a' }))
    expect(vi.mocked(speak)).toHaveBeenCalledWith('long a')
  })

  it('truncates very long words in the tree', () => {
    const longWordList: WordList = {
      ...list,
      patterns: [
        {
          id: 'p1',
          sound: 's',
          pattern: 's',
          frequency: 'common',
          words: ['supercalifragilistic'],
        },
      ],
    }
    const { container } = render(<SpellingTree list={longWordList} />)
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts).toContain('supercal')
  })

  it('uses the list name when no patterns exist', () => {
    const empty: WordList = { ...list, patterns: [] }
    render(<SpellingTree list={empty} />)
    expect(screen.getByLabelText('Hear the sound Week 5: Long A')).toBeInTheDocument()
  })
})
