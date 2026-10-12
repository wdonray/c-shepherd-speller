/**
 * Text-to-speech for read-aloud, with a quality ladder:
 * 1. The teacher's own recorded audio for the exact text, when one exists
 *    (stored per device in IndexedDB).
 * 2. The neural voice service (GET /api/tts), with a circuit breaker: after
 *    two consecutive failures it cools down for ten minutes and the device
 *    voice is used directly, so a dead service never delays every word.
 * 3. The browser Web Speech API with the teacher's preferred device voice.
 *
 * speak() never rejects: superseded speech simply stops, and every failure
 * falls through to the next rung.
 */

import { reportError } from './report-error'
import { getRecording, isRecordingStorageSupported, recordingToBlob } from './voice-recordings'
import { NeuralTtsError, playAudioBlob, speakWithNeuralVoice } from './neural-tts'

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
 * 1. The teacher's picked voice, when it is still installed
 * 2. English voice with "natural" or "neural" in the name
 * 3. Known-good voice by name
 * 4. Any en-US voice
 * 5. Any English voice
 * 6. undefined (browser default)
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredVoiceUri?: string | null
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined

  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  if (english.length === 0) return undefined

  if (preferredVoiceUri) {
    const preferred = english.find((v) => v.voiceURI === preferredVoiceUri)
    if (preferred) return preferred
  }

  const natural = english.find((v) => /natural|neural/i.test(v.name))
  if (natural) return natural

  const loweredNames = PREFERRED_VOICE_NAMES.map((n) => n.toLowerCase())
  const knownGood = english.find((v) => loweredNames.includes(v.name.toLowerCase()))
  if (knownGood) return knownGood

  const usEnglish = english.find((v) => v.lang.toLowerCase() === 'en-us')
  if (usEnglish) return usEnglish

  return english[0]
}

/** English device voices, for the voice picker. Empty when unsupported. */
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

const FALLBACK_VOICE_URI_KEY = 'patternspell-fallback-voice-uri'

/** The teacher's picked device voice URI, or null for automatic. */
export function getPreferredVoiceUri(): string | null {
  try {
    return window.localStorage.getItem(FALLBACK_VOICE_URI_KEY)
  } catch (error) {
    reportError(error, { location: 'tts.getPreferredVoiceUri' })
    return null
  }
}

/** Persist the teacher's picked device voice URI (null clears it). */
export function setPreferredVoiceUri(uri: string | null): void {
  try {
    if (uri) window.localStorage.setItem(FALLBACK_VOICE_URI_KEY, uri)
    else window.localStorage.removeItem(FALLBACK_VOICE_URI_KEY)
  } catch (error) {
    reportError(error, { location: 'tts.setPreferredVoiceUri' })
  }
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

const NEURAL_FAILURE_THRESHOLD = 2
const NEURAL_COOLDOWN_MS = 10 * 60 * 1000

let neuralFailures = 0
let neuralCooldownUntil = 0
let activePlayback: { signal: AbortSignal; stop: () => void } | null = null

/** Test-only reset for the circuit breaker, in-flight playback, and voice cache. */
export function __resetTtsState(): void {
  neuralFailures = 0
  neuralCooldownUntil = 0
  activePlayback = null
  cachedVoices = null
  voicesListenerAttached = false
}

/** Lowest rung: the built-in device voice. Never throws. */
function speakWithBuiltInVoice(text: string): void {
  try {
    if (!isTtsSupported()) return
    const synth = globalThis.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9 // Slightly slower for young learners
    const voice = pickVoice(loadVoices(), getPreferredVoiceUri())
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
 * speech). Cancels any in-progress speech first so words never overlap when
 * the teacher taps buttons quickly.
 */
export async function speak(text: string): Promise<void> {
  const trimmed = text.trim()
  if (trimmed.length === 0) return
  stopSpeaking()

  const controller = new AbortController()
  activePlayback = { signal: controller.signal, stop: () => controller.abort() }
  try {
    // Rung 1: the teacher's own recording for this exact text.
    let recording = null
    try {
      recording = isRecordingStorageSupported() ? await getRecording(trimmed) : null
    } catch {
      recording = null // Storage hiccup: fall through to the voices.
    }
    if (recording) {
      try {
        await playAudioBlob(recordingToBlob(recording), controller.signal)
        return
      } catch (error) {
        if (error instanceof NeuralTtsError && error.code === 'aborted') return
        // Unplayable recording: fall through to the voices.
      }
    }

    // Rung 2: the neural voice, unless it is cooling down.
    if (Date.now() < neuralCooldownUntil) {
      speakWithBuiltInVoice(trimmed)
      return
    }
    try {
      await speakWithNeuralVoice(trimmed, controller.signal)
      neuralFailures = 0
    } catch (error) {
      if (error instanceof NeuralTtsError && error.code === 'aborted') return
      neuralFailures += 1
      if (neuralFailures >= NEURAL_FAILURE_THRESHOLD) {
        neuralCooldownUntil = Date.now() + NEURAL_COOLDOWN_MS
      }
      // Rung 3: the built-in device voice.
      speakWithBuiltInVoice(trimmed)
    }
  } finally {
    if (activePlayback?.signal === controller.signal) activePlayback = null
  }
}

/** Stop any in-progress speech: recordings, neural audio, and built-in. No-op when idle. */
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
