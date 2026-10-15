import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ListRulesSection from './ListRulesSection'

const patterns = [
  { id: 'p1', pattern: 'a_e', rule: 'Magic e.' },
  { id: 'p2', pattern: 'ai' },
]

describe('ListRulesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one rule field per pattern with the effective rule', () => {
    render(
      <ListRulesSection patterns={patterns} classId={null} className={null} classRules={null} onSaveRule={vi.fn()} />
    )
    expect(screen.getByRole('heading', { name: 'Rules (2)' })).toBeInTheDocument()
    expect(screen.getByLabelText('Rule, in the kids\u2019 words', { selector: '#rule-p1' })).toHaveValue('Magic e.')
    expect(screen.getByLabelText('Rule, in the kids\u2019 words', { selector: '#rule-p2' })).toHaveValue('')
  })

  it('prefers the classroom rule and marks it shared', () => {
    render(
      <ListRulesSection
        patterns={patterns}
        classId="c1"
        className="Period 2"
        classRules={{ a_e: 'ai never ends a word.' }}
        onSaveRule={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Rule, in the kids\u2019 words', { selector: '#rule-p1' })).toHaveValue(
      'ai never ends a word.'
    )
    expect(screen.getByText('Shared with Period 2')).toBeInTheDocument()
    expect(screen.getByText(/Shared across Period 2/)).toBeInTheDocument()
  })

  it('shows the empty state when there are no patterns', () => {
    render(<ListRulesSection patterns={[]} classId={null} className={null} classRules={null} onSaveRule={vi.fn()} />)
    expect(screen.getByText('Add a spelling pattern above to write its rule.')).toBeInTheDocument()
  })

  it('saves on blur and shows the saved state', async () => {
    const onSaveRule = vi.fn().mockResolvedValue(undefined)
    render(
      <ListRulesSection patterns={patterns} classId={null} className={null} classRules={null} onSaveRule={onSaveRule} />
    )
    const field = screen.getByLabelText('Rule, in the kids\u2019 words', { selector: '#rule-p2' })
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'ai never ends a word.' } })
    fireEvent.blur(field)
    await waitFor(() => expect(onSaveRule).toHaveBeenCalledWith('p2', 'ai', 'ai never ends a word.'))
    // p2's row now shows Saved (p1 already had a saved rule).
    await waitFor(() => {
      const statuses = screen.getAllByText('Saved')
      expect(statuses).toHaveLength(2)
    })
  })

  it('shows an error and keeps the draft when saving fails', async () => {
    const onSaveRule = vi.fn().mockRejectedValue(new Error('down'))
    render(
      <ListRulesSection patterns={patterns} classId={null} className={null} classRules={null} onSaveRule={onSaveRule} />
    )
    const field = screen.getByLabelText('Rule, in the kids\u2019 words', { selector: '#rule-p2' })
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'ai never ends a word.' } })
    fireEvent.blur(field)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the rule. Try again.')
    expect(field).toHaveValue('ai never ends a word.')
  })

  it('does not save when the field is blurred unchanged', async () => {
    const onSaveRule = vi.fn()
    render(
      <ListRulesSection patterns={patterns} classId={null} className={null} classRules={null} onSaveRule={onSaveRule} />
    )
    const field = screen.getByLabelText('Rule, in the kids\u2019 words', { selector: '#rule-p1' })
    fireEvent.focus(field)
    fireEvent.blur(field)
    await waitFor(() => new Promise((r) => setTimeout(r, 20)))
    expect(onSaveRule).not.toHaveBeenCalled()
  })

  it('inserts a sentence starter into an empty field', () => {
    render(
      <ListRulesSection patterns={patterns} classId={null} className={null} classRules={null} onSaveRule={vi.fn()} />
    )
    // The second pattern's row (p2) is empty; its starters are the second group.
    fireEvent.click(screen.getAllByRole('button', { name: 'I notice that…' })[1])
    expect(screen.getByLabelText('Rule, in the kids\u2019 words', { selector: '#rule-p2' })).toHaveValue(
      'I notice that '
    )
  })

  it('appends a sentence starter to existing text', () => {
    render(
      <ListRulesSection patterns={patterns} classId={null} className={null} classRules={null} onSaveRule={vi.fn()} />
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'When a word has…' })[0])
    expect(screen.getByLabelText('Rule, in the kids\u2019 words', { selector: '#rule-p1' })).toHaveValue(
      'Magic e. When a word has '
    )
  })
})
