import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LibraryWeekPage, { metadata } from './page'

vi.mock('@/components/PatternChartDisplay', () => ({
  default: ({ list }: { list: { name: string } }) => <div data-testid="pattern-chart" data-name={list.name} />,
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))

describe('LibraryWeekPage', () => {
  it('has preview metadata', () => {
    expect(metadata.title).toContain('Prebuilt')
    expect(metadata.description).toContain('Read-only')
  })

  it('renders a read-only chart preview for a known week', async () => {
    render(await LibraryWeekPage({ params: Promise.resolve({ id: 'prebuilt-g1-w01' }) }))
    expect(screen.getByRole('heading', { name: 'Grade 1 - Week 1' })).toBeInTheDocument()
    expect(screen.getByText('Prebuilt')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Prebuilt lists' })).toHaveAttribute('href', '/library')
    const chart = screen.getByTestId('pattern-chart')
    expect(chart).toHaveAttribute('data-name', 'Grade 1 - Week 1')
  })

  it('calls notFound for an unknown week id', async () => {
    await expect(LibraryWeekPage({ params: Promise.resolve({ id: 'nope' }) })).rejects.toThrow('notFound')
  })
})
