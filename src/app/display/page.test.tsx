import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DisplayPage, { metadata } from './page'

vi.mock('@/components/TreeDisplayMode', () => ({
  default: () => <div data-testid="tree-display-mode" />,
}))

describe('DisplayPage', () => {
  it('has display-mode metadata', () => {
    expect(metadata.title).toBe('Display Mode | Shepherd Speller')
    expect(metadata.description).toContain('spelling tree')
  })

  it('renders the tree display mode', () => {
    render(<DisplayPage />)
    expect(screen.getByTestId('tree-display-mode')).toBeInTheDocument()
  })
})
