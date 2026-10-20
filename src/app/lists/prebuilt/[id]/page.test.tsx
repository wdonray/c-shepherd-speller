import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrebuiltWeekPage, { metadata } from './page'

vi.mock('@/components/PatternChartDisplay', () => ({
  default: ({ list }: { list: { name: string } }) => <div data-testid="pattern-chart" data-name={list.name} />,
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
  useRouter: () => ({ push: vi.fn() }),
}))

describe('PrebuiltWeekPage', () => {
  it('has preview metadata', () => {
    expect(metadata.title).toContain('Ready-made')
    expect(metadata.description).toContain('Read-only')
  })

  it('renders a read-only chart preview for a known week', async () => {
    render(await PrebuiltWeekPage({ params: Promise.resolve({ id: 'prebuilt-g1-w01' }) }))
    expect(screen.getByRole('heading', { name: 'Grade 1 - Week 1' })).toBeInTheDocument()
    expect(screen.getByText('Ready-made')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Spelling Lists' })).toHaveAttribute('href', '/lists')
    const chart = screen.getByTestId('pattern-chart')
    expect(chart).toHaveAttribute('data-name', 'Grade 1 - Week 1')
  })

  it('renders the Phase B copy and pull actions', async () => {
    render(await PrebuiltWeekPage({ params: Promise.resolve({ id: 'prebuilt-g1-w01' }) }))
    expect(screen.getByRole('button', { name: 'Copy to my lists' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add patterns to...' })).toBeInTheDocument()
  })

  it('calls notFound for an unknown week id', async () => {
    await expect(PrebuiltWeekPage({ params: Promise.resolve({ id: 'nope' }) })).rejects.toThrow('notFound')
  })
})
