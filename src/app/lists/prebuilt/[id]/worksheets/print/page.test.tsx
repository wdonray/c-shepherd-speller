import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrebuiltWorksheetsPrintPage, { metadata } from './page'

vi.mock('@/components/worksheets/WorksheetsPrintPage', () => ({
  default: ({ prebuiltWeek, selectedTypes }: { prebuiltWeek: { id: string }; selectedTypes: string[] }) => (
    <div data-testid="worksheets-print" data-week={prebuiltWeek.id} data-types={selectedTypes.join(',')} />
  ),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))

describe('PrebuiltWorksheetsPrintPage', () => {
  it('has print metadata', () => {
    expect(metadata.title).toContain('Print worksheets')
  })

  it('renders the print job for a known week with selected types', async () => {
    render(
      await PrebuiltWorksheetsPrintPage({
        params: Promise.resolve({ id: 'prebuilt-g2-w06' }),
        searchParams: Promise.resolve({ types: 'spelling-list,word-search' }),
      })
    )

    const job = screen.getByTestId('worksheets-print')
    expect(job).toHaveAttribute('data-week', 'prebuilt-g2-w06')
    expect(job).toHaveAttribute('data-types', 'spelling-list,word-search')
  })

  it('falls back to every type when types is missing', async () => {
    render(
      await PrebuiltWorksheetsPrintPage({
        params: Promise.resolve({ id: 'prebuilt-g2-w06' }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(screen.getByTestId('worksheets-print').getAttribute('data-types')).toContain('spelling-list')
  })

  it('calls notFound for an unknown week id', async () => {
    await expect(
      PrebuiltWorksheetsPrintPage({ params: Promise.resolve({ id: 'nope' }), searchParams: Promise.resolve({}) })
    ).rejects.toThrow('notFound')
  })
})
