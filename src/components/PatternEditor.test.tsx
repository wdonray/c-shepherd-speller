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

  it('gives the pattern and sound inputs visible boundaries and focus treatment', () => {
    renderEditor()
    const spelling = screen.getByLabelText('Pattern spelling')
    expect(spelling).toHaveClass(
      'border-2',
      'border-line',
      'bg-card',
      'focus-visible:border-sky-deep',
      'focus-visible:ring-[3px]'
    )
    expect(spelling).not.toHaveClass('border-transparent', 'bg-transparent')
    const sound = screen.getByLabelText('Target sound')
    expect(sound).toHaveClass(
      'border-2',
      'border-line',
      'bg-card',
      'focus-visible:border-sky-deep',
      'focus-visible:ring-[3px]'
    )
    expect(sound).not.toHaveClass('border-transparent', 'bg-transparent')
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
    expect(screen.getByText('Shows up in just a few words. Teach it last, or skip it for now.')).toBeInTheDocument()
  })

  it('explains what frequency means with helper text linked to the radiogroup', () => {
    renderEditor()
    const helper = screen.getByText(
      'How often this spelling shows up for the sound. Common spellings get the widest column on the chart.'
    )
    expect(helper).toBeInTheDocument()
    expect(helper).toHaveAttribute('id', 'frequency-help-p1')
    const radiogroup = screen.getByRole('radiogroup', { name: 'Frequency' })
    expect(radiogroup).toHaveAttribute('aria-describedby', 'frequency-help-p1')
  })

  it('gives each frequency option a teacher-language meaning in its title', () => {
    renderEditor()
    expect(screen.getByRole('radio', { name: 'Common' })).toHaveAttribute(
      'title',
      'Shows up in most words with this sound. Teach this spelling first.'
    )
    expect(screen.getByRole('radio', { name: 'Less common' })).toHaveAttribute(
      'title',
      'Shows up sometimes. Teach it after the common spelling.'
    )
    expect(screen.getByRole('radio', { name: 'Rare' })).toHaveAttribute(
      'title',
      'Shows up in just a few words. Teach it last, or skip it for now.'
    )
  })

  it('shows the meaning of the selected frequency beneath the readout', () => {
    const onChange = vi.fn()
    const onRemove = vi.fn()
    const { rerender } = render(<PatternEditor pattern={basePattern} onChange={onChange} onRemove={onRemove} />)
    expect(screen.getByText('Shows up in most words with this sound. Teach this spelling first.')).toBeInTheDocument()
    rerender(
      <PatternEditor pattern={{ ...basePattern, frequency: 'less-common' }} onChange={onChange} onRemove={onRemove} />
    )
    expect(screen.getByText('Shows up sometimes. Teach it after the common spelling.')).toBeInTheDocument()
  })

  it('gives the odd-duck toggle hover and focus-visible treatments in both states', () => {
    const onChange = vi.fn()
    const onRemove = vi.fn()
    const { rerender } = render(<PatternEditor pattern={basePattern} onChange={onChange} onRemove={onRemove} />)
    const off = screen.getByRole('button', { name: /mark as odd duck/i })
    expect(off).toHaveClass(
      'hover:border-plum',
      'hover:text-plum-ink',
      'focus-visible:border-plum',
      'focus-visible:text-plum-ink',
      'focus-visible:ring-[3px]'
    )

    rerender(<PatternEditor pattern={{ ...basePattern, isOddDuck: true }} onChange={onChange} onRemove={onRemove} />)
    const on = screen.getByRole('button', { name: 'Odd duck' })
    // The selected state must still respond to hover: no dead zone.
    expect(on).toHaveClass('hover:brightness-95', 'focus-visible:brightness-95', 'focus-visible:ring-[3px]')
  })

  it('gives frequency radios hover and focus-visible treatments in both states', () => {
    renderEditor()
    const selected = screen.getByRole('radio', { name: 'Common' })
    expect(selected).toHaveClass('hover:brightness-95', 'focus-visible:brightness-95', 'focus-visible:ring-[3px]')
    const unselected = screen.getByRole('radio', { name: 'Rare' })
    expect(unselected).toHaveClass('hover:opacity-100', 'focus-visible:opacity-100', 'focus-visible:ring-[3px]')
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

  it('shows up to 3 suggestion chips on exact sound+pattern match', () => {
    renderEditor()
    const group = screen.getByRole('group', { name: 'Try:' })
    expect(group).toBeInTheDocument()
    const chips = group.querySelectorAll('button')
    expect(chips.length).toBeLessThanOrEqual(3)
    expect(chips.length).toBeGreaterThan(0)
    // Each chip is a 44px touch target.
    chips.forEach((chip) => {
      expect(chip).toHaveClass('min-h-[44px]')
    })
  })

  it('shows no suggestions on near-miss pattern', () => {
    renderEditor({ pattern: 'aie' })
    expect(screen.queryByRole('group', { name: 'Try:' })).not.toBeInTheDocument()
  })

  it('shows no suggestions when sound is empty', () => {
    renderEditor({ sound: '' })
    expect(screen.queryByRole('group', { name: 'Try:' })).not.toBeInTheDocument()
  })

  it('adds a suggested word through the existing dedupe path', () => {
    const { onChange } = renderEditor()
    const group = screen.getByRole('group', { name: 'Try:' })
    const chip = group.querySelectorAll('button')[0]
    const word = chip.textContent
    fireEvent.click(chip)
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, words: [...basePattern.words, word] })
  })

  it('does not suggest words already in the list', () => {
    renderEditor()
    const group = screen.getByRole('group', { name: 'Try:' })
    const chipTexts = Array.from(group.querySelectorAll('button')).map((b) => b.textContent)
    // 'cake' and 'bake' are already in basePattern.words, so they are filtered out.
    expect(chipTexts).not.toContain('cake')
    expect(chipTexts).not.toContain('bake')
    expect(chipTexts).toContain('made')
  })

  it('renders a sentence picker for each word', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: 'Pick an example sentence for cake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pick an example sentence for bake' })).toBeInTheDocument()
  })

  it('removes the word sentence when the word is removed', () => {
    const { onChange } = renderEditor({
      sentences: { cake: 'We baked a cake.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    expect(onChange).toHaveBeenCalledWith({
      ...basePattern,
      words: ['bake'],
      sentences: undefined,
    })
  })
})
