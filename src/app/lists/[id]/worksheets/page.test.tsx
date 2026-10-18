import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WorksheetsPage, { metadata } from './page'

vi.mock('@/components/worksheets/WorksheetPicker', () => ({
  default: ({ listId }: { listId: string }) => <div data-testid="worksheet-picker" data-list-id={listId} />,
}))

describe('WorksheetsPage', () => {
  it('has picker metadata', () => {
    expect(metadata.title).toBe('Printable worksheets | PatternSpell')
    expect(metadata.description).toContain('answer keys')
  })

  it('renders the worksheet picker for the route id', async () => {
    render(await WorksheetsPage({ params: Promise.resolve({ id: 'l1' }) }))
    const picker = screen.getByTestId('worksheet-picker')
    expect(picker).toBeInTheDocument()
    expect(picker).toHaveAttribute('data-list-id', 'l1')
  })
})
