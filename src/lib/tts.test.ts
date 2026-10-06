import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildSentencePrompt, isTtsSupported, speak, stopSpeaking } from './tts'

const createdUtterances: { text: string; lang: string; rate: number }[] = []

class FakeSpeechSynthesisUtterance {
  text: string
  lang = ''
  rate = 1
  constructor(text: string) {
    this.text = text
    createdUtterances.push(this)
  }
}

function stubSpeechSynthesis(synth: unknown) {
  vi.stubGlobal('speechSynthesis', synth)
}

function removeSpeechSynthesis() {
  // jsdom does not implement speechSynthesis; delete the stub (or the
  // no-op own property) so globalThis.speechSynthesis is undefined again.
  delete (globalThis as Record<string, unknown>)['speechSynthesis']
}

describe('tts', () => {
  beforeEach(() => {
    createdUtterances.length = 0
    removeSpeechSynthesis()
    vi.stubGlobal('SpeechSynthesisUtterance', FakeSpeechSynthesisUtterance)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('isTtsSupported', () => {
    it('returns false when speechSynthesis is missing', () => {
      expect(isTtsSupported()).toBe(false)
    })

    it('returns false when speechSynthesis.speak is not a function', () => {
      stubSpeechSynthesis({ speak: 'not-a-function' })
      expect(isTtsSupported()).toBe(false)
    })

    it('returns true when speechSynthesis with speak exists', () => {
      stubSpeechSynthesis({ speak: () => {} })
      expect(isTtsSupported()).toBe(true)
    })
  })

  describe('speak', () => {
    it('does nothing when TTS is not supported', () => {
      expect(() => speak('hello')).not.toThrow()
    })

    it('does nothing for empty or whitespace-only text', () => {
      const cancel = vi.fn()
      const speakFn = vi.fn()
      stubSpeechSynthesis({ cancel, speak: speakFn })

      speak('   ')

      expect(cancel).not.toHaveBeenCalled()
      expect(speakFn).not.toHaveBeenCalled()
      expect(createdUtterances).toHaveLength(0)
    })

    it('cancels pending speech and speaks a trimmed utterance', () => {
      const cancel = vi.fn()
      const speakFn = vi.fn()
      stubSpeechSynthesis({ cancel, speak: speakFn })

      speak('  hello  ')

      expect(cancel).toHaveBeenCalled()
      expect(speakFn).toHaveBeenCalledTimes(1)
      expect(createdUtterances).toHaveLength(1)
      expect(createdUtterances[0]).toMatchObject({ text: 'hello', lang: 'en-US', rate: 0.9 })
    })
  })

  describe('stopSpeaking', () => {
    it('does nothing when TTS is not supported', () => {
      expect(() => stopSpeaking()).not.toThrow()
    })

    it('cancels in-progress speech', () => {
      const cancel = vi.fn()
      stubSpeechSynthesis({ cancel, speak: () => {} })
      stopSpeaking()
      expect(cancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('buildSentencePrompt', () => {
    it('builds a simple spoken cue for the word', () => {
      expect(buildSentencePrompt('rain')).toBe('The word is rain. Can you spell rain?')
    })
  })
})
