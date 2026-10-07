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
    render(<WordListCard list={list} onOpen={vi.fn()} />)
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    expect(screen.getByText('Grade 1')).toBeInTheDocument()
    expect(screen.getByText('2 patterns, 3 words')).toBeInTheDocument()
  })

  it('shows pattern rows with power bars', () => {
    render(<WordListCard list={list} onOpen={vi.fn()} />)
    expect(screen.getByText('a_e')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Frequency: Common' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Frequency: Less common' })).toBeInTheDocument()
  })

  it('cycles the accent color by index', () => {
    const { container, rerender } = render(<WordListCard list={list} index={0} onOpen={vi.fn()} />)
    expect(container.querySelector('.bg-leaf.h-2')).toBeInTheDocument()

    rerender(<WordListCard list={list} index={1} onOpen={vi.fn()} />)
    expect(container.querySelector('.bg-sky.h-2')).toBeInTheDocument()

    rerender(<WordListCard list={list} index={2} onOpen={vi.fn()} />)
    expect(container.querySelector('.bg-plum.h-2')).toBeInTheDocument()
  })

  it('calls onOpen when Open is clicked', () => {
    const onOpen = vi.fn()
    render(<WordListCard list={list} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onOpen).toHaveBeenCalledWith(list)
  })

  it('links Present to the display mode for the list', () => {
    render(<WordListCard list={list} onOpen={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Present' })).toHaveAttribute('href', '/display?list=l1')
  })

  it('hides the Present link when showPresent is false', () => {
    render(<WordListCard list={list} onOpen={vi.fn()} showPresent={false} />)
    expect(screen.queryByRole('link', { name: 'Present' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
  })

  it('renders a Delete button when onDelete is provided', () => {
    const onDelete = vi.fn()
    render(<WordListCard list={list} onOpen={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(list)
  })

  it('omits the Delete button when onDelete is not provided', () => {
    render(<WordListCard list={list} onOpen={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('omits the grade pill when the list has no grade level', () => {
    render(<WordListCard list={{ ...list, gradeLevel: undefined }} onOpen={vi.fn()} />)
    expect(screen.queryByText(/Grade/)).not.toBeInTheDocument()
  })

  it('uses singular wording for one pattern and one word', () => {
    const single: WordList = {
      ...list,
      patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'rare', words: ['cake'] }],
    }
    render(<WordListCard list={single} onOpen={vi.fn()} />)
    expect(screen.getByText('1 pattern, 1 word')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Frequency: Rare' })).toBeInTheDocument()
  })
})
