/**
 * Audio playback for teacher-recorded audio blobs.
 *
 * Every failure throws AudioPlaybackError so the caller can fall back to the
 * built-in device voice.
 */

export class AudioPlaybackError extends Error {
  readonly code: 'aborted' | 'playback'
  constructor(code: AudioPlaybackError['code'], message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AudioPlaybackError'
    this.code = code
  }
}

/**
 * Play an audio blob through an <audio> element. Resolves when playback
 * ends. Rejects with AudioPlaybackError('aborted') when the signal fires, or
 * AudioPlaybackError('playback') when the audio cannot play.
 */
export function playAudioBlob(blob: Blob, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    let settled = false
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      fn()
    }
    const onAbort = (): void => {
      audio.pause()
      finish(() => reject(new AudioPlaybackError('aborted', 'Playback stopped')))
    }
    const detachAbort = (): void => {
      signal.removeEventListener('abort', onAbort)
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    audio.addEventListener('ended', () => {
      detachAbort()
      finish(() => resolve())
    })
    audio.addEventListener('error', () => {
      detachAbort()
      finish(() => reject(new AudioPlaybackError('playback', 'Could not play the audio')))
    })
    audio.play().catch(() => {
      detachAbort()
      finish(() => reject(new AudioPlaybackError('playback', 'Could not play the audio')))
    })
  })
}
