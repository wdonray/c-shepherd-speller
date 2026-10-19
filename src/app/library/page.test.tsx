import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LibraryPage, { metadata } from './page'

vi.mock('@/components/PrebuiltLibraryBrowser', () => ({
  default: () => <div data-testid="prebuilt-library-browser" />,
}))

describe('LibraryPage', () => {
  it('has library metadata', () => {
    expect(metadata.title).toBe('Prebuilt spelling lists | PatternSpell')
    expect(metadata.description).toContain('162 weeks')
  })

  it('renders the page header, back link, and library browser', () => {
    render(<LibraryPage />)
    expect(screen.getByRole('heading', { name: 'Prebuilt spelling lists' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home')
    expect(screen.getByTestId('prebuilt-library-browser')).toBeInTheDocument()
  })
})
