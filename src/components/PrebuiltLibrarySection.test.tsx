import { describe, it, expect } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import PrebuiltLibrarySection from './PrebuiltLibrarySection'
import { getPrebuiltWeeks } from '@/lib/prebuilt-lists'

describe('PrebuiltLibrarySection', () => {
  it('renders the section with grade 1 weeks by default', () => {
    render(<PrebuiltLibrarySection />)
    expect(screen.getByRole('heading', { name: 'Prebuilt library' })).toBeInTheDocument()
    expect(screen.getByText('Showing 30 weeks of Grade 1 spelling patterns.')).toBeInTheDocument()
    const grid = screen.getByTestId('prebuilt-grid')
    expect(within(grid).getAllByRole('link', { name: /Preview:/ })).toHaveLength(30)
  })

  it('marks every card with the Prebuilt badge and links to the preview', () => {
    render(<PrebuiltLibrarySection />)
    const grid = screen.getByTestId('prebuilt-grid')
    expect(within(grid).getAllByText('Prebuilt').length).toBeGreaterThan(0)
    const link = within(grid).getByRole('link', { name: 'Preview: Grade 1 - Week 1' })
    expect(link).toHaveAttribute('href', '/lists/prebuilt/prebuilt-g1-w01')
  })

  it('switches grades with the pill tabs', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.click(screen.getByRole('tab', { name: 'K' }))
    expect(screen.getByText('Showing 12 weeks of Kindergarten spelling patterns.')).toBeInTheDocument()
    const grid = screen.getByTestId('prebuilt-grid')
    expect(within(grid).getByRole('link', { name: 'Preview: Grade K - Week 1' })).toBeInTheDocument()
  })

  it('searches patterns across all grades', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.change(screen.getByLabelText('Search prebuilt lists by pattern'), { target: { value: 'tion' } })
    // tion weeks exist in grades 3, 4, and 5: the search spans grades.
    const status = screen.getByRole('status')
    expect(status.textContent).toMatch(/weeks matching "tion" across all grades/)
    const grid = screen.getByTestId('prebuilt-grid')
    const links = within(grid).getAllByRole('link', { name: /Preview:/ })
    expect(links.length).toBeGreaterThan(1)
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs.some((h) => h?.includes('prebuilt-g4'))).toBe(true)
    expect(hrefs.some((h) => h?.includes('prebuilt-g5'))).toBe(true)
  })

  it('matches sounds as well as patterns', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.change(screen.getByLabelText('Search prebuilt lists by pattern'), { target: { value: 'long a' } })
    const grid = screen.getByTestId('prebuilt-grid')
    expect(within(grid).getAllByRole('link', { name: /Preview:/ }).length).toBeGreaterThan(0)
  })

  it('uses the singular when exactly one week matches', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.change(screen.getByLabelText('Search prebuilt lists by pattern'), { target: { value: 'wh' } })
    expect(screen.getByText('1 week matching "wh" across all grades.')).toBeInTheDocument()
  })

  it('shows an empty message when nothing matches', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.change(screen.getByLabelText('Search prebuilt lists by pattern'), { target: { value: 'zzzqqq' } })
    expect(screen.getByText('No prebuilt weeks match "zzzqqq".')).toBeInTheDocument()
    expect(screen.queryByTestId('prebuilt-grid')).not.toBeInTheDocument()
  })

  it('clears the search with the clear button', () => {
    render(<PrebuiltLibrarySection />)
    const search = screen.getByLabelText('Search prebuilt lists by pattern')
    fireEvent.change(search, { target: { value: 'tion' } })
    expect(screen.queryByTestId('prebuilt-grid')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Clear pattern search'))
    expect(search).toHaveValue('')
    expect(screen.getByText('Showing 30 weeks of Grade 1 spelling patterns.')).toBeInTheDocument()
  })

  it('keeps the grade-1 week count consistent with the data', () => {
    expect(getPrebuiltWeeks('1')).toHaveLength(30)
  })
})
