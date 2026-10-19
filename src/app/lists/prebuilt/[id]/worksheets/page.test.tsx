import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrebuiltWorksheetsPage, { metadata } from './page'

vi.mock('@/components/worksheets/WorksheetPicker', () => ({
  default: ({ prebuiltWeek }: { prebuiltWeek: { id: string } }) => (
    <div data-testid="worksheet-picker" data-week={prebuiltWeek.id} />
  ),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))

describe('PrebuiltWorksheetsPage', () => {
  it('has picker metadata', () => {
    expect(metadata.title).toContain('Printable worksheets')
  })

  it('renders the picker for a known week', async () => {
    render(await PrebuiltWorksheetsPage({ params: Promise.resolve({ id: 'prebuilt-g2-w06' }) }))

    expect(screen.getByTestId('worksheet-picker')).toHaveAttribute('data-week', 'prebuilt-g2-w06')
  })

  it('calls notFound for an unknown week id', async () => {
    await expect(PrebuiltWorksheetsPage({ params: Promise.resolve({ id: 'nope' }) })).rejects.toThrow('notFound')
  })
})
