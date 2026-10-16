import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PatternRuleEditor from './PatternRuleEditor'

const KIDS_WORDS_LABEL = 'Rule, in the kids’ words'

function renderEditor(
  overrides: Partial<{
    patternId: string
    patternText: string
    initialRule: string
    shared: boolean
    className: string | null
    onSave: (rule: string) => Promise<void>
  }> = {}
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined)
  render(
    <PatternRuleEditor
      patternId="p1"
      patternText="a_e"
      initialRule=""
      shared={false}
      className={null}
      onSave={onSave}
      {...overrides}
    />
  )
  return { onSave: onSave as ReturnType<typeof vi.fn> }
}

function openModal() {
  fireEvent.click(screen.getByRole('button', { name: /^(Add|Edit) rule for/ }))
  return screen.getByRole('dialog')
}

function textarea() {
  return screen.getByLabelText(KIDS_WORDS_LABEL) as HTMLTextAreaElement
}

describe('PatternRuleEditor collapsed state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "Add rule" when there is no rule', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: 'Add rule for a_e' })).toHaveTextContent('Add rule')
  })

  it('shows a one-line preview and an edit label when a rule exists', () => {
    renderEditor({ initialRule: 'ai never ends a word.' })
    const button = screen.getByRole('button', { name: 'Edit rule for a_e' })
    expect(button).toHaveTextContent('ai never ends a word.')
  })

  it('styles the collapsed row as a soft affordance, not a text input', () => {
    renderEditor()
    const row = screen.getByRole('button', { name: 'Add rule for a_e' })
    expect(row).toHaveClass('bg-muted/40')
    expect(row).not.toHaveClass('bg-background')
  })

  it('shows the shared caption when the rule is shared with a classroom', () => {
    renderEditor({ initialRule: 'Magic e.', shared: true, className: 'Period 2' })
    expect(screen.getByText('Shared with Period 2')).toBeInTheDocument()
  })

  it('shows no shared caption without a classroom', () => {
    renderEditor({ initialRule: 'Magic e.' })
    expect(screen.queryByText(/Shared with/)).not.toBeInTheDocument()
  })

  it('shows no shared badge when shared but the class name is unknown', () => {
    renderEditor({ initialRule: 'Magic e.', shared: true, className: null })
    expect(screen.queryByText(/Shared with/)).not.toBeInTheDocument()
  })
})

describe('PatternRuleEditor modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the dialog with the pattern chip title and no-class copy', async () => {
    renderEditor()
    openModal()
    expect(screen.getByRole('dialog', { name: 'Rule for a_e' })).toBeInTheDocument()
    expect(screen.getByText('a_e')).toBeInTheDocument()
    expect(
      screen.getByText('What the class figured out, in their words. Shown on the present chart.')
    ).toBeInTheDocument()
    expect(screen.getByText('No rule yet')).toBeInTheDocument()
  })

  it('shows the classroom copy and shared badge when there is a class', () => {
    renderEditor({ shared: true, className: 'Period 2' })
    openModal()
    expect(screen.getByText(/Shared across Period 2’s lists and shown on the present chart/)).toBeInTheDocument()
    // One shared caption under the collapsed row, one badge in the modal.
    expect(screen.getAllByText('Shared with Period 2')).toHaveLength(2)
  })

  it('shows "untitled" for an empty pattern', () => {
    renderEditor({ patternText: '' })
    openModal()
    expect(screen.getByText('untitled')).toBeInTheDocument()
  })

  it('autofocuses the textarea on open', async () => {
    renderEditor()
    openModal()
    await waitFor(() => expect(textarea()).toHaveFocus())
  })

  it('appends sentence starters to the draft', async () => {
    renderEditor()
    openModal()
    const field = textarea()
    await waitFor(() => expect(field).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'I notice that…' }))
    expect(field).toHaveValue('I notice that ')
    fireEvent.click(screen.getByRole('button', { name: 'When a word has…' }))
    expect(field).toHaveValue('I notice that When a word has ')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('saves a trimmed draft and closes on Done', async () => {
    const { onSave } = renderEditor()
    openModal()
    fireEvent.change(textarea(), { target: { value: '  ai never ends a word.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('ai never ends a word.'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // The collapsed preview picks up the saved rule.
    expect(screen.getByRole('button', { name: 'Edit rule for a_e' })).toHaveTextContent('ai never ends a word.')
  })

  it('closes without saving when Done is pressed with no changes', async () => {
    const { onSave } = renderEditor({ initialRule: 'Magic e.' })
    openModal()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows "Saving…" while the save is pending', async () => {
    let resolveSave!: () => void
    const onSave = vi.fn(() => new Promise<void>((resolve) => (resolveSave = resolve)))
    renderEditor({ onSave })
    openModal()
    fireEvent.change(textarea(), { target: { value: 'Magic e.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('Saving…')).toBeInTheDocument()
    resolveSave()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps the modal open with the draft intact when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('down'))
    renderEditor({ onSave })
    openModal()
    fireEvent.change(textarea(), { target: { value: 'Magic e.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the rule. Try again.')
    expect(textarea()).toHaveValue('Magic e.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('saves on close via the corner X when dirty', async () => {
    const { onSave } = renderEditor()
    openModal()
    fireEvent.change(textarea(), { target: { value: 'Magic e.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Magic e.'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('saves on Escape when dirty', async () => {
    const { onSave } = renderEditor()
    openModal()
    fireEvent.change(textarea(), { target: { value: 'Magic e.' } })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Magic e.'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('clears the rule immediately and shows "No rule yet"', async () => {
    const { onSave } = renderEditor({ initialRule: 'Magic e.' })
    openModal()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(''))
    expect(textarea()).toHaveValue('')
    expect(screen.getByText('No rule yet')).toBeInTheDocument()
  })

  it('restores the draft when clearing fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('down'))
    renderEditor({ onSave, initialRule: 'Magic e.' })
    openModal()
    fireEvent.change(textarea(), { target: { value: 'Magic e. Plus more.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the rule. Try again.')
    expect(textarea()).toHaveValue('Magic e. Plus more.')
  })

  it('ignores a second Clear while the first save is pending', async () => {
    let resolveSave!: () => void
    const onSave = vi.fn(() => new Promise<void>((resolve) => (resolveSave = resolve)))
    renderEditor({ onSave, initialRule: 'Magic e.' })
    openModal()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    resolveSave()
    await waitFor(() => expect(textarea()).toHaveValue(''))
  })

  it('ignores a close requested while a save is still running', async () => {
    let resolveSave!: () => void
    const onSave = vi.fn(() => new Promise<void>((resolve) => (resolveSave = resolve)))
    renderEditor({ onSave })
    openModal()
    fireEvent.change(textarea(), { target: { value: 'Magic e.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('Saving…')).toBeInTheDocument()
    // A second Done, or Escape, while the save is pending does nothing:
    // the modal stays open so a failed save can surface its error.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onSave).toHaveBeenCalledTimes(1)
    resolveSave()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('picks up a rule change that arrived while the modal was open once it closes', async () => {
    const { rerender } = render(
      <PatternRuleEditor
        patternId="p1"
        patternText="a_e"
        initialRule=""
        shared={false}
        className={null}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    )
    expect(screen.getByRole('button', { name: 'Add rule for a_e' })).toBeInTheDocument()
    rerender(
      <PatternRuleEditor
        patternId="p1"
        patternText="a_e"
        initialRule="Magic e."
        shared={false}
        className={null}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit rule for a_e' })).toHaveTextContent('Magic e.'))
  })

  it('does not clobber the draft when the rule changes while the modal is open', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <PatternRuleEditor
        patternId="p1"
        patternText="a_e"
        initialRule=""
        shared={false}
        className={null}
        onSave={onSave}
      />
    )
    openModal()
    fireEvent.change(textarea(), { target: { value: 'My new rule' } })
    rerender(
      <PatternRuleEditor
        patternId="p1"
        patternText="a_e"
        initialRule="Someone else's rule"
        shared={false}
        className={null}
        onSave={onSave}
      />
    )
    expect(textarea()).toHaveValue('My new rule')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('My new rule'))
  })

  it('syncs a rule that arrived while the modal was open after it closes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <PatternRuleEditor
        patternId="p1"
        patternText="a_e"
        initialRule=""
        shared={false}
        className={null}
        onSave={onSave}
      />
    )
    openModal()
    // The classroom fetch delivers a rule while the modal is open: the
    // draft is not clobbered.
    rerender(
      <PatternRuleEditor
        patternId="p1"
        patternText="a_e"
        initialRule="Classroom rule."
        shared={false}
        className={null}
        onSave={onSave}
      />
    )
    expect(textarea()).toHaveValue('')
    // Closing without edits picks the arrived rule up on the card.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Edit rule for a_e' })).toHaveTextContent('Classroom rule.')
  })
})
