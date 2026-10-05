import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SpellingDataCard from './SpellingDataCard'

const defaultProps = {
  title: 'Words',
  value: '',
  setValue: vi.fn(),
  addItem: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  spellingData: [] as string[],
  loading: false,
}

describe('SpellingDataCard', () => {
  beforeEach(() => {
    defaultProps.setValue.mockReset()
    defaultProps.addItem.mockReset()
    defaultProps.updateItem.mockReset()
    defaultProps.removeItem.mockReset()
  })

  it('renders the title and each item', () => {
    render(<SpellingDataCard {...defaultProps} spellingData={['cat', 'dog']} />)
    expect(screen.getByText('Words')).toBeInTheDocument()
    expect(screen.getByText('cat')).toBeInTheDocument()
    expect(screen.getByText('dog')).toBeInTheDocument()
  })

  it('shows the neutral empty-collection message when there are no items', () => {
    render(<SpellingDataCard {...defaultProps} />)
    expect(screen.getByText('No words in your collection yet. Add your first one above.')).toBeInTheDocument()
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

  it('blocks duplicate adds with an inline error', () => {
    render(<SpellingDataCard {...defaultProps} spellingData={['cat']} value="CAT" />)
    fireEvent.submit(screen.getByPlaceholderText('Add a new word to your list').closest('form') as HTMLFormElement)
    expect(defaultProps.addItem).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('"CAT" is already in your words list.')
  })

  it('clears the add error when the input changes', () => {
    render(<SpellingDataCard {...defaultProps} spellingData={['cat']} value="cat" />)
    fireEvent.submit(screen.getByPlaceholderText('Add a new word to your list').closest('form') as HTMLFormElement)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Add a new word to your list'), { target: { value: 'catnap' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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

  describe('inline editing', () => {
    it('opens edit mode with the current value when the edit button is clicked', () => {
      render(<SpellingDataCard {...defaultProps} spellingData={['cat']} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
      expect(screen.getByLabelText('Edit words 1')).toHaveValue('cat')
      expect(screen.getByRole('button', { name: 'Save "cat"' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel editing' })).toBeInTheDocument()
    })

    it('saves the edit on save-button click', () => {
      render(<SpellingDataCard {...defaultProps} spellingData={['cat']} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
      fireEvent.change(screen.getByLabelText('Edit words 1'), { target: { value: 'bat' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save "cat"' }))
      expect(defaultProps.updateItem).toHaveBeenCalledWith(0, 'bat')
      expect(screen.queryByLabelText('Edit words 1')).not.toBeInTheDocument()
    })

    it('saves the edit on Enter', () => {
      render(<SpellingDataCard {...defaultProps} spellingData={['cat']} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
      const input = screen.getByLabelText('Edit words 1')
      fireEvent.change(input, { target: { value: 'bat' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(defaultProps.updateItem).toHaveBeenCalledWith(0, 'bat')
    })

    it('ignores other keys in edit mode', () => {
      render(<SpellingDataCard {...defaultProps} spellingData={['cat']} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
      fireEvent.keyDown(screen.getByLabelText('Edit words 1'), { key: 'a' })
      expect(defaultProps.updateItem).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Edit words 1')).toBeInTheDocument()
    })

    it('cancels the edit on Escape and on the cancel button', () => {
      const { rerender } = render(<SpellingDataCard {...defaultProps} spellingData={['cat']} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
      fireEvent.keyDown(screen.getByLabelText('Edit words 1'), { key: 'Escape' })
      expect(screen.queryByLabelText('Edit words 1')).not.toBeInTheDocument()
      expect(defaultProps.updateItem).not.toHaveBeenCalled()

      rerender(<SpellingDataCard {...defaultProps} spellingData={['cat']} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
      fireEvent.change(screen.getByLabelText('Edit words 1'), { target: { value: 'bat' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel editing' }))
      expect(defaultProps.updateItem).not.toHaveBeenCalled()
      expect(screen.getByText('cat')).toBeInTheDocument()
    })

    it('blocks saving an empty value', () => {
      render(<SpellingDataCard {...defaultProps} spellingData={['cat']} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
      fireEvent.change(screen.getByLabelText('Edit words 1'), { target: { value: '   ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save "cat"' }))
      expect(defaultProps.updateItem).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('An item cannot be empty.')
    })

    it('blocks saving a duplicate of another item', () => {
      render(<SpellingDataCard {...defaultProps} spellingData={['cat', 'dog']} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
      fireEvent.change(screen.getByLabelText('Edit words 1'), { target: { value: 'DOG' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save "cat"' }))
      expect(defaultProps.updateItem).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('"DOG" is already in your words list.')
    })

    it('allows saving the same item with different casing', () => {
      render(<SpellingDataCard {...defaultProps} spellingData={['cat']} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
      fireEvent.change(screen.getByLabelText('Edit words 1'), { target: { value: 'Cat' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save "cat"' }))
      expect(defaultProps.updateItem).toHaveBeenCalledWith(0, 'Cat')
    })

    it('clears the edit error when the edit input changes', () => {
      render(<SpellingDataCard {...defaultProps} spellingData={['cat', 'dog']} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit "cat"' }))
      fireEvent.change(screen.getByLabelText('Edit words 1'), { target: { value: 'dog' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save "cat"' }))
      expect(screen.getByRole('alert')).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('Edit words 1'), { target: { value: 'dove' } })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('disables the edit button while loading', () => {
      render(<SpellingDataCard {...defaultProps} spellingData={['cat']} loading />)
      expect(screen.getByRole('button', { name: 'Edit "cat"' })).toBeDisabled()
    })
  })
})
