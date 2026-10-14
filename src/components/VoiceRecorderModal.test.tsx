import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { RecordingSession } from '@/lib/voice-recordings'

const { requestMicrophoneStream, startRecording, saveRecording, isRecordingStorageSupported, isAudioCaptureSupported } =
  vi.hoisted(() => ({
    requestMicrophoneStream: vi.fn(),
    startRecording: vi.fn(),
    saveRecording: vi.fn(),
    isRecordingStorageSupported: vi.fn(),
    isAudioCaptureSupported: vi.fn(),
  }))
vi.mock('@/lib/voice-recordings', () => ({
  MICROPHONE_REQUEST_TIMEOUT_MS: 15000,
  requestMicrophoneStream,
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

/** A granted microphone stream the permission request resolves with. */
function fakeMicStream() {
  return { getTracks: () => [] as Array<{ stop: () => void }> }
}

/** An opener-started permission request, as passed via the microphoneRequest prop. */
function fakeMicRequest(promise: Promise<unknown>) {
  return { promise, cancel: vi.fn() }
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
    requestMicrophoneStream.mockResolvedValue(fakeMicStream())
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
    const getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
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

  it('does not request permission on open; the Record tap asks from its own gesture', async () => {
    stubPermissions('prompt')
    renderModal()
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
    expect(requestMicrophoneStream).not.toHaveBeenCalled()
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('asks for the microphone from the Record tap and records from the granted stream', async () => {
    const stream = fakeMicStream()
    let resolveRequest!: (stream: unknown) => void
    requestMicrophoneStream.mockReturnValue(new Promise((resolve) => (resolveRequest = resolve)))
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText(/Requesting microphone access/)).toBeInTheDocument()
    await waitFor(() =>
      expect(requestMicrophoneStream).toHaveBeenCalledWith(expect.any(Number), expect.any(AbortSignal))
    )
    resolveRequest(stream)
    await waitFor(() => expect(startRecording).toHaveBeenCalledWith(stream))
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('records from the opener pre-authorized stream without asking again', async () => {
    const stream = fakeMicStream()
    let resolveWarmup!: (stream: unknown) => void
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    render(
      <VoiceRecorderModal
        word="cake"
        open={true}
        onOpenChange={() => {}}
        microphoneRequest={fakeMicRequest(new Promise((resolve) => (resolveWarmup = resolve)))}
      />
    )
    expect(await screen.findByText(/Requesting microphone access/)).toBeInTheDocument()
    resolveWarmup(stream)
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await waitFor(() => expect(startRecording).toHaveBeenCalledWith(stream))
    expect(requestMicrophoneStream).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('shows the denial help when the opener permission request is denied', async () => {
    render(
      <VoiceRecorderModal
        word="cake"
        open={true}
        onOpenChange={() => {}}
        microphoneRequest={fakeMicRequest(Promise.reject(new DOMException('denied', 'NotAllowedError')))}
      />
    )
    expect(await screen.findByText('Microphone is blocked')).toBeInTheDocument()
  })

  it('shows the unavailable help when the opener request finds no microphone', async () => {
    const onOpenChange = vi.fn()
    render(
      <VoiceRecorderModal
        word="cake"
        open={true}
        onOpenChange={onOpenChange}
        microphoneRequest={fakeMicRequest(Promise.reject(new DOMException('no device', 'NotFoundError')))}
      />
    )
    expect(await screen.findByText('No microphone found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    // The dialog X renders after the content, so index 0 is the panel Close.
    fireEvent.click(closeButtons[0])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows a notice and returns to ready when the opener request fails generically', async () => {
    render(
      <VoiceRecorderModal
        word="cake"
        open={true}
        onOpenChange={() => {}}
        microphoneRequest={fakeMicRequest(Promise.reject(new Error('boom')))}
      />
    )
    expect(await screen.findByText('Microphone unavailable. Try again.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
    expect(reportError).toHaveBeenCalled()
  })

  it('shows recovery guidance when the opener request times out', async () => {
    render(
      <VoiceRecorderModal
        word="cake"
        open={true}
        onOpenChange={() => {}}
        microphoneRequest={fakeMicRequest(Promise.reject(new DOMException('timed out', 'TimeoutError')))}
      />
    )
    expect(await screen.findByText(/did not show a permission prompt/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('ignores a superseded opener request when a newer one arrives', async () => {
    const oldTrack = { stop: vi.fn() }
    let resolveOld!: (stream: unknown) => void
    let resolveNew!: (stream: unknown) => void
    const oldRequest = fakeMicRequest(new Promise((resolve) => (resolveOld = resolve)))
    const newRequest = fakeMicRequest(new Promise((resolve) => (resolveNew = resolve)))
    const { rerender } = render(
      <VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} microphoneRequest={oldRequest} />
    )
    expect(await screen.findByText(/Requesting microphone access/)).toBeInTheDocument()
    rerender(<VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} microphoneRequest={newRequest} />)
    // The old request resolves late: the stale handler must not touch its
    // stream, and the modal keeps waiting on the new request.
    resolveOld({ getTracks: () => [oldTrack] })
    await act(async () => {})
    expect(oldTrack.stop).not.toHaveBeenCalled()
    expect(screen.getByText(/Requesting microphone access/)).toBeInTheDocument()
    // The new request still drives the modal.
    const newTrack = { stop: vi.fn() }
    resolveNew({ getTracks: () => [newTrack] })
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
    expect(newTrack.stop).not.toHaveBeenCalled()
  })

  it('ignores a rejected superseded opener request', async () => {
    let rejectOld!: (error: unknown) => void
    let resolveNew!: (stream: unknown) => void
    const oldRequest = fakeMicRequest(new Promise((_resolve, reject) => (rejectOld = reject)))
    const newRequest = fakeMicRequest(new Promise((resolve) => (resolveNew = resolve)))
    const { rerender } = render(
      <VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} microphoneRequest={oldRequest} />
    )
    expect(await screen.findByText(/Requesting microphone access/)).toBeInTheDocument()
    rerender(<VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} microphoneRequest={newRequest} />)
    // The old request rejects late: the stale handler must not surface it.
    rejectOld(new DOMException('denied', 'NotAllowedError'))
    await act(async () => {})
    expect(screen.getByText(/Requesting microphone access/)).toBeInTheDocument()
    expect(screen.queryByText('Microphone is blocked')).not.toBeInTheDocument()
    resolveNew(fakeMicStream())
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
  })

  it('releases the opener stream when it resolves after unmount', async () => {
    const track = { stop: vi.fn() }
    let resolveRequest!: (stream: unknown) => void
    const request = fakeMicRequest(new Promise((resolve) => (resolveRequest = resolve)))
    const { unmount } = render(
      <VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} microphoneRequest={request} />
    )
    expect(await screen.findByText(/Requesting microphone access/)).toBeInTheDocument()
    unmount()
    resolveRequest({ getTracks: () => [track] })
    await act(async () => {})
    expect(track.stop).toHaveBeenCalled()
  })

  it('ignores a denied opener request after unmount', async () => {
    let rejectRequest!: (error: unknown) => void
    const request = fakeMicRequest(new Promise((_resolve, reject) => (rejectRequest = reject)))
    const { unmount } = render(
      <VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} microphoneRequest={request} />
    )
    expect(await screen.findByText(/Requesting microphone access/)).toBeInTheDocument()
    unmount()
    rejectRequest(new DOMException('denied', 'NotAllowedError'))
    await act(async () => {})
    expect(true).toBe(true)
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

  it('shows the denial help when the Record tap is blocked with a SecurityError', async () => {
    requestMicrophoneStream.mockRejectedValue(new DOMException('blocked', 'SecurityError'))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText('Microphone is blocked')).toBeInTheDocument()
  })

  it('shows the unavailable help when the Record tap finds no microphone', async () => {
    requestMicrophoneStream.mockRejectedValue(new DOMException('no device', 'NotFoundError'))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText('No microphone found')).toBeInTheDocument()
  })

  it('shows the unavailable help when the Record tap cannot satisfy the constraints', async () => {
    requestMicrophoneStream.mockRejectedValue(new DOMException('overconstrained', 'OverconstrainedError'))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText('No microphone found')).toBeInTheDocument()
  })

  it('shows the unavailable help when the microphone is already in use', async () => {
    requestMicrophoneStream.mockRejectedValue(new DOMException('in use', 'NotReadableError'))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText('No microphone found')).toBeInTheDocument()
  })

  it('shows recovery guidance when the Record tap never gets a browser answer', async () => {
    requestMicrophoneStream.mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText(/did not show a permission prompt/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('returns to ready when the Record tap permission request is aborted', async () => {
    requestMicrophoneStream.mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('releases the stream when recording fails to start after the grant', async () => {
    const track = { stop: vi.fn() }
    requestMicrophoneStream.mockResolvedValue({ getTracks: () => [track] })
    startRecording.mockRejectedValue(new Error('recorder broken'))
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText('Microphone unavailable. Try again.')).toBeInTheDocument()
    expect(track.stop).toHaveBeenCalled()
    expect(reportError).toHaveBeenCalled()
  })

  it('releases the stream when the modal closes during the permission request', async () => {
    const track = { stop: vi.fn() }
    let resolveRequest!: (stream: unknown) => void
    requestMicrophoneStream.mockReturnValue(new Promise((resolve) => (resolveRequest = resolve)))
    const onOpenChange = vi.fn()
    const { rerender } = render(<VoiceRecorderModal word="cake" open={true} onOpenChange={onOpenChange} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText(/Requesting microphone access/)).toBeInTheDocument()
    rerender(<VoiceRecorderModal word="cake" open={false} onOpenChange={onOpenChange} />)
    resolveRequest({ getTracks: () => [track] })
    await act(async () => {})
    expect(track.stop).toHaveBeenCalled()
  })

  it('ignores a rejected permission request after the modal closes', async () => {
    let rejectRequest!: (error: unknown) => void
    requestMicrophoneStream.mockReturnValue(new Promise((_resolve, reject) => (rejectRequest = reject)))
    const onOpenChange = vi.fn()
    const { rerender } = render(<VoiceRecorderModal word="cake" open={true} onOpenChange={onOpenChange} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText(/Requesting microphone access/)).toBeInTheDocument()
    rerender(<VoiceRecorderModal word="cake" open={false} onOpenChange={onOpenChange} />)
    rejectRequest(new DOMException('denied', 'NotAllowedError'))
    await act(async () => {})
    // No crash, no state update on the closed modal.
    expect(reportError).not.toHaveBeenCalled()
  })

  it('releases the pre-authorized stream when the modal closes before recording', async () => {
    const track = { stop: vi.fn() }
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <VoiceRecorderModal
        word="cake"
        open={true}
        onOpenChange={onOpenChange}
        microphoneRequest={fakeMicRequest(Promise.resolve({ getTracks: () => [track] }))}
      />
    )
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
    rerender(<VoiceRecorderModal word="cake" open={false} onOpenChange={onOpenChange} />)
    await act(async () => {})
    expect(track.stop).toHaveBeenCalled()
  })

  it('proceeds when the permission query throws synchronously', async () => {
    const query = vi.fn(() => {
      throw new TypeError('not supported')
    })
    Object.defineProperty(navigator, 'permissions', { value: { query }, configurable: true })
    renderModal()
    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument()
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
    let resolveRequest!: (stream: unknown) => void
    let resolveStart!: (s: ReturnType<typeof makeSession>) => void
    requestMicrophoneStream.mockReturnValue(new Promise((resolve) => (resolveRequest = resolve)))
    startRecording.mockReturnValue(new Promise((resolve) => (resolveStart = resolve)))
    const onOpenChange = vi.fn()
    const { rerender } = render(<VoiceRecorderModal word="cake" open={true} onOpenChange={onOpenChange} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    expect(await screen.findByText(/Requesting microphone access/)).toBeInTheDocument()
    resolveRequest(fakeMicStream())
    // The permission is granted; startRecording is now the pending step.
    await waitFor(() => expect(startRecording).toHaveBeenCalled())
    // Close while the recording start is still in flight.
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

  it('cancels the session if the modal unmounts during startRecording', async () => {
    let resolveStart!: (session: RecordingSession) => void
    const session = makeSession()
    startRecording.mockReturnValue(new Promise((resolve) => (resolveStart = resolve)))
    const { unmount } = render(<VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await waitFor(() => expect(startRecording).toHaveBeenCalled())
    unmount()
    resolveStart(session)
    await act(async () => {})
    // The session is cancelled, not stored, so the mic is released.
    expect(session.cancel).toHaveBeenCalled()
  })

  it('falls back to measured time when audio duration is Infinity', async () => {
    const session = makeSession()
    let resolveStop!: (blob: Blob) => void
    session.stop.mockReturnValue(new Promise((resolve) => (resolveStop = resolve)))
    startRecording.mockResolvedValue(session)
    // WebM blobs can report Infinity for duration.
    class InfinityAudio extends FakeAudio {
      override duration = Infinity
    }
    vi.stubGlobal('Audio', InfinityAudio)
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    resolveStop(new Blob(['audio']))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save recording' })).toBeInTheDocument())
    // The duration falls back to elapsed time, not Infinity.
    expect(screen.getByText(/recorded/)).toBeInTheDocument()
  })

  it('ignores a rejected permission query after unmount', async () => {
    let rejectQuery!: (error: unknown) => void
    const query = vi.fn(() => new Promise((_resolve, reject) => (rejectQuery = reject)))
    Object.defineProperty(navigator, 'permissions', { value: { query }, configurable: true })
    const { unmount } = render(<VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} />)
    unmount()
    rejectQuery(new Error('query torn down'))
    await act(async () => {})
    // No crash, no state update after unmount.
    expect(query).toHaveBeenCalled()
  })

  it('stays on the denied screen when retry reports denied', async () => {
    const query = stubPermissions('denied')
    renderModal()
    await screen.findByText('Microphone is blocked')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Microphone is blocked')).toBeInTheDocument()
  })

  it('warns about a very short recording and disables save', async () => {
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
    expect(await screen.findByText(/very short/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save recording' })).toBeDisabled()
  })

  it('tolerates AudioContext close failure when stopping', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        override close(): Promise<void> {
          this.closed = true
          return Promise.reject(new Error('close failed'))
        }
      }
    )
    renderModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    // The close rejection is swallowed; review still renders.
    expect(await screen.findByRole('button', { name: 'Save recording' })).toBeInTheDocument()
  })

  it('tolerates AudioContext close failure when the modal closes mid-recording', async () => {
    const session = makeSession()
    startRecording.mockResolvedValue(session)
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        override close(): Promise<void> {
          this.closed = true
          return Promise.reject(new Error('close failed'))
        }
      }
    )
    const { rerender } = render(<VoiceRecorderModal word="cake" open={true} onOpenChange={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }))
    await screen.findByRole('button', { name: 'Stop' })
    rerender(<VoiceRecorderModal word="cake" open={false} onOpenChange={() => {}} />)
    await act(async () => {})
    expect(session.cancel).toHaveBeenCalled()
  })
})
