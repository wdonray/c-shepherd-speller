import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NewListPage, { metadata } from './page'

vi.mock('@/components/NewListForm', () => ({
  default: () => <div data-testid="new-list-form" />,
}))

describe('NewListPage', () => {
  it('has new-list metadata', () => {
    expect(metadata.title).toBe('New word list | PatternSpell')
    expect(metadata.description).toContain('Create a new pattern-based spelling list')
  })

  it('renders the new-list form', () => {
    render(<NewListPage />)

    expect(screen.getByTestId('new-list-form')).toBeInTheDocument()
  })
})
