import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SpellingDataCard from './SpellingDataCard'

const defaultProps = {
  title: 'Words',
  value: '',
  setValue: vi.fn(),
  addItem: vi.fn(),
  removeItem: vi.fn(),
  spellingData: [] as string[],
  loading: false,
}

describe('SpellingDataCard', () => {
  beforeEach(() => {
    defaultProps.setValue.mockReset()
    defaultProps.addItem.mockReset()
    defaultProps.removeItem.mockReset()
  })

  it('renders the title and each item', () => {
    render(<SpellingDataCard {...defaultProps} spellingData={['cat', 'dog']} />)
    expect(screen.getByText('Words')).toBeInTheDocument()
    expect(screen.getByText('cat')).toBeInTheDocument()
    expect(screen.getByText('dog')).toBeInTheDocument()
  })

  it('shows the empty-collection alert when there are no items', () => {
    render(<SpellingDataCard {...defaultProps} />)
    expect(screen.getByText('No words in your collection yet')).toBeInTheDocument()
  })

  it('calls setValue when the input changes', () => {
    render(<SpellingDataCard {...defaultProps} />)
    fireEvent.change(screen.getByPlaceholderText('Add a new word to your list'), {
      target: { value: 'bat' },
    })
    expect(defaultProps.setValue).toHaveBeenCalledWith('bat')
  })

  it('calls addItem on form submit', () => {
    const { container } = render(<SpellingDataCard {...defaultProps} value="bat" />)
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form as HTMLFormElement)
    expect(defaultProps.addItem).toHaveBeenCalledTimes(1)
  })

  it('calls removeItem with the item index when Remove is clicked', () => {
    render(<SpellingDataCard {...defaultProps} spellingData={['cat', 'dog']} value="x" />)
    fireEvent.click(screen.getAllByText('Remove')[1])
    expect(defaultProps.removeItem).toHaveBeenCalledWith(1)
  })

  it('disables the submit button for blank input and for loading', () => {
    const { rerender } = render(<SpellingDataCard {...defaultProps} value="" />)
    const input = screen.getByPlaceholderText('Add a new word to your list')
    expect(input.closest('div')?.querySelector('button')).toBeDisabled()

    rerender(<SpellingDataCard {...defaultProps} value="bat" loading spellingData={['cat']} />)
    const submit = screen.getByPlaceholderText('Add a new word to your list').closest('div')?.querySelector('button')
    expect(submit).toBeDisabled()
  })

  it('disables remove buttons while loading', () => {
    render(<SpellingDataCard {...defaultProps} spellingData={['cat']} value="x" loading />)
    expect(screen.getByText('Remove')).toBeDisabled()
  })

  it('uses the right placeholders for each card type', () => {
    const { rerender } = render(<SpellingDataCard {...defaultProps} title="Sounds" />)
    expect(screen.getByPlaceholderText('Add a new sound pattern')).toBeInTheDocument()
    rerender(<SpellingDataCard {...defaultProps} title="Spelling" />)
    expect(screen.getByPlaceholderText('Add a new spelling rule')).toBeInTheDocument()
  })
})
