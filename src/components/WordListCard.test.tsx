import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WordListCard from './WordListCard'
import type { WordList } from '@/models/WordList'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  gradeLevel: '1',
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('WordListCard', () => {
  it('renders the list name, grade pill, and counts', () => {
    render(<WordListCard list={list} onOpen={vi.fn()} primaryLabel="Edit list" />)
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    expect(screen.getByText('Grade 1')).toBeInTheDocument()
    expect(screen.getByText('2 patterns, 3 words')).toBeInTheDocument()
  })

  it('shows pattern rows with power bars', () => {
    render(<WordListCard list={list} onOpen={vi.fn()} primaryLabel="Edit list" />)
    expect(screen.getByText('a_e')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Frequency: Common' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Frequency: Less common' })).toBeInTheDocument()
  })

  it('shows every pattern in the grid, not just the first three', () => {
    const manyPatterns: WordList = {
      ...list,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
        { id: 'p3', sound: 'long a', pattern: 'ay', frequency: 'common', words: ['day'] },
        { id: 'p4', sound: 'long a', pattern: 'eigh', frequency: 'rare', words: ['eight'] },
        { id: 'p5', sound: 'long a', pattern: 'ey', frequency: 'rare', words: ['they'] },
      ],
    }
    render(<WordListCard list={manyPatterns} onOpen={vi.fn()} primaryLabel="Edit list" />)
    for (const pattern of ['a_e', 'ai', 'ay', 'eigh', 'ey']) {
      expect(screen.getByText(pattern)).toBeInTheDocument()
    }
    expect(screen.getByText('5 patterns, 5 words')).toBeInTheDocument()
  })

  it('uses the list color for the accent bar', () => {
    const { container, rerender } = render(
      <WordListCard list={{ ...list, color: 'sky' }} onOpen={vi.fn()} primaryLabel="Edit list" />
    )
    expect(container.querySelector('.bg-sky.h-2')).toBeInTheDocument()

    rerender(<WordListCard list={{ ...list, color: 'coral' }} onOpen={vi.fn()} primaryLabel="Edit list" />)
    expect(container.querySelector('.bg-coral.h-2')).toBeInTheDocument()
  })

  it('falls back to the default color when the list has none stored', () => {
    const { container } = render(<WordListCard list={list} onOpen={vi.fn()} primaryLabel="Edit list" />)
    expect(container.querySelector('.bg-leaf.h-2')).toBeInTheDocument()
  })

  it('calls onOpen when Open is clicked', () => {
    const onOpen = vi.fn()
    render(<WordListCard list={list} onOpen={onOpen} primaryLabel="Edit list" />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit list' }))
    expect(onOpen).toHaveBeenCalledWith(list)
  })

  it('links Present to the display mode for the list', () => {
    render(<WordListCard list={list} onOpen={vi.fn()} primaryLabel="Edit list" />)
    expect(screen.getByRole('link', { name: 'Present' })).toHaveAttribute('href', '/display?list=l1')
  })

  it('hides the Present link when showPresent is false', () => {
    render(<WordListCard list={list} onOpen={vi.fn()} primaryLabel="Start practice" showPresent={false} />)
    expect(screen.queryByRole('link', { name: 'Present' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start practice' })).toBeInTheDocument()
  })

  it('uses a custom primary label when provided', () => {
    const onOpen = vi.fn()
    render(<WordListCard list={list} onOpen={onOpen} primaryLabel="Present chart" showPresent={false} />)
    const button = screen.getByRole('button', { name: 'Present chart' })
    expect(button).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument()
    fireEvent.click(button)
    expect(onOpen).toHaveBeenCalledWith(list)
  })

  it('renders a Delete button when onDelete is provided', () => {
    const onDelete = vi.fn()
    render(<WordListCard list={list} onOpen={vi.fn()} onDelete={onDelete} primaryLabel="Edit list" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(list)
  })

  it('omits the Delete button when onDelete is not provided', () => {
    render(<WordListCard list={list} onOpen={vi.fn()} primaryLabel="Edit list" />)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('omits the grade pill when the list has no grade level', () => {
    render(<WordListCard list={{ ...list, gradeLevel: undefined }} onOpen={vi.fn()} primaryLabel="Edit list" />)
    expect(screen.queryByText(/Grade/)).not.toBeInTheDocument()
  })

  it('uses singular wording for one pattern and one word', () => {
    const single: WordList = {
      ...list,
      patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'rare', words: ['cake'] }],
    }
    render(<WordListCard list={single} onOpen={vi.fn()} primaryLabel="Edit list" />)
    expect(screen.getByText('1 pattern, 1 word')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Frequency: Rare' })).toBeInTheDocument()
  })

  it('hides the pattern preview when showPreview is false', () => {
    render(<WordListCard list={list} onOpen={vi.fn()} primaryLabel="Edit list" showPreview={false} />)
    expect(screen.queryByLabelText('Spelling patterns')).not.toBeInTheDocument()
    expect(screen.queryByText('a_e')).not.toBeInTheDocument()
  })

  it('makes the whole card a link when href is provided', () => {
    render(
      <WordListCard
        list={list}
        primaryLabel="Present chart"
        showPresent={false}
        showPreview={false}
        href="/display?list=l1"
      />
    )
    const cardLink = screen.getByRole('link', { name: 'Present chart: Week 5: Long A' })
    expect(cardLink).toHaveAttribute('href', '/display?list=l1')
    expect(screen.queryByRole('button', { name: 'Present chart' })).not.toBeInTheDocument()
  })

  it('keeps the Delete button working above the card link', () => {
    const onDelete = vi.fn()
    render(
      <WordListCard
        list={list}
        onDelete={onDelete}
        primaryLabel="Present chart"
        showPresent={false}
        showPreview={false}
        href="/display?list=l1"
      />
    )
    expect(screen.getByRole('link', { name: 'Present chart: Week 5: Long A' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(list)
  })

  it('does not throw when the primary button is clicked without onOpen', () => {
    render(<WordListCard list={list} primaryLabel="Edit list" />)
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Edit list' }))).not.toThrow()
  })
})
