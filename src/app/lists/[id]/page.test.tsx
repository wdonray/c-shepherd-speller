import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ListPage, { metadata } from './page'

vi.mock('@/components/ListEditorPage', () => ({
  default: ({ listId }: { listId: string }) => <div data-testid="list-editor-page" data-list-id={listId} />,
}))

describe('ListPage', () => {
  it('has editor metadata', () => {
    expect(metadata.title).toBe('Edit word list | PatternSpell')
    expect(metadata.description).toContain('Changes save automatically')
  })

  it('renders the list editor for the route id', async () => {
    render(await ListPage({ params: Promise.resolve({ id: 'l1' }) }))
    const editor = screen.getByTestId('list-editor-page')
    expect(editor).toBeInTheDocument()
    expect(editor).toHaveAttribute('data-list-id', 'l1')
  })
})
