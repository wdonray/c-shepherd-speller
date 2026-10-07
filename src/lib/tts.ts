/**
 * Text-to-speech for practice mode using the browser Web Speech API.
 * Free, no backend needed. Gracefully no-ops where speech synthesis is
 * unavailable (unsupported browsers, SSR).
 */

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

let cachedVoices: SpeechSynthesisVoice[] | null = null
let voicesListenerAttached = false

function loadVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return []
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

/**
 * Speak text aloud. Does nothing in browsers without speech synthesis, or
 * when the text is empty. Cancels any in-progress speech first so words
 * never overlap when the student taps buttons quickly.
 */
export function speak(text: string): void {
  if (!isTtsSupported()) return
  const trimmed = text.trim()
  if (trimmed.length === 0) return
  const synth = globalThis.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(trimmed)
  utterance.lang = 'en-US'
  utterance.rate = 0.9 // Slightly slower for young learners
  const voice = pickVoice(loadVoices())
  if (voice) {
    utterance.voice = voice
  }
  synth.speak(utterance)
}

/** Stop any in-progress speech. No-op when TTS is not supported. */
export function stopSpeaking(): void {
  if (!isTtsSupported()) return
  globalThis.speechSynthesis.cancel()
}

/**
 * Build the "hear it in a sentence" prompt for a spelling word.
 * Kept to a simple template on purpose: no NLP, just a spoken cue.
 */
export function buildSentencePrompt(word: string): string {
  return `The word is ${word}. Can you spell ${word}?`
}
