/**
 * Text-to-speech for read-aloud using the browser Web Speech API.
 * Free, no backend needed. Gracefully no-ops where speech synthesis is
 * unavailable (unsupported browsers, SSR).
 *
 * If the teacher recorded their own audio for the exact text, that plays
 * instead (stored per device in IndexedDB).
 *
 * speak() never rejects: superseded speech simply stops.
 */

import { reportError } from './report-error'
import { getRecording, isRecordingStorageSupported, recordingToBlob } from './voice-recordings'
import { AudioPlaybackError, playAudioBlob } from './audio-playback'

/** True when the browser can speak text aloud. */
export function isTtsSupported(): boolean {
  return typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.speechSynthesis.speak === 'function'
}

/** Known-good natural voices, matched case-insensitively. Best effort: exact names vary by OS. */
const PREFERRED_VOICE_NAMES = [
  'Google US English',
  'Samantha',
  'Google UK English Female',
  'Microsoft Jenny Online (Natural)',
]

/**
 * Pick the most natural-sounding English voice from the browser's list.
 * Preference chain (first match wins):
 * 1. English voice with "natural" or "neural" in the name
 * 2. Known-good voice by name
 * 3. Any en-US voice
 * 4. Any English voice
 * 5. undefined (browser default)
 */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined

  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  if (english.length === 0) return undefined

  const natural = english.find((v) => /natural|neural/i.test(v.name))
  if (natural) return natural

  const loweredNames = PREFERRED_VOICE_NAMES.map((n) => n.toLowerCase())
  const knownGood = english.find((v) => loweredNames.includes(v.name.toLowerCase()))
  if (knownGood) return knownGood

  const usEnglish = english.find((v) => v.lang.toLowerCase() === 'en-us')
  if (usEnglish) return usEnglish

  return english[0]
}

/** English device voices. Empty when unsupported. */
export function listDeviceVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return []
  const synth = globalThis.speechSynthesis
  const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : []
  return voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
}

/**
 * Subscribe to device voice list changes (Chrome loads them asynchronously).
 * Returns an unsubscribe function. Safe to call when unsupported.
 */
export function onVoicesChanged(listener: () => void): () => void {
  if (!isTtsSupported()) return () => {}
  const synth = globalThis.speechSynthesis
  if (typeof synth.addEventListener !== 'function' || typeof synth.removeEventListener !== 'function') {
    return () => {}
  }
  synth.addEventListener('voiceschanged', listener)
  return () => synth.removeEventListener('voiceschanged', listener)
}

let cachedVoices: SpeechSynthesisVoice[] | null = null
let voicesListenerAttached = false

function loadVoices(): SpeechSynthesisVoice[] {
  // Called only from speakWithBuiltInVoice, which already verified TTS support.
  if (cachedVoices !== null) return cachedVoices
  const synth = globalThis.speechSynthesis
  // getVoices may be missing on partial implementations; fall back to empty.
  const readVoices = typeof synth.getVoices === 'function' ? () => synth.getVoices() : () => []
  cachedVoices = readVoices()
  // Chrome loads voices asynchronously; refresh the cache when they arrive.
  if (!voicesListenerAttached && typeof synth.addEventListener === 'function') {
    voicesListenerAttached = true
    synth.addEventListener('voiceschanged', () => {
      cachedVoices = readVoices()
    })
  }
  return cachedVoices
}

let activePlayback: { signal: AbortSignal; stop: () => void } | null = null

/** Test-only reset for in-flight playback and the voice cache. */
export function __resetTtsState(): void {
  activePlayback = null
  cachedVoices = null
  voicesListenerAttached = false
}

/** The built-in device voice. Never throws. */
function speakWithBuiltInVoice(text: string): void {
  try {
    if (!isTtsSupported()) return
    const synth = globalThis.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9 // Slightly slower for young learners
    const voice = pickVoice(loadVoices())
    if (voice) {
      utterance.voice = voice
    }
    synth.speak(utterance)
  } catch (error) {
    reportError(error, { location: 'tts.speakWithBuiltInVoice' })
  }
}

/**
 * Speak text aloud. Empty text is a no-op (and does not interrupt in-flight
 * speech). If the teacher recorded their own audio for the exact text, that
 * plays instead of the built-in voice. Cancels any in-progress speech first
 * so words never overlap when the teacher taps buttons quickly.
 */
export async function speak(text: string): Promise<void> {
  const trimmed = text.trim()
  if (trimmed.length === 0) return
  stopSpeaking()

  const controller = new AbortController()
  activePlayback = { signal: controller.signal, stop: () => controller.abort() }
  try {
    // The teacher's own recording for this exact text, when one exists.
    let recording = null
    try {
      recording = isRecordingStorageSupported() ? await getRecording(trimmed) : null
    } catch {
      recording = null // Storage hiccup: fall through to the built-in voice.
    }
    if (recording) {
      try {
        await playAudioBlob(recordingToBlob(recording), controller.signal)
        return
      } catch (error) {
        if (error instanceof AudioPlaybackError && error.code === 'aborted') return
        // Unplayable recording: fall through to the built-in voice.
      }
    }

    speakWithBuiltInVoice(trimmed)
  } finally {
    if (activePlayback?.signal === controller.signal) activePlayback = null
  }
}

/** Stop any in-progress speech: recordings and built-in. No-op when idle. */
export function stopSpeaking(): void {
  activePlayback?.stop()
  activePlayback = null
  if (!isTtsSupported()) return
  globalThis.speechSynthesis.cancel()
}

/**
 * Build the "hear it in a sentence" prompt for a spelling word.
 * When the teacher picked an example sentence, speak it; otherwise fall
 * back to the simple template.
 */
export function buildSentencePrompt(word: string, sentence?: string): string {
  if (sentence && sentence.trim().length > 0) return sentence.trim()
  return `The word is ${word}. Can you spell ${word}?`
}
