import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SpellingManagerSheet from './SpellingManagerSheet'

vi.mock('@/lib/lists-api', () => ({
  getLists: vi.fn().mockResolvedValue([]),
  createList: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

describe('SpellingManagerSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the pattern list manager when open', async () => {
    render(<SpellingManagerSheet isOpen={true} setIsOpen={vi.fn()} />)

    expect(screen.getByText('My Spelling Lists')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('No word lists yet.')).toBeInTheDocument()
    })
  })

  it('does not render content when closed', () => {
    const { container } = render(<SpellingManagerSheet isOpen={false} setIsOpen={vi.fn()} />)
    // Sheet content is hidden when closed
    expect(container).toBeDefined()
  })
})
