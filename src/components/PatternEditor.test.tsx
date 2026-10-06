import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PatternEditor from './PatternEditor'
import type { SpellingPattern } from '@/models/WordList'

const basePattern: SpellingPattern = {
  id: 'p1',
  sound: 'long a',
  pattern: 'a_e',
  frequency: 'common',
  words: ['cake', 'bake'],
}

function renderEditor(overrides: Partial<SpellingPattern> = {}) {
  const onChange = vi.fn()
  const onRemove = vi.fn()
  const pattern = { ...basePattern, ...overrides }
  render(<PatternEditor pattern={pattern} onChange={onChange} onRemove={onRemove} />)
  return { onChange, onRemove, pattern }
}

describe('PatternEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the pattern name, sound, frequency, and words', () => {
    renderEditor()
    expect(screen.getByLabelText('Pattern spelling')).toHaveValue('a_e')
    expect(screen.getByLabelText('Target sound')).toHaveValue('long a')
    expect(screen.getByText('Common')).toBeInTheDocument()
    expect(screen.getByText('Words (2)')).toBeInTheDocument()
    expect(screen.getByText('cake')).toBeInTheDocument()
    expect(screen.getByText('bake')).toBeInTheDocument()
  })

  it('announces an untitled pattern accessibly', () => {
    renderEditor({ pattern: '' })
    expect(screen.getByRole('region', { name: 'Untitled pattern' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete this pattern' })).toBeInTheDocument()
  })

  it('edits the pattern spelling', () => {
    const { onChange } = renderEditor()
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, pattern: 'ai' })
  })

  it('edits the target sound', () => {
    const { onChange } = renderEditor()
    fireEvent.change(screen.getByLabelText('Target sound'), { target: { value: 'long o' } })
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, sound: 'long o' })
  })

  it('changes frequency through the radio buttons', () => {
    const { onChange } = renderEditor()
    const lessCommon = screen.getByRole('radio', { name: 'Less common' })
    expect(lessCommon).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(lessCommon)
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, frequency: 'less-common' })
  })

  it('marks the selected frequency', () => {
    renderEditor({ frequency: 'rare' })
    expect(screen.getByRole('radio', { name: 'Rare' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Rare')).toBeInTheDocument()
  })

  it('toggles the odd-duck mark on', () => {
    const { onChange } = renderEditor()
    const toggle = screen.getByRole('button', { name: /mark as odd duck/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, isOddDuck: true })
  })

  it('shows the odd-duck state when set and toggles it off', () => {
    const { onChange } = renderEditor({ isOddDuck: true })
    const toggle = screen.getByRole('button', { name: 'Odd duck' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveTextContent('Odd duck')
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, isOddDuck: false })
  })

  it('adds a word with the Add button', () => {
    const { onChange } = renderEditor()
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'Game' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, words: ['cake', 'bake', 'game'] })
  })

  it('adds a word with the Enter key', () => {
    const { onChange } = renderEditor()
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'late' } })
    fireEvent.keyDown(screen.getByLabelText('New word'), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, words: ['cake', 'bake', 'late'] })
  })

  it('ignores other keys in the word input', () => {
    const { onChange } = renderEditor()
    fireEvent.keyDown(screen.getByLabelText('New word'), { key: 'a' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores empty and duplicate words', () => {
    const { onChange } = renderEditor()
    const input = screen.getByLabelText('New word')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'cake' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes a word through its chip button', () => {
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, words: ['bake'] })
  })

  it('calls onRemove when the delete button is pressed', () => {
    const { onRemove } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Delete pattern a_e' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
