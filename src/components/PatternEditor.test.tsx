import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PatternEditor from './PatternEditor'
import type { SpellingPattern } from '@/models/WordList'

vi.mock('@/lib/example-sentences', () => ({
  fetchExampleSentences: vi.fn().mockResolvedValue(['We baked a cake.']),
}))

vi.mock('@/lib/profile-image', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/profile-image')>()
  return {
    ...original,
    processKeywordImage: vi.fn(),
  }
})

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

  it('renders the pattern as a text input teachers can type into', () => {
    renderEditor()
    const input = screen.getByLabelText('Pattern spelling')
    expect(input.tagName).toBe('INPUT')
    expect(input).toHaveAttribute('placeholder', 'e.g. a_e')
  })

  it('accepts any custom spelling via the text input', () => {
    const { onChange } = renderEditor({ pattern: '' })
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'xyz' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pattern: 'xyz' }))
  })

  it('does not offer an odd-duck toggle on patterns (only words can be odd ducks)', () => {
    renderEditor()
    expect(screen.queryByRole('button', { name: /odd duck/i })).not.toBeInTheDocument()
    // Existing data with the flag set must not crash or surface the toggle.
    const { rerender } = render(
      <PatternEditor pattern={{ ...basePattern, isOddDuck: true }} onChange={vi.fn()} onRemove={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: /odd duck/i })).not.toBeInTheDocument()
    rerender(<PatternEditor pattern={basePattern} onChange={vi.fn()} onRemove={vi.fn()} />)
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
    const lessCommon = screen.getByRole('radio', { name: /^Less common\./ })
    expect(lessCommon).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(lessCommon)
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, frequency: 'less-common' })
  })

  it('marks the selected frequency', () => {
    renderEditor({ frequency: 'rare' })
    expect(screen.getByRole('radio', { name: /^Rare\./ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Rare')).toBeInTheDocument()
  })

  it('explains frequency in a help modal behind the info button', async () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'About frequency' }))
    await waitFor(() => {
      expect(screen.getByText('About frequency')).toBeInTheDocument()
    })
    expect(
      screen.getByText(
        'How often this spelling shows up for the sound. Common spellings get the widest column on the chart.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Shows up in most words with this sound. Teach this spelling first.')).toBeInTheDocument()
  })

  it('gives each frequency option a teacher-language meaning in its accessible name', () => {
    renderEditor()
    expect(screen.getByRole('radio', { name: /Common.*Teach this spelling first/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Less common.*Teach it after the common spelling/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Rare.*Teach it last/ })).toBeInTheDocument()
  })

  it('shows the selected frequency label beneath the radios', () => {
    const onChange = vi.fn()
    const onRemove = vi.fn()
    const { rerender } = render(<PatternEditor pattern={basePattern} onChange={onChange} onRemove={onRemove} />)
    expect(screen.getByText('Common')).toBeInTheDocument()
    rerender(
      <PatternEditor pattern={{ ...basePattern, frequency: 'less-common' }} onChange={onChange} onRemove={onRemove} />
    )
    expect(screen.getByText('Less common')).toBeInTheDocument()
  })

  it('gives frequency radios hover and focus-visible treatments in both states', () => {
    renderEditor()
    const selected = screen.getByRole('radio', { name: /^Common\./ })
    expect(selected).toHaveClass('hover:brightness-95', 'focus-visible:brightness-95', 'focus-visible:ring-[3px]')
    const unselected = screen.getByRole('radio', { name: /^Rare\./ })
    expect(unselected).toHaveClass('hover:opacity-100', 'focus-visible:opacity-100', 'focus-visible:ring-[3px]')
  })

  it('renders a lock toggle pill', () => {
    renderEditor()
    const toggle = screen.getByRole('button', { name: 'Lock pattern' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveClass('rounded-full', 'border-2', 'min-h-[44px]')
  })

  it('toggles the lock on', () => {
    const { onChange } = renderEditor()
    const toggle = screen.getByRole('button', { name: 'Lock pattern' })
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, isLocked: true })
  })

  it('shows the locked state when set and toggles it off', () => {
    const { onChange } = renderEditor({ isLocked: true })
    const toggle = screen.getByRole('button', { name: 'Locked' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveTextContent('Locked')
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, isLocked: false })
  })

  it('explains the lock in a tooltip', async () => {
    renderEditor()
    const toggle = screen.getByRole('button', { name: 'Lock pattern' })
    fireEvent.focus(toggle)
    await waitFor(() => {
      expect(screen.getByText('Locked patterns are hidden in present mode until you unlock them.')).toBeInTheDocument()
    })
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

  it('labels the pattern delete button with visible text instead of an icon alone', () => {
    renderEditor()
    const deleteButton = screen.getByRole('button', { name: 'Delete pattern a_e' })
    expect(deleteButton).toHaveTextContent('Delete pattern')
  })

  it('separates the pattern delete button from the editing controls', () => {
    renderEditor()
    const deleteButton = screen.getByRole('button', { name: 'Delete pattern a_e' })
    expect(deleteButton.parentElement?.className).toMatch(/border-t-2/)
  })

  it('gives the pattern delete button a 44px minimum touch target', () => {
    renderEditor()
    const deleteButton = screen.getByRole('button', { name: 'Delete pattern a_e' })
    expect(deleteButton.className).toMatch(/min-h-\[44px\]/)
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
    expect(screen.getByRole('button', { name: 'Add example sentence for cake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add example sentence for bake' })).toBeInTheDocument()
  })

  it('removes the word sentence when the word is removed', () => {
    const { onChange } = renderEditor({
      sentences: { cake: 'We baked a cake.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    // Confirmation modal appears because the word has a sentence.
    fireEvent.click(screen.getByRole('button', { name: 'Remove word' }))
    expect(onChange).toHaveBeenCalledWith({
      ...basePattern,
      words: ['bake'],
      sentences: undefined,
    })
  })

  it('asks for confirmation before removing a word with a sentence', () => {
    const { onChange } = renderEditor({
      sentences: { cake: 'We baked a cake.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    expect(screen.getByText('Remove this word?')).toBeInTheDocument()
    // Cancelling keeps the word.
    fireEvent.click(screen.getByRole('button', { name: 'Keep word' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes the delete confirmation when dismissed', async () => {
    renderEditor({
      sentences: { cake: 'We baked a cake.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    expect(screen.getByText('Remove this word?')).toBeInTheDocument()
    // Dismiss via the dialog's close button (X)
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    await waitFor(() => {
      expect(screen.queryByText('Remove this word?')).not.toBeInTheDocument()
    })
  })

  it('closes the frequency help dialog', async () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'About frequency' }))
    await waitFor(() => {
      expect(screen.getByText('About frequency')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    await waitFor(() => {
      expect(screen.queryByText('About frequency')).not.toBeInTheDocument()
    })
  })

  it('closes the frequency help dialog via the X button', async () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'About frequency' }))
    await waitFor(() => {
      expect(screen.getByText('About frequency')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => {
      expect(screen.queryByText('About frequency')).not.toBeInTheDocument()
    })
  })

  it('removes a word without confirmation when it has no sentence', () => {
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    expect(screen.queryByText('Remove this word?')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith({
      ...basePattern,
      words: ['bake'],
    })
  })

  it('saves the picked sentence on the pattern', async () => {
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Add example sentence for cake' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'We baked a cake.' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Use this sentence' }))
    expect(onChange).toHaveBeenCalledWith({
      ...basePattern,
      sentences: { cake: 'We baked a cake.' },
    })
  })

  it('keeps other sentences when removing a word with a sentence', () => {
    const { onChange } = renderEditor({
      sentences: { cake: 'We baked a cake.', bake: 'We bake bread.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove word' }))
    expect(onChange).toHaveBeenCalledWith({
      ...basePattern,
      words: ['bake'],
      sentences: { bake: 'We bake bread.' },
    })
  })

  it('clears a sentence through the picker', async () => {
    const { onChange } = renderEditor({
      sentences: { cake: 'We baked a cake.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit example sentence for cake' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenCalledWith({
      ...basePattern,
      sentences: undefined,
    })
  })

  it('shows the keyword image picker next to the pattern spelling input', () => {
    renderEditor()
    const trigger = screen.getByRole('button', { name: 'Keyword image for pattern a_e' })
    const spelling = screen.getByLabelText('Pattern spelling')
    // Same top section of the editor card.
    expect(trigger.closest('section')).toBe(spelling.closest('section'))
  })

  it('updates keywordEmoji when an emoji is picked', () => {
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern a_e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bee' }))
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, keywordEmoji: '🐝' })
  })

  it('clears keywordEmoji when the keyword emoji is removed', () => {
    const { onChange } = renderEditor({ keywordEmoji: '🐝' })
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern a_e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove emoji' }))
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, keywordEmoji: undefined })
  })

  it('updates keywordImage when a photo is uploaded', async () => {
    const { processKeywordImage } = await import('@/lib/profile-image')
    vi.mocked(processKeywordImage).mockResolvedValue('data:image/jpeg;base64,photo')
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern a_e' }))
    const file = new File(['x'], 'bee.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [file] } })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ ...basePattern, keywordImage: 'data:image/jpeg;base64,photo' })
    })
  })

  it('clears keywordImage when the photo is removed', () => {
    const { onChange } = renderEditor({ keywordImage: 'data:image/jpeg;base64,photo' })
    fireEvent.click(screen.getByRole('button', { name: 'Keyword image for pattern a_e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, keywordImage: undefined })
  })
})
