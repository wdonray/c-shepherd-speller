import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import PatternEditor from './PatternEditor'
import type { SpellingPattern } from '@/models/WordList'

vi.mock('./VoiceRecorderModal', () => ({
  default: ({
    word,
    open,
    onOpenChange,
    onSaved,
    onDeleted,
    microphoneRequest,
  }: {
    word: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved?: (word: string) => void
    onDeleted?: (word: string) => void
    microphoneRequest?: unknown
  }) =>
    open ? (
      <div data-testid="voice-recorder-modal" data-has-mic-request={microphoneRequest ? 'yes' : 'no'}>
        <span>{word}</span>
        <button onClick={() => onOpenChange(false)}>Close modal</button>
        <button onClick={() => onOpenChange(true)}>Reopen modal</button>
        <button
          onClick={() => {
            onSaved?.(word)
            onOpenChange(false)
          }}
        >
          Save recording
        </button>
        <button
          onClick={() => {
            onDeleted?.(word)
            onOpenChange(false)
          }}
        >
          Delete recording
        </button>
      </div>
    ) : null,
}))

const { requestMicrophoneAccess, isAudioCaptureSupported, isRecordingStorageSupported, hasRecording } = vi.hoisted(
  () => ({
    requestMicrophoneAccess: vi.fn(),
    isAudioCaptureSupported: vi.fn(),
    isRecordingStorageSupported: vi.fn(),
    hasRecording: vi.fn(),
  })
)
vi.mock('@/lib/voice-recordings', () => ({
  MICROPHONE_REQUEST_TIMEOUT_MS: 15000,
  requestMicrophoneAccess,
  isAudioCaptureSupported,
  isRecordingStorageSupported,
  hasRecording,
}))

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
  const { container } = render(<PatternEditor pattern={pattern} onChange={onChange} onRemove={onRemove} />)
  return { onChange, onRemove, pattern, container }
}

describe('PatternEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isAudioCaptureSupported.mockReturnValue(true)
    isRecordingStorageSupported.mockReturnValue(true)
    hasRecording.mockResolvedValue(false)
    requestMicrophoneAccess.mockReturnValue({
      promise: Promise.resolve({ getTracks: () => [] }),
      cancel: vi.fn(),
    })
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

  it('uses the passed color for the top bar', () => {
    const { container } = render(
      <PatternEditor pattern={basePattern} onChange={vi.fn()} onRemove={vi.fn()} color="sky" />
    )
    expect(container.querySelector('.bg-sky.h-2')).toBeInTheDocument()
    expect(container.querySelector('.bg-leaf.h-2')).not.toBeInTheDocument()
  })

  it('defaults the top bar to the default list color when no color is passed', () => {
    const { container } = renderEditor()
    expect(container.querySelector('.bg-leaf.h-2')).toBeInTheDocument()
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
    // Word-level toggles exist, but there is no pattern-level toggle.
    expect(screen.queryByRole('button', { name: 'Mark pattern as odd duck' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark cake as odd duck' })).toBeInTheDocument()
    // Existing data with the flag set must not crash or surface a pattern toggle.
    const { rerender } = render(
      <PatternEditor pattern={{ ...basePattern, isOddDuck: true }} onChange={vi.fn()} onRemove={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: 'Mark pattern as odd duck' })).not.toBeInTheDocument()
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

  it('shows the selected frequency label inside its radio option', () => {
    const onChange = vi.fn()
    const onRemove = vi.fn()
    const { rerender } = render(<PatternEditor pattern={basePattern} onChange={onChange} onRemove={onRemove} />)
    const common = screen.getByRole('radio', { name: /^Common\./ })
    expect(common).toHaveAttribute('aria-checked', 'true')
    expect(common).toHaveTextContent('Common')
    rerender(
      <PatternEditor pattern={{ ...basePattern, frequency: 'less-common' }} onChange={onChange} onRemove={onRemove} />
    )
    const lessCommon = screen.getByRole('radio', { name: /^Less common\./ })
    expect(lessCommon).toHaveAttribute('aria-checked', 'true')
    expect(lessCommon).toHaveTextContent('Less common')
    expect(screen.getByRole('radio', { name: /^Common\./ })).toHaveAttribute('aria-checked', 'false')
  })

  it('groups frequency, rule, and keyword image as uniform rows in the Details well', () => {
    const onSaveRule = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <PatternEditor pattern={basePattern} onChange={vi.fn()} onRemove={vi.fn()} onSaveRule={onSaveRule} />
    )
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
    // Frequency, rule, and keyword image all render as 56px settings rows.
    expect(container.querySelectorAll('.min-h-\\[56px\\]')).toHaveLength(3)
    expect(screen.getByRole('radiogroup', { name: 'Frequency' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add rule for a_e' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keyword image for pattern a_e' })).toBeInTheDocument()
  })

  it('saves a rule through the details row', async () => {
    const onSaveRule = vi.fn().mockResolvedValue(undefined)
    render(<PatternEditor pattern={basePattern} onChange={vi.fn()} onRemove={vi.fn()} onSaveRule={onSaveRule} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add rule for a_e' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Rule for a_e' })).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('Rule, in the kids’ words'), {
      target: { value: 'ai never ends a word.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => {
      expect(onSaveRule).toHaveBeenCalledWith('p1', 'a_e', 'ai never ends a word.')
    })
  })

  it('gives frequency radios a uniform segmented style in both states', () => {
    renderEditor()
    const selected = screen.getByRole('radio', { name: /^Common\./ })
    expect(selected).toHaveClass('bg-sky-soft', 'text-sky-ink', 'min-h-[44px]', 'focus-visible:ring-[3px]')
    const unselected = screen.getByRole('radio', { name: /^Rare\./ })
    expect(unselected).toHaveClass(
      'text-muted-foreground',
      'hover:text-ink',
      'min-h-[44px]',
      'focus-visible:ring-[3px]'
    )
    expect(unselected).not.toHaveClass('bg-sky-soft')
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

  it('adds a word directly when it matches a contiguous pattern', () => {
    const { onChange } = renderEditor({ pattern: 'ee', words: [] })
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'meet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.queryByText('Check this word')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, pattern: 'ee', words: ['meet'] })
  })

  it('warns when the added word does not match the pattern', () => {
    const { onChange } = renderEditor({ pattern: 'ee', words: [] })
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'bed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Check this word')).toBeInTheDocument()
    expect(screen.getByText(/does not look like it contains the/)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('warns for a word missing one half of a split pattern', () => {
    const { onChange } = renderEditor({ words: [] })
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'cat' } })
    fireEvent.keyDown(screen.getByLabelText('New word'), { key: 'Enter' })
    expect(screen.getByText('Check this word')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('saves the word anyway from the mismatch warning', () => {
    const { onChange } = renderEditor({ pattern: 'ee', words: [] })
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'bed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }))
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, pattern: 'ee', words: ['bed'] })
    expect(screen.getByLabelText('New word')).toHaveValue('')
    expect(screen.queryByText('Check this word')).not.toBeInTheDocument()
  })

  it('keeps the word for editing when the mismatch warning is dismissed', () => {
    const { onChange } = renderEditor({ pattern: 'ee', words: [] })
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'bed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByText('Check this word')).not.toBeInTheDocument()
    expect(screen.getByLabelText('New word')).toHaveValue('bed')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('dismisses the mismatch warning on Escape, keeping the word for editing', () => {
    const { onChange } = renderEditor({ pattern: 'ee', words: [] })
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'bed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Check this word')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Check this word')).not.toBeInTheDocument()
    expect(screen.getByLabelText('New word')).toHaveValue('bed')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not warn when the pattern is empty', () => {
    const { onChange } = renderEditor({ pattern: '', words: [] })
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'bed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.queryByText('Check this word')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, pattern: '', words: ['bed'] })
  })

  it('removes a word through its chip button', () => {
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, words: ['bake'] })
  })

  it('marks a word as an odd duck', () => {
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Mark cake as odd duck' }))
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, oddDucks: ['cake'] })
  })

  it('unmarks an odd duck word', () => {
    const { onChange } = renderEditor({ oddDucks: ['cake'] })
    const button = screen.getByRole('button', { name: 'Unmark cake as odd duck' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(button)
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, oddDucks: undefined })
  })

  it('removing a word also removes its odd duck marking', () => {
    const { onChange } = renderEditor({ oddDucks: ['cake'] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    expect(onChange).toHaveBeenCalledWith({ ...basePattern, words: ['bake'], oddDucks: undefined })
  })

  it('removing a word keeps the remaining odd duck markings', () => {
    const { onChange } = renderEditor({ words: ['cake', 'bake', 'late'], oddDucks: ['cake', 'bake'] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove cake' }))
    expect(onChange).toHaveBeenCalledWith({
      ...basePattern,
      words: ['bake', 'late'],
      oddDucks: ['bake'],
    })
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

  it('shows the keyword image picker in the details well', () => {
    renderEditor()
    const trigger = screen.getByRole('button', { name: 'Keyword image for pattern a_e' })
    const spelling = screen.getByLabelText('Pattern spelling')
    // Same editor card, but demoted out of the header into the Details group.
    expect(trigger.closest('section')).toBe(spelling.closest('section'))
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
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

  it('opens the voice recorder modal for a word', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Record your voice for cake' }))
    expect(screen.getByTestId('voice-recorder-modal')).toBeInTheDocument()
    expect(screen.getByTestId('voice-recorder-modal')).toHaveTextContent('cake')
  })

  it('requests microphone access from the mic button tap and hands it to the modal', () => {
    const cancel = vi.fn()
    const promise = Promise.resolve({ getTracks: () => [] })
    const request = { promise, cancel }
    requestMicrophoneAccess.mockReturnValue(request)
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Record your voice for cake' }))
    // Asked from the click gesture, which is what browsers require to show
    // the permission prompt.
    expect(requestMicrophoneAccess).toHaveBeenCalledWith(15000)
    expect(screen.getByTestId('voice-recorder-modal')).toHaveAttribute('data-has-mic-request', 'yes')
  })

  it('cancels the in-flight microphone request when the modal closes', () => {
    const cancel = vi.fn()
    requestMicrophoneAccess.mockReturnValue({ promise: new Promise(() => {}), cancel })
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Record your voice for cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))
    expect(cancel).toHaveBeenCalled()
  })

  it('opens the modal without a microphone request when capture is unsupported', () => {
    isAudioCaptureSupported.mockReturnValue(false)
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Record your voice for cake' }))
    expect(requestMicrophoneAccess).not.toHaveBeenCalled()
    expect(screen.getByTestId('voice-recorder-modal')).toHaveAttribute('data-has-mic-request', 'no')
  })

  it('marks the mic button for words that already have a recording', async () => {
    hasRecording.mockImplementation(async (text: string) => text === 'cake')
    renderEditor()
    const button = await screen.findByRole('button', { name: 'Re-record your voice for cake' })
    expect(button).toHaveClass('bg-sky-soft', 'text-sky-ink')
    // The unrecorded word keeps the plain mic button.
    expect(screen.getByRole('button', { name: 'Record your voice for bake' })).toBeInTheDocument()
  })

  it('marks the mic button after the modal saves a recording', async () => {
    renderEditor()
    fireEvent.click(await screen.findByRole('button', { name: 'Record your voice for cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save recording' }))
    expect(await screen.findByRole('button', { name: 'Re-record your voice for cake' })).toBeInTheDocument()
  })

  it('leaves the mic buttons unmarked when reading recording presence fails', async () => {
    hasRecording.mockRejectedValue(new Error('db down'))
    renderEditor()
    // The rejected reads resolve to "no recording" instead of crashing.
    expect(await screen.findByRole('button', { name: 'Record your voice for cake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record your voice for bake' })).toBeInTheDocument()
  })

  it('leaves the mic buttons unmarked when recording storage is unsupported', async () => {
    isRecordingStorageSupported.mockReturnValue(false)
    renderEditor()
    expect(await screen.findByRole('button', { name: 'Record your voice for cake' })).toBeInTheDocument()
    expect(hasRecording).not.toHaveBeenCalled()
  })

  it('still marks saved recordings when microphone capture is unsupported', async () => {
    isAudioCaptureSupported.mockReturnValue(false)
    hasRecording.mockImplementation(async (text: string) => text === 'cake')
    renderEditor()
    // The presence lookup only needs storage; a teacher on a device without
    // a mic can still see which words already have recordings.
    expect(await screen.findByRole('button', { name: 'Re-record your voice for cake' })).toBeInTheDocument()
    expect(hasRecording).toHaveBeenCalled()
  })

  it('keeps a recording saved while the presence lookup is still pending', async () => {
    let resolveCake!: (has: boolean) => void
    hasRecording.mockImplementation((text: string) =>
      text === 'cake' ? new Promise<boolean>((resolve) => (resolveCake = resolve)) : Promise.resolve(false)
    )
    renderEditor()
    // Save cake while its presence read is still in flight.
    fireEvent.click(await screen.findByRole('button', { name: 'Record your voice for cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save recording' }))
    expect(await screen.findByRole('button', { name: 'Re-record your voice for cake' })).toBeInTheDocument()
    // The slow lookup resolves "no recording" for cake; the save must survive it.
    resolveCake(false)
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Re-record your voice for cake' })).toBeInTheDocument()
  })

  it('unmarks the mic button after the modal deletes a recording', async () => {
    hasRecording.mockImplementation(async (text: string) => text === 'cake')
    renderEditor()
    expect(await screen.findByRole('button', { name: 'Re-record your voice for cake' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Re-record your voice for cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete recording' }))
    expect(await screen.findByRole('button', { name: 'Record your voice for cake' })).toBeInTheDocument()
  })

  it('does not re-add a recording deleted while the presence lookup is still pending', async () => {
    let resolveCake!: (has: boolean) => void
    hasRecording.mockImplementation((text: string) =>
      text === 'cake' ? new Promise<boolean>((resolve) => (resolveCake = resolve)) : Promise.resolve(false)
    )
    renderEditor()
    // Delete cake while its presence read is still in flight.
    fireEvent.click(await screen.findByRole('button', { name: 'Record your voice for cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete recording' }))
    expect(await screen.findByRole('button', { name: 'Record your voice for cake' })).toBeInTheDocument()
    // The slow lookup resolves "has recording" for cake; the delete must survive it.
    resolveCake(true)
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Record your voice for cake' })).toBeInTheDocument()
  })

  it('ignores a late recording-presence read after unmount', async () => {
    let resolveRead!: (has: boolean) => void
    hasRecording.mockReturnValue(new Promise((resolve) => (resolveRead = resolve)))
    const { unmount } = render(<PatternEditor pattern={basePattern} onChange={vi.fn()} onRemove={vi.fn()} />)
    unmount()
    resolveRead(true)
    await act(async () => {})
    // No crash, no state update after unmount.
    expect(hasRecording).toHaveBeenCalled()
  })

  it('keeps a rejected microphone request from surfacing as unhandled', async () => {
    const cancel = vi.fn()
    requestMicrophoneAccess.mockReturnValue({
      promise: Promise.reject(new DOMException('denied', 'NotAllowedError')),
      cancel,
    })
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Record your voice for cake' }))
    expect(screen.getByTestId('voice-recorder-modal')).toBeInTheDocument()
    // Let the rejection settle; the noop catch in handleMicClick absorbs it.
    await act(async () => {})
    expect(cancel).not.toHaveBeenCalled()
  })

  it('closes the voice recorder modal', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Record your voice for cake' }))
    expect(screen.getByTestId('voice-recorder-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))
    expect(screen.queryByTestId('voice-recorder-modal')).not.toBeInTheDocument()
  })

  it('keeps the voice recorder modal open when onOpenChange fires with true', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Record your voice for cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reopen modal' }))
    expect(screen.getByTestId('voice-recorder-modal')).toBeInTheDocument()
  })
})
