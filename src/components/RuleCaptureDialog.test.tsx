import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RuleCaptureDialog, { type RulePattern } from './RuleCaptureDialog'

const patterns: RulePattern[] = [
  { id: 'p1', pattern: 'a_e' },
  { id: 'p2', pattern: 'ai' },
]

function renderDialog(overrides: Partial<Parameters<typeof RuleCaptureDialog>[0]> = {}) {
  const props = {
    open: true,
    patterns,
    existingRules: {},
    className: 'Period 2',
    saving: false,
    saveError: null,
    onSave: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  }
  render(<RuleCaptureDialog {...props} />)
  return props
}

describe('RuleCaptureDialog', () => {
  it('renders nothing when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks what rule the class discovered, with one field per pattern', () => {
    renderDialog()
    expect(screen.getByText('What rule did Period 2 discover?')).toBeInTheDocument()
    expect(screen.getByLabelText(/Pattern a_e/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Pattern ai/)).toBeInTheDocument()
  })

  it('uses a generic heading when sorting without a class', () => {
    renderDialog({ className: null })
    expect(screen.getByText('What rule did you discover?')).toBeInTheDocument()
  })

  it('prefills fields with existing rules', () => {
    renderDialog({ existingRules: { a_e: 'Magic e.' } })
    expect(screen.getByLabelText(/Pattern a_e/)).toHaveValue('Magic e.')
    expect(screen.getByLabelText(/Pattern ai/)).toHaveValue('')
  })

  it('inserts a sentence starter into the focused field', () => {
    renderDialog()
    const field = screen.getByLabelText(/Pattern ai/)
    fireEvent.focus(field)
    fireEvent.click(screen.getByRole('button', { name: 'I notice that…' }))
    expect(field).toHaveValue('I notice that ')
  })

  it('appends a starter to a field that already has text', () => {
    renderDialog({ existingRules: { a_e: 'Magic e.' } })
    const field = screen.getByLabelText(/Pattern a_e/)
    fireEvent.focus(field)
    fireEvent.click(screen.getByRole('button', { name: 'When a word has…' }))
    expect(field).toHaveValue('Magic e. When a word has ')
  })

  it('saves only changed rules on Save', () => {
    const { onSave } = renderDialog({ existingRules: { a_e: 'Magic e.' } })
    fireEvent.change(screen.getByLabelText(/Pattern ai/), { target: { value: 'ai never ends a word.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }))
    expect(onSave).toHaveBeenCalledWith({ ai: 'ai never ends a word.' })
  })

  it('sends an empty string for a cleared rule', () => {
    const { onSave } = renderDialog({ existingRules: { a_e: 'Magic e.' } })
    fireEvent.change(screen.getByLabelText(/Pattern a_e/), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }))
    expect(onSave).toHaveBeenCalledWith({ a_e: '' })
  })

  it('calls onSkip when Skip is clicked', () => {
    const { onSkip } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onSkip).toHaveBeenCalled()
  })

  it('does nothing when a starter is tapped with no patterns', () => {
    const { onSave } = renderDialog({ patterns: [] })
    fireEvent.click(screen.getByRole('button', { name: 'I notice that…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }))
    expect(onSave).toHaveBeenCalledWith({})
  })

  it('shows the save error and disables buttons while saving', () => {
    renderDialog({ saving: true, saveError: 'Could not save the rules. Try again.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save the rules. Try again.')
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled()
  })
})
