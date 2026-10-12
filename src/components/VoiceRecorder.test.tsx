import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const {
  hasRecording,
  getRecording,
  saveRecording,
  deleteRecording,
  startRecording,
  isRecordingStorageSupported,
  isAudioCaptureSupported,
  recordingToBlob,
} = vi.hoisted(() => ({
  hasRecording: vi.fn(),
  getRecording: vi.fn(),
  saveRecording: vi.fn(),
  deleteRecording: vi.fn(),
  startRecording: vi.fn(),
  isRecordingStorageSupported: vi.fn(),
  isAudioCaptureSupported: vi.fn(),
  recordingToBlob: vi.fn((recording: unknown) => recording),
}))
vi.mock('@/lib/voice-recordings', () => ({
  hasRecording,
  getRecording,
  saveRecording,
  deleteRecording,
  startRecording,
  isRecordingStorageSupported,
  isAudioCaptureSupported,
  recordingToBlob,
}))

const { FakeNeuralTtsError, playAudioBlob } = vi.hoisted(() => {
  class FakeNeuralTtsError extends Error {
    code: string
    constructor(code: string, message: string = code) {
      super(message)
      this.name = 'NeuralTtsError'
      this.code = code
    }
  }
  return { FakeNeuralTtsError, playAudioBlob: vi.fn() }
})
vi.mock('@/lib/neural-tts', () => ({ NeuralTtsError: FakeNeuralTtsError, playAudioBlob }))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

import VoiceRecorder from './VoiceRecorder'

function supported() {
  isRecordingStorageSupported.mockReturnValue(true)
  isAudioCaptureSupported.mockReturnValue(true)
}

function makeSession() {
  return {
    stop: vi.fn(async () => new Blob(['audio'])),
    cancel: vi.fn(),
  }
}

/** playAudioBlob mock that rejects with "aborted" when its signal fires. */
function abortablePlayback() {
  playAudioBlob.mockImplementation(
    (_blob: unknown, signal: AbortSignal) =>
      new Promise<void>((_resolve, reject) => {
        if (signal.aborted) reject(new FakeNeuralTtsError('aborted'))
        else signal.addEventListener('abort', () => reject(new FakeNeuralTtsError('aborted')))
      })
  )
}

describe('VoiceRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supported()
    hasRecording.mockResolvedValue(false)
    getRecording.mockResolvedValue(null)
    reportError.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when recording is unsupported', () => {
    isRecordingStorageSupported.mockReturnValue(false)
    const { container } = render(<VoiceRecorder text="cake" kind="word" />)
    expect(container).toBeEmptyDOMElement()
    expect(hasRecording).not.toHaveBeenCalled()
  })

  it('shows the record button when no recording exists', async () => {
    render(<VoiceRecorder text="cake" kind="word" />)
    expect(screen.getByText('Checking for your recording.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Record your voice for this word' })).toBeInTheDocument()
    expect(hasRecording).toHaveBeenCalledWith('cake')
  })

  it('labels the recorder for a sentence', async () => {
    render(<VoiceRecorder text="We baked a cake." kind="sentence" />)
    expect(screen.getByText('Your voice for this sentence')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Record your voice for this sentence' })).toBeInTheDocument()
  })

  it('shows play and delete when a recording exists', async () => {
    hasRecording.mockResolvedValue(true)
    render(<VoiceRecorder text="cake" kind="word" />)
    expect(await screen.findByRole('button', { name: 'Play your recording for this word' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete your recording for this word' })).toBeInTheDocument()
  })

  it('records and saves', async () => {
    let resolveStop!: (blob: Blob) => void
    const audio = new Blob(['audio'])
    const session = {
      stop: vi.fn(
        () =>
          new Promise<Blob>((resolve) => {
            resolveStop = resolve
          })
      ),
      cancel: vi.fn(),
    }
    startRecording.mockResolvedValue(session)
    saveRecording.mockResolvedValue({ text: 'cake' })
    render(<VoiceRecorder text="cake" kind="word" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Record your voice for this word' }))
    expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeInTheDocument()
    expect(screen.getByText('Recording. Speak now, then tap stop.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }))
    expect(screen.getByText('Saving your recording.')).toBeInTheDocument()

    await act(async () => {
      resolveStop(audio)
    })
    expect(await screen.findByRole('button', { name: 'Play your recording for this word' })).toBeInTheDocument()
    expect(saveRecording).toHaveBeenCalledWith('cake', audio)
  })

  it('shows a notice when the microphone is unavailable', async () => {
    startRecording.mockRejectedValue(new Error('denied'))
    render(<VoiceRecorder text="cake" kind="word" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Record your voice for this word' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone unavailable')
    expect(screen.getByRole('button', { name: 'Record your voice for this word' })).toBeInTheDocument()
    expect(reportError).toHaveBeenCalled()
  })

  it('ignores a second start while the first is still pending', async () => {
    let resolveStart!: (session: ReturnType<typeof makeSession>) => void
    startRecording.mockImplementation(
      () =>
        new Promise<ReturnType<typeof makeSession>>((resolve) => {
          resolveStart = resolve
        })
    )
    render(<VoiceRecorder text="cake" kind="word" />)

    const recordButton = await screen.findByRole('button', { name: 'Record your voice for this word' })
    fireEvent.click(recordButton)
    fireEvent.click(recordButton)
    expect(startRecording).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveStart(makeSession())
    })
    expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeInTheDocument()
  })

  it('shows a notice when saving fails', async () => {
    const session = makeSession()
    session.stop.mockRejectedValue(new Error('nope'))
    startRecording.mockResolvedValue(session)
    render(<VoiceRecorder text="cake" kind="word" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Record your voice for this word' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the recording.')
    expect(reportError).toHaveBeenCalled()
  })

  it('plays the recording', async () => {
    const recording = { text: 'cake' }
    hasRecording.mockResolvedValue(true)
    getRecording.mockResolvedValue(recording)
    let resolvePlay!: () => void
    playAudioBlob.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePlay = resolve
        })
    )
    render(<VoiceRecorder text="cake" kind="word" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play your recording for this word' }))
    expect(screen.getByText('Playing your recording.')).toBeInTheDocument()
    await vi.waitFor(() => expect(playAudioBlob).toHaveBeenCalledWith(recording, expect.any(AbortSignal)))
    expect(recordingToBlob).toHaveBeenCalledWith(recording)

    await act(async () => {
      resolvePlay()
    })
    expect(await screen.findByRole('button', { name: 'Play your recording for this word' })).toBeInTheDocument()
  })

  it('returns to idle when the recording vanished before playing', async () => {
    hasRecording.mockResolvedValue(true)
    getRecording.mockResolvedValue(null)
    render(<VoiceRecorder text="cake" kind="word" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play your recording for this word' }))
    expect(await screen.findByRole('button', { name: 'Record your voice for this word' })).toBeInTheDocument()
  })

  it('shows a notice when playback fails', async () => {
    hasRecording.mockResolvedValue(true)
    getRecording.mockResolvedValue({ text: 'cake' })
    playAudioBlob.mockRejectedValue(new FakeNeuralTtsError('playback'))
    render(<VoiceRecorder text="cake" kind="word" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play your recording for this word' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not play the recording.')
    expect(screen.getByRole('button', { name: 'Play your recording for this word' })).toBeInTheDocument()
    expect(reportError).toHaveBeenCalled()
  })

  it('stops playback without a notice', async () => {
    hasRecording.mockResolvedValue(true)
    getRecording.mockResolvedValue({ text: 'cake' })
    abortablePlayback()
    render(<VoiceRecorder text="cake" kind="word" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play your recording for this word' }))
    await screen.findByText('Playing your recording.')
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))

    expect(await screen.findByRole('button', { name: 'Play your recording for this word' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('deletes the recording', async () => {
    hasRecording.mockResolvedValue(true)
    render(<VoiceRecorder text="cake" kind="word" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete your recording for this word' }))
    expect(await screen.findByRole('button', { name: 'Record your voice for this word' })).toBeInTheDocument()
    expect(deleteRecording).toHaveBeenCalledWith('cake')
  })

  it('shows a notice when deletion fails', async () => {
    hasRecording.mockResolvedValue(true)
    deleteRecording.mockRejectedValue(new Error('nope'))
    render(<VoiceRecorder text="cake" kind="word" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete your recording for this word' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the recording.')
    expect(reportError).toHaveBeenCalled()
  })

  it('rechecks when the text changes', async () => {
    const { rerender } = render(<VoiceRecorder text="cake" kind="word" />)
    await screen.findByRole('button', { name: 'Record your voice for this word' })
    rerender(<VoiceRecorder text="bake" kind="word" />)
    await screen.findByRole('button', { name: 'Record your voice for this word' })
    expect(hasRecording).toHaveBeenCalledWith('cake')
    expect(hasRecording).toHaveBeenCalledWith('bake')
  })

  it('shows the record button when the initial check fails', async () => {
    hasRecording.mockRejectedValue(new Error('indexeddb down'))
    render(<VoiceRecorder text="cake" kind="word" />)
    expect(await screen.findByRole('button', { name: 'Record your voice for this word' })).toBeInTheDocument()
  })

  it('ignores a late check result after unmount', async () => {
    let resolveCheck!: (exists: boolean) => void
    hasRecording.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveCheck = resolve
        })
    )
    const { unmount } = render(<VoiceRecorder text="cake" kind="word" />)
    unmount()
    await act(async () => {
      resolveCheck(true)
    })
    // No crash, no state update after unmount.
  })

  it('ignores a late check failure after unmount', async () => {
    let rejectCheck!: (error: Error) => void
    hasRecording.mockImplementation(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectCheck = reject
        })
    )
    const { unmount } = render(<VoiceRecorder text="cake" kind="word" />)
    unmount()
    await act(async () => {
      rejectCheck(new Error('indexeddb down'))
    })
    // No crash, no state update after unmount.
  })

  it('cancels a recording that resolves after unmount instead of attaching it', async () => {
    let resolveStart!: (session: { stop: () => Promise<Blob>; cancel: () => void }) => void
    const session = makeSession()
    startRecording.mockImplementation(
      () =>
        new Promise<{ stop: () => Promise<Blob>; cancel: () => void }>((resolve) => {
          resolveStart = resolve
        })
    )
    const { unmount } = render(<VoiceRecorder text="cake" kind="word" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record your voice for this word' }))
    unmount()
    await act(async () => {
      resolveStart(session)
    })
    expect(session.cancel).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Stop recording' })).not.toBeInTheDocument()
  })

  it('cancels an in-flight recording on unmount', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    const { unmount } = render(<VoiceRecorder text="cake" kind="word" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record your voice for this word' }))
    await screen.findByRole('button', { name: 'Stop recording' })
    unmount()
    expect(session.cancel).toHaveBeenCalled()
  })

  it('aborts in-flight playback on unmount', async () => {
    hasRecording.mockResolvedValue(true)
    getRecording.mockResolvedValue({ text: 'cake' })
    abortablePlayback()
    const { unmount } = render(<VoiceRecorder text="cake" kind="word" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Play your recording for this word' }))
    await screen.findByText('Playing your recording.')
    unmount()
    // The abort rejects playback; the settled component must not crash.
    await act(async () => {})
  })
})
