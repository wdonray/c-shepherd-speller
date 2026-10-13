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

import { reportError } from './report-error'

let audioContext: AudioContext | null = null

function getContext(): AudioContext | null {
  const Ctor = window.AudioContext
  if (!Ctor) return null
  if (!audioContext) {
    audioContext = new Ctor()
  }
  return audioContext
}

export function isSoundEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === null ? true : stored === 'true'
  } catch (error) {
    reportError(error, { location: 'sound-effects.isSoundEnabled' })
    return true
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch (error) {
    // Storage unavailable; the in-memory default stands.
    reportError(error, { location: 'sound-effects.setSoundEnabled' })
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

/** Single short blip for pickup. Quiet. */
export function playPickupSound(): void {
  playTones([{ frequency: 660, startOffset: 0, duration: 0.06 }])
}

/** Soft thock for drop settle. */
export function playDropSound(): void {
  playTones([{ frequency: 220, startOffset: 0, duration: 0.08 }])
}

/**
 * Victory fanfare for a completed sort: a bright ascending run climbing two
 * octaves into a held C-major chord. Deliberately much bigger than the
 * single-drop correct chime (two tones under 350ms) so the win moment reads
 * as a celebration, not another drop. About 1.2 seconds total.
 */
export function playWinFanfare(): void {
  playTones([
    { frequency: 523.25, startOffset: 0, duration: 0.11 }, // C5
    { frequency: 659.25, startOffset: 0.1, duration: 0.11 }, // E5
    { frequency: 783.99, startOffset: 0.2, duration: 0.11 }, // G5
    { frequency: 1046.5, startOffset: 0.3, duration: 0.13 }, // C6
    { frequency: 1318.5, startOffset: 0.41, duration: 0.13 }, // E6
    { frequency: 1568.0, startOffset: 0.52, duration: 0.16 }, // G6
    // Held C-major chord to land the celebration.
    { frequency: 1046.5, startOffset: 0.66, duration: 0.55 }, // C6
    { frequency: 1318.5, startOffset: 0.66, duration: 0.55 }, // E6
    { frequency: 1568.0, startOffset: 0.66, duration: 0.55 }, // G6
  ])
}
