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
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('WordListCard', () => {
  it('renders the name, grade, and counts', () => {
    render(<WordListCard list={list} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    expect(screen.getByText('Grade 1')).toBeInTheDocument()
    expect(screen.getByText(/2 patterns · 3 words/)).toBeInTheDocument()
  })

  it('omits the grade when not set', () => {
    const noGrade: WordList = { ...list, gradeLevel: undefined }
    render(<WordListCard list={noGrade} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText(/Grade/)).not.toBeInTheDocument()
  })

  it('uses singular forms for one pattern and one word', () => {
    const single: WordList = {
      ...list,
      patterns: [{ id: 'p1', sound: 's', pattern: 's', frequency: 'common', words: ['sun'] }],
    }
    render(<WordListCard list={single} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/1 pattern · 1 word/)).toBeInTheDocument()
  })

  it('links to the display page with the list id', () => {
    render(<WordListCard list={list} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const link = screen.getByRole('link', { name: /present/i })
    expect(link).toHaveAttribute('href', '/display?list=l1')
  })

  it('calls onEdit when Edit is clicked', () => {
    const onEdit = vi.fn()
    render(<WordListCard list={list} onEdit={onEdit} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith(list)
  })

  it('calls onDelete when Delete is clicked', () => {
    const onDelete = vi.fn()
    render(<WordListCard list={list} onEdit={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledWith(list)
  })
})
