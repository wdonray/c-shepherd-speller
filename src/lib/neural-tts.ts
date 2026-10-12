/**
 * Client for the neural read-aloud voice (GET /api/tts proxy).
 *
 * Audio is fetched per text and cached in memory so repeated words in a
 * practice session play instantly. Every failure throws NeuralTtsError so
 * the caller can fall back to the device's built-in voices.
 */

export class NeuralTtsError extends Error {
  readonly code: 'unavailable' | 'rate-limited' | 'aborted' | 'playback'
  constructor(code: NeuralTtsError['code'], message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'NeuralTtsError'
    this.code = code
  }
}

const audioCache = new Map<string, Blob>()
/** Cap the in-memory audio cache so a long session cannot grow unbounded. */
const MAX_CACHE_ENTRIES = 50

/** Test-only reset for the in-memory audio cache. */
export function __resetNeuralTtsForTests(): void {
  audioCache.clear()
}

/** Fetch neural audio for text, from the cache when available. */
async function fetchNeuralAudio(text: string, signal: AbortSignal): Promise<Blob> {
  const cached = audioCache.get(text)
  if (cached) return cached

  let response: Response
  try {
    response = await fetch(`/api/tts?text=${encodeURIComponent(text)}`, { signal })
  } catch (error) {
    throw new NeuralTtsError('unavailable', 'Could not reach the voice service', { cause: error })
  }
  if (response.status === 429) {
    throw new NeuralTtsError('rate-limited', 'Voice service rate limit reached')
  }
  if (!response.ok) {
    throw new NeuralTtsError('unavailable', `Voice service returned ${response.status}`)
  }

  const audio = await response.blob()
  audioCache.set(text, audio)
  if (audioCache.size > MAX_CACHE_ENTRIES) {
    const oldest = audioCache.keys().next()
    audioCache.delete(oldest.value as string)
  }
  return audio
}

/**
 * Play an audio blob through an <audio> element. Resolves when playback
 * ends. Rejects with NeuralTtsError('aborted') when the signal fires, or
 * NeuralTtsError('playback') when the audio cannot play.
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
      finish(() => reject(new NeuralTtsError('aborted', 'Playback stopped')))
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
      finish(() => reject(new NeuralTtsError('playback', 'Could not play the audio')))
    })
    audio.play().catch(() => {
      detachAbort()
      finish(() => reject(new NeuralTtsError('playback', 'Could not play the audio')))
    })
  })
}

/**
 * Speak text with the neural voice: fetch (cached) then play. Rejects with
 * NeuralTtsError when the service is unreachable, rate limited, or the
 * audio cannot play.
 */
export async function speakWithNeuralVoice(text: string, signal: AbortSignal): Promise<void> {
  const audio = await fetchNeuralAudio(text, signal)
  if (signal.aborted) throw new NeuralTtsError('aborted', 'Playback stopped')
  await playAudioBlob(audio, signal)
}
