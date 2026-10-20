import { describe, it, expect } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import PrebuiltLibrarySection, { PREBUILT_WEEKS_PER_PAGE, prebuiltPageWindow } from './PrebuiltLibrarySection'
import { getPrebuiltWeeks } from '@/lib/prebuilt-lists'

describe('PrebuiltLibrarySection', () => {
  it('renders the section with grade 1 weeks by default', () => {
    render(<PrebuiltLibrarySection />)
    expect(screen.getByRole('heading', { name: 'Ready-made library' })).toBeInTheDocument()
    expect(screen.getByText('Showing 1-12 of 30 weeks of Grade 1 spelling patterns.')).toBeInTheDocument()
    const grid = screen.getByTestId('prebuilt-grid')
    // Issue #481: only the first page of 12 renders, not all 30 at once.
    expect(within(grid).getAllByRole('link', { name: /Preview:/ })).toHaveLength(12)
  })

  it('marks every card with the Prebuilt badge and links to the preview', () => {
    render(<PrebuiltLibrarySection />)
    const grid = screen.getByTestId('prebuilt-grid')
    expect(within(grid).getAllByText('Ready-made').length).toBeGreaterThan(0)
    const link = within(grid).getByRole('link', { name: 'Preview: Grade 1 - Week 1' })
    expect(link).toHaveAttribute('href', '/lists/prebuilt/prebuilt-g1-w01')
  })

  it('switches grades with the pill tabs', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.click(screen.getByRole('tab', { name: 'K' }))
    expect(screen.getByText('Showing 1-12 of 12 weeks of Kindergarten spelling patterns.')).toBeInTheDocument()
    const grid = screen.getByTestId('prebuilt-grid')
    expect(within(grid).getByRole('link', { name: 'Preview: Grade K - Week 1' })).toBeInTheDocument()
  })

  it('searches patterns across all grades', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.change(screen.getByLabelText('Search ready-made lists by pattern'), { target: { value: 'tion' } })
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
    fireEvent.change(screen.getByLabelText('Search ready-made lists by pattern'), { target: { value: 'long a' } })
    const grid = screen.getByTestId('prebuilt-grid')
    expect(within(grid).getAllByRole('link', { name: /Preview:/ }).length).toBeGreaterThan(0)
  })

  it('uses the singular when exactly one week matches', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.change(screen.getByLabelText('Search ready-made lists by pattern'), { target: { value: 'wh' } })
    expect(screen.getByText('Showing 1-1 of 1 week matching "wh" across all grades.')).toBeInTheDocument()
  })

  it('shows an empty message when nothing matches', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.change(screen.getByLabelText('Search ready-made lists by pattern'), { target: { value: 'zzzqqq' } })
    expect(screen.getByText('No ready-made weeks match "zzzqqq".')).toBeInTheDocument()
    expect(screen.queryByTestId('prebuilt-grid')).not.toBeInTheDocument()
  })

  it('clears the search with the clear button', () => {
    render(<PrebuiltLibrarySection />)
    const search = screen.getByLabelText('Search ready-made lists by pattern')
    fireEvent.change(search, { target: { value: 'tion' } })
    expect(screen.queryByTestId('prebuilt-grid')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Clear pattern search'))
    expect(search).toHaveValue('')
    expect(screen.getByText('Showing 1-12 of 30 weeks of Grade 1 spelling patterns.')).toBeInTheDocument()
  })

  it('keeps the grade-1 week count consistent with the data', () => {
    expect(getPrebuiltWeeks('1')).toHaveLength(30)
  })

  it('paginates grade weeks at 12 per page (issue #481)', () => {
    render(<PrebuiltLibrarySection />)
    const grid = screen.getByTestId('prebuilt-grid')

    // Page 1: weeks 1-12. Previous is disabled, page 1 is current.
    expect(within(grid).getByRole('link', { name: 'Preview: Grade 1 - Week 1' })).toBeInTheDocument()
    expect(within(grid).queryByRole('link', { name: 'Preview: Grade 1 - Week 13' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Go to page 1' })).toHaveAttribute('aria-current', 'page')

    // Page 2: weeks 13-24.
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))
    expect(screen.getByText('Showing 13-24 of 30 weeks of Grade 1 spelling patterns.')).toBeInTheDocument()
    expect(within(grid).getByRole('link', { name: 'Preview: Grade 1 - Week 13' })).toBeInTheDocument()
    expect(within(grid).queryByRole('link', { name: 'Preview: Grade 1 - Week 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute('aria-current', 'page')

    // Next button walks to the last page; it disables there.
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Showing 25-30 of 30 weeks of Grade 1 spelling patterns.')).toBeInTheDocument()
    expect(within(grid).getAllByRole('link', { name: /Preview:/ })).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()

    // Previous button walks back.
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByText('Showing 13-24 of 30 weeks of Grade 1 spelling patterns.')).toBeInTheDocument()
  })

  it('resets to page 1 when the grade changes', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 3' }))
    expect(screen.getByText('Showing 25-30 of 30 weeks of Grade 1 spelling patterns.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '2' }))
    expect(screen.getByText('Showing 1-12 of 30 weeks of Grade 2 spelling patterns.')).toBeInTheDocument()
    const grid = screen.getByTestId('prebuilt-grid')
    expect(within(grid).getByRole('link', { name: 'Preview: Grade 2 - Week 1' })).toBeInTheDocument()
  })

  it('resets to page 1 when the search changes', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 3' }))

    const search = screen.getByLabelText('Search ready-made lists by pattern')
    fireEvent.change(search, { target: { value: 'tion' } })
    expect(screen.getByText('Showing 1-8 of 8 weeks matching "tion" across all grades.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Ready-made library pages' })).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByText('Showing 1-12 of 30 weeks of Grade 1 spelling patterns.')).toBeInTheDocument()
  })

  it('hides the pager when everything fits on one page', () => {
    render(<PrebuiltLibrarySection />)
    fireEvent.click(screen.getByRole('tab', { name: 'K' }))
    expect(screen.queryByRole('navigation', { name: 'Ready-made library pages' })).not.toBeInTheDocument()
  })
})

describe('prebuiltPageWindow', () => {
  it('shows the first five pages at the start', () => {
    expect(prebuiltPageWindow(1, 14)).toEqual([1, 2, 3, 4, 5])
    expect(prebuiltPageWindow(3, 14)).toEqual([1, 2, 3, 4, 5])
  })

  it('centers the window on the current page in the middle', () => {
    expect(prebuiltPageWindow(7, 14)).toEqual([5, 6, 7, 8, 9])
  })

  it('shows the last five pages at the end', () => {
    expect(prebuiltPageWindow(13, 14)).toEqual([10, 11, 12, 13, 14])
    expect(prebuiltPageWindow(14, 14)).toEqual([10, 11, 12, 13, 14])
  })

  it('shows every page when there are five or fewer', () => {
    expect(prebuiltPageWindow(1, 1)).toEqual([1])
    expect(prebuiltPageWindow(2, 3)).toEqual([1, 2, 3])
    expect(prebuiltPageWindow(5, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('exposes the page size constant', () => {
    expect(PREBUILT_WEEKS_PER_PAGE).toBe(12)
  })
})
