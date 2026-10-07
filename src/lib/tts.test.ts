import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildSentencePrompt, isTtsSupported, speak, stopSpeaking } from './tts'

const createdUtterances: { text: string; lang: string; rate: number; voice?: unknown }[] = []

class FakeSpeechSynthesisUtterance {
  text: string
  lang = ''
  rate = 1
  voice: unknown = undefined
  constructor(text: string) {
    this.text = text
    createdUtterances.push(this)
  }
}

function fakeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang } as SpeechSynthesisVoice
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

  describe('pickVoice', () => {
    // Import fresh to avoid the module-level voice cache between tests.
    async function loadPickVoice() {
      vi.resetModules()
      const mod = await import('./tts')
      return mod.pickVoice
    }

    it('returns undefined for an empty voice list', async () => {
      const pickVoice = await loadPickVoice()
      expect(pickVoice([])).toBeUndefined()
    })

    it('returns undefined when no English voice exists', async () => {
      const pickVoice = await loadPickVoice()
      expect(pickVoice([fakeVoice('Marie', 'fr-FR')])).toBeUndefined()
    })

    it('prefers natural/neural voices over plain ones', async () => {
      const pickVoice = await loadPickVoice()
      const plain = fakeVoice('Microsoft David', 'en-US')
      const natural = fakeVoice('Microsoft Aria Online (Natural)', 'en-US')
      expect(pickVoice([plain, natural])).toBe(natural)
    })

    it('prefers a known-good name over a generic en-US voice', async () => {
      const pickVoice = await loadPickVoice()
      const generic = fakeVoice('Some Voice', 'en-US')
      const samantha = fakeVoice('Samantha', 'en-US')
      expect(pickVoice([generic, samantha])).toBe(samantha)
    })

    it('prefers en-US over other English variants', async () => {
      const pickVoice = await loadPickVoice()
      const uk = fakeVoice('Daniel', 'en-GB')
      const us = fakeVoice('David', 'en-US')
      expect(pickVoice([uk, us])).toBe(us)
    })

    it('falls back to the first English voice', async () => {
      const pickVoice = await loadPickVoice()
      const uk = fakeVoice('Daniel', 'en-GB')
      expect(pickVoice([uk])).toBe(uk)
    })
  })

  describe('speak voice wiring', () => {
    async function loadSpeak() {
      vi.resetModules()
      return await import('./tts')
    }

    function stubSynth(voices: SpeechSynthesisVoice[]) {
      const listeners: Record<string, () => void> = {}
      const synth = {
        cancel: vi.fn(),
        speak: vi.fn(),
        getVoices: vi.fn(() => voices),
        addEventListener: vi.fn((event: string, cb: () => void) => {
          listeners[event] = cb
        }),
      }
      stubSpeechSynthesis(synth)
      return { synth, listeners }
    }

    it('sets the picked voice on the utterance', async () => {
      const { synth } = stubSynth([fakeVoice('Samantha', 'en-US')])
      const { speak } = await loadSpeak()
      speak('hello')
      expect(synth.speak).toHaveBeenCalledTimes(1)
      expect(createdUtterances[0].voice).toMatchObject({ name: 'Samantha' })
    })

    it('speaks without a voice when the list is empty', async () => {
      const { synth } = stubSynth([])
      const { speak } = await loadSpeak()
      expect(() => speak('hello')).not.toThrow()
      expect(synth.speak).toHaveBeenCalledTimes(1)
      expect(createdUtterances[0].voice).toBeUndefined()
    })

    it('caches voices instead of re-enumerating per utterance', async () => {
      const { synth } = stubSynth([fakeVoice('Samantha', 'en-US')])
      const { speak } = await loadSpeak()
      speak('one')
      speak('two')
      expect(synth.getVoices).toHaveBeenCalledTimes(1)
      expect(synth.addEventListener).toHaveBeenCalledTimes(1)
    })

    it('refreshes the cache when voiceschanged fires', async () => {
      const { synth, listeners } = stubSynth([])
      const { speak } = await loadSpeak()
      speak('one')
      expect(createdUtterances[0].voice).toBeUndefined()
      // Voices arrive asynchronously; the listener refreshes the cache.
      synth.getVoices.mockReturnValue([fakeVoice('Google US English', 'en-US')])
      listeners['voiceschanged']()
      speak('two')
      expect(createdUtterances[1].voice).toMatchObject({ name: 'Google US English' })
    })
  })
})
