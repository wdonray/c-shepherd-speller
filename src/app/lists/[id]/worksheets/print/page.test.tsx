import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrintWorksheetsPage, { metadata } from './page'

vi.mock('@/components/worksheets/WorksheetsPrintPage', () => ({
  default: ({ listId, selectedTypes, testDate }: { listId: string; selectedTypes: string[]; testDate?: string }) => (
    <div
      data-testid="worksheets-print-page"
      data-list-id={listId}
      data-types={selectedTypes.join(',')}
      data-test-date={testDate ?? ''}
    />
  ),
}))

describe('PrintWorksheetsPage', () => {
  it('has print metadata', () => {
    expect(metadata.title).toBe('Print worksheets | PatternSpell')
    expect(metadata.description).toContain('answer keys')
  })

  it('passes valid selected types through', async () => {
    render(
      await PrintWorksheetsPage({
        params: Promise.resolve({ id: 'l1' }),
        searchParams: Promise.resolve({ types: 'word-search,crossword' }),
      })
    )
    const page = screen.getByTestId('worksheets-print-page')
    expect(page).toHaveAttribute('data-list-id', 'l1')
    expect(page).toHaveAttribute('data-types', 'word-search,crossword')
  })

  it('falls back to every type when the types param is absent', async () => {
    render(
      await PrintWorksheetsPage({
        params: Promise.resolve({ id: 'l1' }),
        searchParams: Promise.resolve({}),
      })
    )
    const page = screen.getByTestId('worksheets-print-page')
    expect(page.getAttribute('data-types')?.split(',')).toHaveLength(7)
  })

  it('falls back to every type when types are missing or unknown', async () => {
    render(
      await PrintWorksheetsPage({
        params: Promise.resolve({ id: 'l1' }),
        searchParams: Promise.resolve({ types: 'nope,also-nope' }),
      })
    )
    const page = screen.getByTestId('worksheets-print-page')
    expect(page.getAttribute('data-types')).toContain('spelling-list')
    expect(page.getAttribute('data-types')).toContain('parent-note')
    expect(page.getAttribute('data-types')?.split(',')).toHaveLength(7)
  })

  it('passes a valid test date through to the print page', async () => {
    render(
      await PrintWorksheetsPage({
        params: Promise.resolve({ id: 'l1' }),
        searchParams: Promise.resolve({ types: 'parent-note', testDate: '2026-10-30' }),
      })
    )
    expect(screen.getByTestId('worksheets-print-page')).toHaveAttribute('data-test-date', '2026-10-30')
  })

  it('ignores a test date that is not YYYY-MM-DD shaped', async () => {
    render(
      await PrintWorksheetsPage({
        params: Promise.resolve({ id: 'l1' }),
        searchParams: Promise.resolve({ types: 'parent-note', testDate: 'next friday' }),
      })
    )
    expect(screen.getByTestId('worksheets-print-page')).toHaveAttribute('data-test-date', '')
  })
})
