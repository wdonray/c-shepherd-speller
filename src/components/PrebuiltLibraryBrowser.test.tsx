import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrebuiltLibraryBrowser from './PrebuiltLibraryBrowser'

describe('PrebuiltLibraryBrowser', () => {
  it('defaults to Grade 1 and shows its weeks with pattern chips', () => {
    render(<PrebuiltLibraryBrowser />)
    expect(screen.getByRole('tab', { name: '1', selected: true })).toBeInTheDocument()
    expect(screen.getByText('Showing 30 weeks of Grade 1 spelling patterns')).toBeInTheDocument()
    const weekLinks = screen.getAllByRole('link')
    expect(weekLinks[0]).toHaveAttribute('href', '/library/prebuilt-g1-w01')
    expect(screen.getAllByText('Prebuilt').length).toBe(30)
  })

  it('switches grades via tabs', () => {
    render(<PrebuiltLibraryBrowser />)
    fireEvent.click(screen.getByRole('tab', { name: 'K' }))
    expect(screen.getByRole('tab', { name: 'K', selected: true })).toBeInTheDocument()
    expect(screen.getByText('Showing 12 weeks of Kindergarten spelling patterns')).toBeInTheDocument()
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/library/prebuilt-gk-w01')
  })

  it('shows pattern chips for each week', () => {
    render(<PrebuiltLibraryBrowser />)
    fireEvent.click(screen.getByRole('tab', { name: '5' }))
    expect(screen.getByText('Showing 30 weeks of Grade 5 spelling patterns')).toBeInTheDocument()
    // Grade 5 Week 1 covers the "phon" root
    expect(screen.getAllByText('phon').length).toBeGreaterThan(0)
  })
})
