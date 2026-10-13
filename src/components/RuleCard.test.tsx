import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RuleCard from './RuleCard'

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
})
