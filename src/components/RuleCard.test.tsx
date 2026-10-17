import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RuleCard, { EmptyRulePlaceholder } from './RuleCard'

function renderCard(overrides: Partial<Parameters<typeof RuleCard>[0]> = {}) {
  const props = {
    rule: 'Magic e.',
    label: 'Your class decided:',
    saving: false,
    saveError: null,
    onSave: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<RuleCard {...props} />)
  return props
}

describe('RuleCard', () => {
  it('displays the rule with its label', () => {
    renderCard()
    expect(screen.getByText('Your class decided:')).toBeInTheDocument()
    expect(screen.getByText('Magic e.')).toBeInTheDocument()
  })

  it('opens the editor on Edit', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Edit rule')).toHaveValue('Magic e.')
  })

  it('saves the trimmed draft and closes the editor on success', async () => {
    const { onSave } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Edit rule'), { target: { value: '  ai never ends a word.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('ai never ends a word.')
    await waitFor(() => {
      expect(screen.queryByLabelText('Edit rule')).not.toBeInTheDocument()
    })
  })

  it('stays in edit mode when the save fails', async () => {
    renderCard({ onSave: vi.fn().mockRejectedValue(new Error('down')) })
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Edit rule')).toBeInTheDocument()
    })
  })

  it('cancels editing and restores the draft', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Edit rule'), { target: { value: 'changed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Magic e.')).toBeInTheDocument()
    // Reopening shows the original rule, not the discarded draft.
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Edit rule')).toHaveValue('Magic e.')
  })

  it('shows the save error and disables buttons while saving', () => {
    renderCard({ saving: true, saveError: 'Could not save the rule. Try again.' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save the rule. Try again.')
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('hides the Edit button when editable is false', () => {
    renderCard({ editable: false })
    expect(screen.getByText('Magic e.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('hides the Edit button when no onSave is provided', () => {
    render(<RuleCard rule="Magic e." label="Your class decided:" />)
    expect(screen.getByText('Magic e.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('hides the Delete button when no onDelete is provided', () => {
    renderCard()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('asks for confirmation before deleting', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    renderCard({ onDelete })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete this rule?')).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
    // Cancelling goes back to the rule display.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Magic e.')).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('deletes the rule on confirm', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    renderCard({ onDelete })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.queryByText('Delete this rule?')).not.toBeInTheDocument()
    })
  })

  it('shows an error and stays in the confirm step when deletion fails', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('down'))
    renderCard({ onDelete })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the rule. Try again.')
    // Still confirming: the teacher can retry or cancel.
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument()
  })

  it('disables the confirm buttons while deleting', async () => {
    let resolveDelete: () => void = () => {}
    const onDelete = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve
        })
    )
    renderCard({ onDelete })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    resolveDelete()
    await waitFor(() => {
      expect(screen.queryByText('Delete this rule?')).not.toBeInTheDocument()
    })
  })
})

describe('EmptyRulePlaceholder', () => {
  it('renders the visible No rule yet box', () => {
    render(<EmptyRulePlaceholder />)
    expect(screen.getByText('No rule yet')).toBeInTheDocument()
  })
})
