import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ListsPage, { metadata } from './page'

vi.mock('@/components/PatternListsManager', () => ({
  default: () => <div data-testid="pattern-lists-manager" />,
}))

describe('ListsPage', () => {
  it('has overview metadata', () => {
    expect(metadata.title).toBe('My spelling lists | PatternSpell')
    expect(metadata.description).toContain('Create a new list')
  })

  it('renders the page header, back link, and list manager', () => {
    render(<ListsPage />)

    expect(screen.getByRole('heading', { name: 'My Spelling Lists' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByTestId('pattern-lists-manager')).toBeInTheDocument()
  })
})
