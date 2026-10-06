/**
 * Text-to-speech for practice mode using the browser Web Speech API.
 * Free, no backend needed. Gracefully no-ops where speech synthesis is
 * unavailable (unsupported browsers, SSR).
 */

/** True when the browser can speak text aloud. */
export function isTtsSupported(): boolean {
  return typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.speechSynthesis.speak === 'function'
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
