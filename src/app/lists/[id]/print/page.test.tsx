import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrintListPage, { metadata } from './page'

vi.mock('@/components/PrintPage', () => ({
  default: ({ listId }: { listId: string }) => <div data-testid="print-page" data-list-id={listId} />,
}))

describe('PrintListPage', () => {
  it('has print metadata', () => {
    expect(metadata.title).toBe('Print pattern chart | PatternSpell')
    expect(metadata.description).toContain('classroom wall')
  })

  it('renders the print page for the route id', async () => {
    render(await PrintListPage({ params: Promise.resolve({ id: 'l1' }) }))
    const page = screen.getByTestId('print-page')
    expect(page).toBeInTheDocument()
    expect(page).toHaveAttribute('data-list-id', 'l1')
  })
})
