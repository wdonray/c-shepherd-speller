import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PatternEditor from './PatternEditor'
import type { SpellingPattern } from '@/models/WordList'

vi.mock('./VoiceRecorderModal', () => ({
  default: ({
    word,
    open,
    onOpenChange,
    microphoneRequest,
  }: {
    word: string
    open: boolean
    onOpenChange: (open: boolean) => void
    microphoneRequest?: unknown
  }) =>
    open ? (
      <div data-testid="voice-recorder-modal" data-has-mic-request={microphoneRequest ? 'yes' : 'no'}>
        <span>{word}</span>
        <button onClick={() => onOpenChange(false)}>Close modal</button>
        <button onClick={() => onOpenChange(true)}>Reopen modal</button>
      </div>
    ) : null,
}))

const { requestMicrophoneAccess, isAudioCaptureSupported } = vi.hoisted(() => ({
  requestMicrophoneAccess: vi.fn(),
  isAudioCaptureSupported: vi.fn(),
}))
vi.mock('@/lib/voice-recordings', () => ({
  MICROPHONE_REQUEST_TIMEOUT_MS: 15000,
  requestMicrophoneAccess,
  isAudioCaptureSupported,
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

// Force the mobile layout: match the max-width query, nothing else.
const originalMatchMedia = window.matchMedia
function mockMobileViewport() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

const basePattern: SpellingPattern = {
  id: 'p1',
  sound: 'long a',
  pattern: 'a_e',
  frequency: 'common',
  words: ['cake', 'bake'],
  sentences: { cake: 'We baked a cake.' },
}

function renderEditor(overrides: Partial<SpellingPattern> = {}) {
  const onChange = vi.fn()
  const onRemove = vi.fn()
  const pattern = { ...basePattern, ...overrides }
  render(<PatternEditor pattern={pattern} onChange={onChange} onRemove={onRemove} />)
  return { onChange, onRemove, pattern }
}

describe('PatternEditor mobile words cards', () => {
  beforeEach(() => {
    mockMobileViewport()
    vi.clearAllMocks()
    isAudioCaptureSupported.mockReturnValue(true)
    requestMicrophoneAccess.mockReturnValue({
      promise: Promise.resolve({ getTracks: () => [] }),
      cancel: vi.fn(),
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    })
  })

  it('renders stacked cards instead of the words table', () => {
    renderEditor()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'cake' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'bake' })).toBeInTheDocument()
  })

  it('shows the example sentence under a labeled field', () => {
    renderEditor()
    expect(screen.getAllByText('Example sentence')).toHaveLength(2)
    expect(screen.getByText('We baked a cake.')).toBeInTheDocument()
  })

  it('marks words without a sentence as having none', () => {
    renderEditor()
    expect(screen.getAllByText('No example sentence')).toHaveLength(1)
  })

  it('keeps the word actions working on mobile', () => {
    const { onChange } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Mark cake as odd duck' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ oddDucks: ['cake'] }))
    expect(screen.getByRole('button', { name: 'Add example sentence for bake' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove bake' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ words: ['cake'] }))
  })
})
