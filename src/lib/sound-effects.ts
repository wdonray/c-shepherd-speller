/**
 * Synthesized sound effects for practice mode via the Web Audio API.
 *
 * No external audio files: no assets to bundle, no licensing, works offline.
 * Volume is capped in code (master gain 0.2). Sounds can be muted; the
 * choice persists in localStorage. All play functions no-op when muted or
 * when AudioContext is unavailable (SSR, tests, old browsers).
 */

const STORAGE_KEY = 'patternspell-sound-enabled'
/** Master gain: well below full scale so effects are never loud. */
const MASTER_GAIN = 0.2

let audioContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext
  if (!Ctor) return null
  if (!audioContext) {
    audioContext = new Ctor()
  }
  return audioContext
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // Storage unavailable; the in-memory default stands.
  }
}

interface Tone {
  frequency: number
  startOffset: number
  duration: number
}

function playTones(tones: Tone[]): void {
  if (!isSoundEnabled()) return
  const ctx = getContext()
  if (!ctx) return

  // resume() inside the user-gesture handler satisfies autoplay policies.
  void ctx.resume()

  const master = ctx.createGain()
  master.gain.value = MASTER_GAIN
  master.connect(ctx.destination)

  const now = ctx.currentTime
  for (const tone of tones) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = tone.frequency

    const gain = ctx.createGain()
    const start = now + tone.startOffset
    const end = start + tone.duration
    // Short attack/decay envelope so tones start and stop cleanly.
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(1, start + 0.02)
    gain.gain.setValueAtTime(1, end - 0.03)
    gain.gain.linearRampToValueAtTime(0, end)

    osc.connect(gain)
    gain.connect(master)
    osc.start(start)
    osc.stop(end)
  }
}

/** Cheerful ascending chime for correct answers. Under 350 ms total. */
export function playCorrectSound(): void {
  playTones([
    { frequency: 659.25, startOffset: 0, duration: 0.12 }, // E5
    { frequency: 880, startOffset: 0.12, duration: 0.12 }, // A5
  ])
}

/** Gentle descending tones for incorrect answers. Under 400 ms total. */
export function playIncorrectSound(): void {
  playTones([
    { frequency: 220, startOffset: 0, duration: 0.15 }, // A3
    { frequency: 196, startOffset: 0.15, duration: 0.15 }, // G3
  ])
}
