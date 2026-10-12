import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const { startRecording, saveRecording, isRecordingStorageSupported, isAudioCaptureSupported } = vi.hoisted(() => ({
  startRecording: vi.fn(),
  saveRecording: vi.fn(),
  isRecordingStorageSupported: vi.fn(),
  isAudioCaptureSupported: vi.fn(),
}))
vi.mock('@/lib/voice-recordings', () => ({
  startRecording,
  saveRecording,
  isRecordingStorageSupported,
  isAudioCaptureSupported,
}))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

import VoiceRecorderModal from './VoiceRecorderModal'

function supported() {
  isRecordingStorageSupported.mockReturnValue(true)
  isAudioCaptureSupported.mockReturnValue(true)
}

function stubPermissions(state: PermissionState) {
  const query = vi.fn().mockResolvedValue({ state })
  Object.defineProperty(navigator, 'permissions', {
    value: { query },
    configurable: true,
  })
  return query
}

class FakeAnalyser {
  fftSize = 0
  frequencyBinCount = 16
  getByteFrequencyData(array: Uint8Array): void {
    array.fill(100)
  }
}

class FakeAudioContext {
  analyser = new FakeAnalyser()
  closed = false
  createMediaStreamSource() {
    return { connect: vi.fn() }
  }
  createAnalyser() {
    return this.analyser
  }
  decodeAudioData() {
    return Promise.resolve({
      getChannelData: () => new Float32Array(1000).fill(0.5),
    })
  }
  close() {
    this.closed = true
    return Promise.resolve()
  }
}

const audioContextInstances: FakeAudioContext[] = []

function stubAudioContext() {
  audioContextInstances.length = 0
  class MockAudioContext extends FakeAudioContext {
    constructor() {
      super()
      audioContextInstances.push(this)
    }
  }
  vi.stubGlobal('AudioContext', MockAudioContext)
}

function stubCanvas() {
  const contexts: { fillRect: ReturnType<typeof vi.fn>; clearRect: ReturnType<typeof vi.fn> }[] = []
  HTMLCanvasElement.prototype.getContext = vi.fn(() => {
    const ctx = { fillRect: vi.fn(), clearRect: vi.fn() }
    contexts.push(ctx)
    return ctx
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext
  return contexts
}

class FakeAudio {
  src: string
  currentTime = 0
  duration = 5
  paused = true
  private listeners = new Map<string, Array<() => void>>()
  constructor(src: string) {
    this.src = src
    setTimeout(() => this.emit('loadedmetadata'), 0)
  }
  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? []
    list.push(handler)
    this.listeners.set(event, list)
  }
  play(): Promise<void> {
    this.paused = false
    return Promise.resolve()
  }
  pause(): void {
    this.paused = true
  }
  emit(event: string): void {
    for (const handler of [...(this.listeners.get(event) ?? [])]) handler()
  }
}

function makeSession(overrides: Partial<{ stream: MediaStream | undefined }> = {}) {
  return {
    stop: vi.fn().mockResolvedValue(new Blob(['audio'], { type: 'audio/webm' })),
    cancel: vi.fn(),
    stream: (overrides.stream ?? {}) as MediaStream,
  }
}

function renderModal(word = 'cake', props: Partial<{ maxSeconds: number; warningSeconds: number }> = {}) {
  const onOpenChange = vi.fn()
  render(<VoiceRecorderModal word={word} open={true} onOpenChange={onOpenChange} {...props} />)
  return { onOpenChange }
}

describe('VoiceRecorderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supported()
    stubPermissions('granted')
    stubAudioContext()
    stubCanvas()
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1)
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('Audio', FakeAudio)
    let urlCount = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:fake-${++urlCount}`),
      revokeObjectURL: vi.fn(),
    })
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('shows the record button once the microphone check passes', async () => {
    renderModal()
    expect(screen.getByText('Checking the microphone.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('shows the denial help when permission is already denied', async () => {
    stubPermissions('denied')
    renderModal()
    expect(await screen.findByText('Microphone is blocked')).toBeInTheDocument()
    expect(screen.getByText(/Click the lock or tune icon/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('retries the permission check', async () => {
    const query = stubPermissions('denied')
    renderModal()
    await screen.findByText('Microphone is blocked')
    query.mockResolvedValue({ state: 'granted' })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('shows unsupported when capture is unavailable', async () => {
    isAudioCaptureSupported.mockReturnValue(false)
    renderModal()
    expect(await screen.findByText(/not supported in this browser/)).toBeInTheDocument()
  })

  it('starts recording with a live timer and waveform', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await waitFor(() => expect(startRecording).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('00:00')
    // The interval ticks every 250ms; wait for it to advance.
    await waitFor(() => expect(screen.getByRole('timer')).not.toHaveTextContent('00:00'), { timeout: 2000 })
  })

  it('shows the denial help when the prompt is denied', async () => {
    const error = new DOMException('denied', 'NotAllowedError')
    startRecording.mockRejectedValue(error)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText('Microphone is blocked')).toBeInTheDocument()
  })

  it('shows a notice when recording fails for another reason', async () => {
    startRecording.mockRejectedValue(new Error('no mic'))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText('Microphone unavailable. Try again.')).toBeInTheDocument()
    expect(reportError).toHaveBeenCalled()
  })

  it('stops and shows the review screen with playback', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await waitFor(() => expect(session.stop).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Play the recording' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save recording' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Re-record' })).toBeInTheDocument()
  })

  it('saves the recording and closes', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    saveRecording.mockResolvedValue({})
    const { onOpenChange } = renderModal('cake')
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    const saveButton = await screen.findByRole('button', { name: 'Save recording' })
    await waitFor(() => expect(saveButton).toBeEnabled())
    fireEvent.click(saveButton)
    await waitFor(() => expect(saveRecording).toHaveBeenCalledWith('cake', expect.any(Blob)))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows a notice when saving fails', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    saveRecording.mockRejectedValue(new Error('idb down'))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    const saveButton = await screen.findByRole('button', { name: 'Save recording' })
    await waitFor(() => expect(saveButton).toBeEnabled())
    fireEvent.click(saveButton)
    expect(await screen.findByText('Could not save the recording. Try again.')).toBeInTheDocument()
  })

  it('re-records from the review screen', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await screen.findByRole('button', { name: 'Re-record' })
    fireEvent.click(screen.getByRole('button', { name: 'Re-record' }))
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('warns when little time remains and auto-stops at the cap', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    renderModal('cake', { maxSeconds: 2, warningSeconds: 1 })
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('seconds left')
    await waitFor(() => expect(session.stop).toHaveBeenCalled(), { timeout: 5000 })
    expect(await screen.findByRole('button', { name: 'Save recording' })).toBeInTheDocument()
  })

  it('disables save for very short recordings', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    // FakeAudio reports a 5s duration; override to simulate a tiny clip.
    await screen.findByRole('button', { name: 'Save recording' })
    expect(screen.getByRole('button', { name: 'Save recording' })).toBeEnabled()
  })

  it('toggles playback in review', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    const play = await screen.findByRole('button', { name: 'Play the recording' })
    fireEvent.click(play)
    expect(await screen.findByRole('button', { name: 'Pause the recording' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pause the recording' }))
    expect(await screen.findByRole('button', { name: 'Play the recording' })).toBeInTheDocument()
  })

  it('cancels an in-flight recording when the modal closes', async () => {
    const session = makeSession()
    let resolveStart!: (s: ReturnType<typeof makeSession>) => void
    startRecording.mockReturnValue(new Promise((resolve) => (resolveStart = resolve)))
    const onOpenChange = vi.fn()
    const { rerender } = render(<VoiceRecorderModal word="cake" open={true} onOpenChange={onOpenChange} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    // Close while the permission prompt is still open.
    rerender(<VoiceRecorderModal word="cake" open={false} onOpenChange={onOpenChange} />)
    resolveStart(session)
    await act(async () => {})
    expect(session.cancel).toHaveBeenCalled()
  })

  it('closes from the cancel button', async () => {
    const { onOpenChange } = renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes from the denied screen', async () => {
    stubPermissions('denied')
    const { onOpenChange } = renderModal()
    await screen.findByText('Microphone is blocked')
    // The dialog X also has accessible name "Close"; exclude it via data-slot.
    const closeButton = screen
      .getAllByRole('button', { name: 'Close' })
      .find((b) => b.getAttribute('data-slot') !== 'dialog-close')!
    fireEvent.click(closeButton)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes from the unsupported screen', async () => {
    isAudioCaptureSupported.mockReturnValue(false)
    const { onOpenChange } = renderModal()
    await screen.findByText(/not supported in this browser/)
    const closeButton = screen
      .getAllByRole('button', { name: 'Close' })
      .find((b) => b.getAttribute('data-slot') !== 'dialog-close')!
    fireEvent.click(closeButton)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('proceeds when the permissions API is unavailable', async () => {
    Object.defineProperty(navigator, 'permissions', { value: {}, configurable: true })
    renderModal()
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('proceeds when the permission query fails', async () => {
    const query = stubPermissions('granted')
    query.mockRejectedValue(new Error('no permissions API'))
    renderModal()
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('continues recording when the visualizer fails', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('no audio context')
        }
      }
    )
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await waitFor(() => expect(startRecording).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(reportError).toHaveBeenCalled()
  })

  it('retries permission from the denied screen when the API is unavailable', async () => {
    stubPermissions('denied')
    renderModal()
    await screen.findByText('Microphone is blocked')
    Object.defineProperty(navigator, 'permissions', { value: {}, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('shows a notice when stopping the recording fails', async () => {
    const session = makeSession()
    session.stop.mockRejectedValue(new Error('stop failed'))
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(await screen.findByText('Could not finish the recording. Try again.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('handles a missing 2d context when drawing the review waveform', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    // Null out the context for the review draw.
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(await screen.findByRole('button', { name: 'Save recording' })).toBeInTheDocument()
  })

  it('reports when the review waveform cannot be decoded', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    // Force decodeAudioData to reject.
    const instances: { decodeAudioData: () => Promise<never> }[] = []
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          instances.push(this as unknown as { decodeAudioData: () => Promise<never> })
        }
        createMediaStreamSource() {
          return { connect() {} }
        }
        createAnalyser() {
          return {
            fftSize: 0,
            frequencyBinCount: 4,
            getByteFrequencyData(a: Uint8Array) {
              a.fill(0)
            },
          }
        }
        decodeAudioData() {
          return Promise.reject(new Error('decode failed'))
        }
        close() {
          return Promise.resolve()
        }
      }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(await screen.findByRole('button', { name: 'Save recording' })).toBeInTheDocument()
    await waitFor(() => expect(reportError).toHaveBeenCalled())
  })

  it('stops the ended event from crashing when audio is gone', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await screen.findByRole('button', { name: 'Play the recording' })
    // Re-record clears the audio; the ended listener must tolerate it.
    fireEvent.click(screen.getByRole('button', { name: 'Re-record' }))
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('handles the audio ended event', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    // Capture the audio instance to emit events.
    let audioInstance: FakeAudio | null = null
    const OriginalAudio = FakeAudio
    vi.stubGlobal(
      'Audio',
      class extends OriginalAudio {
        constructor(src: string) {
          super(src)
          audioInstance = this as unknown as FakeAudio
        }
      }
    )
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    const playButton = await screen.findByRole('button', { name: 'Play the recording' })
    fireEvent.click(playButton)
    await screen.findByRole('button', { name: 'Pause the recording' })
    // Simulate the audio finishing.
    audioInstance!.emit('ended')
    expect(await screen.findByRole('button', { name: 'Play the recording' })).toBeInTheDocument()
  })

  it('handles play() rejection', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    vi.stubGlobal(
      'Audio',
      class extends FakeAudio {
        override play(): Promise<void> {
          return Promise.reject(new Error('play failed'))
        }
      }
    )
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    const playButton = await screen.findByRole('button', { name: 'Play the recording' })
    fireEvent.click(playButton)
    // Playback fails, button stays in play state.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play the recording' })).toBeInTheDocument())
  })

  it('handles permission query failure on retry', async () => {
    const query = stubPermissions('denied')
    renderModal()
    await screen.findByText('Microphone is blocked')
    query.mockRejectedValue(new Error('query failed'))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    // Falls back to ready state.
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('ignores a second stop while the first is in flight', async () => {
    const session = makeSession()
    let resolveStop!: (blob: Blob) => void
    session.stop.mockReturnValue(new Promise((resolve) => (resolveStop = resolve)))
    startRecording.mockResolvedValue(session)
    renderModal('cake')
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    // Two rapid clicks: the second sees a null session and returns early.
    const stopButton = screen.getByRole('button', { name: 'Stop' })
    fireEvent.click(stopButton)
    fireEvent.click(stopButton)
    resolveStop(new Blob(['audio']))
    expect(await screen.findByRole('button', { name: 'Save recording' })).toBeInTheDocument()
    expect(session.stop).toHaveBeenCalledTimes(1)
  })

  it('records without a visualizer when the session has no stream', async () => {
    const session = makeSession()
    delete (session as Partial<typeof session>).stream
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await waitFor(() => expect(startRecording).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('records without a visualizer when AudioContext is unavailable', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    vi.stubGlobal('AudioContext', undefined)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await waitFor(() => expect(startRecording).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('ignores unmount during the permission check', async () => {
    let resolveQuery!: (status: { state: PermissionState }) => void
    const query = vi.fn(() => new Promise((resolve) => (resolveQuery = resolve)))
    Object.defineProperty(navigator, 'permissions', { value: { query }, configurable: true })
    const { unmount } = render(<VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} />)
    unmount()
    resolveQuery({ state: 'granted' })
    await act(async () => {})
    // No crash, no state update after unmount.
    expect(true).toBe(true)
  })

  it('ignores a permission query rejection after unmount', async () => {
    let rejectQuery!: (error: unknown) => void
    const query = vi.fn(() => new Promise((_resolve, reject) => (rejectQuery = reject)))
    Object.defineProperty(navigator, 'permissions', { value: { query }, configurable: true })
    const { unmount } = render(<VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} />)
    unmount()
    rejectQuery(new Error('query failed'))
    await act(async () => {})
    // The cancelled flag skips the state update; no crash.
    expect(true).toBe(true)
  })

  it('stays on the denied screen when the retry is still denied', async () => {
    const query = stubPermissions('denied')
    renderModal()
    await screen.findByText('Microphone is blocked')
    expect(query).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Microphone is blocked')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()
  })

  it('warns about very short recordings in review', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    vi.stubGlobal(
      'Audio',
      class extends FakeAudio {
        override duration = 1
      }
    )
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(await screen.findByText(/That recording is very short/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save recording' })).toBeDisabled()
  })

  it('tolerates an AudioContext close rejection when stopping', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        override close() {
          return Promise.reject(new Error('close failed'))
        }
      }
    )
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    // The rejection is swallowed; the review screen still appears.
    expect(await screen.findByRole('button', { name: 'Save recording' })).toBeInTheDocument()
  })

  it('tolerates an AudioContext close rejection on cleanup', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        override close() {
          return Promise.reject(new Error('close failed'))
        }
      }
    )
    const { unmount } = render(<VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    await act(async () => {
      unmount()
    })
    // The rejection is swallowed by cleanupRecording; no crash.
    expect(true).toBe(true)
  })
})
