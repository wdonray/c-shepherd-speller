import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getRecording, isRecordingStorageSupported, recordingToBlob } = vi.hoisted(() => ({
  getRecording: vi.fn(),
  isRecordingStorageSupported: vi.fn(),
  recordingToBlob: vi.fn((recording: unknown) => recording),
}))
vi.mock('./voice-recordings', () => ({ getRecording, isRecordingStorageSupported, recordingToBlob }))

const { FakeNeuralTtsError, playAudioBlob, speakWithNeuralVoice } = vi.hoisted(() => {
  class FakeNeuralTtsError extends Error {
    code: string
    constructor(code: string, message: string = code) {
      super(message)
      this.name = 'NeuralTtsError'
      this.code = code
    }
  }
  return {
    FakeNeuralTtsError,
    playAudioBlob: vi.fn(),
    speakWithNeuralVoice: vi.fn(),
  }
})
vi.mock('./neural-tts', () => ({ NeuralTtsError: FakeNeuralTtsError, playAudioBlob, speakWithNeuralVoice }))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('./report-error', () => ({ reportError }))

import {
  __resetTtsState,
  buildSentencePrompt,
  getPreferredVoiceUri,
  isTtsSupported,
  listDeviceVoices,
  onVoicesChanged,
  pickVoice,
  setPreferredVoiceUri,
  speak,
  stopSpeaking,
} from './tts'

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

function fakeVoice(name: string, lang: string, voiceURI?: string): SpeechSynthesisVoice {
  return { name, lang, voiceURI: voiceURI ?? `${lang}-${name}` } as SpeechSynthesisVoice
}

interface StubSynth {
  cancel: ReturnType<typeof vi.fn>
  speak: ReturnType<typeof vi.fn>
  getVoices?: () => SpeechSynthesisVoice[]
  addEventListener?: (event: string, listener: () => void) => void
  removeEventListener?: (event: string, listener: () => void) => void
}

function stubSpeechSynthesis(synth: unknown) {
  vi.stubGlobal('speechSynthesis', synth)
}

function makeSynth(overrides: Partial<StubSynth> = {}): StubSynth {
  return { cancel: vi.fn(), speak: vi.fn(), ...overrides }
}

function removeSpeechSynthesis() {
  // jsdom does not implement speechSynthesis; delete the stub (or the
  // no-op own property) so globalThis.speechSynthesis is undefined again.
  delete (globalThis as Record<string, unknown>)['speechSynthesis']
}

/** Neural voice mock that rejects with "aborted" when its signal fires. */
function abortableNeuralVoice() {
  speakWithNeuralVoice.mockImplementation(
    (_text: string, signal: AbortSignal) =>
      new Promise<void>((_resolve, reject) => {
        if (signal.aborted) reject(new FakeNeuralTtsError('aborted'))
        else signal.addEventListener('abort', () => reject(new FakeNeuralTtsError('aborted')))
      })
  )
}

/** Recording playback mock that rejects with "aborted" when its signal fires. */
function abortablePlayback() {
  playAudioBlob.mockImplementation(
    (_blob: unknown, signal: AbortSignal) =>
      new Promise<void>((_resolve, reject) => {
        if (signal.aborted) reject(new FakeNeuralTtsError('aborted'))
        else signal.addEventListener('abort', () => reject(new FakeNeuralTtsError('aborted')))
      })
  )
}

describe('tts', () => {
  beforeEach(() => {
    __resetTtsState()
    createdUtterances.length = 0
    removeSpeechSynthesis()
    vi.stubGlobal('SpeechSynthesisUtterance', FakeSpeechSynthesisUtterance)
    window.localStorage.clear()
    vi.clearAllMocks()
    isRecordingStorageSupported.mockReturnValue(false)
    getRecording.mockResolvedValue(null)
    speakWithNeuralVoice.mockResolvedValue(undefined)
    playAudioBlob.mockResolvedValue(undefined)
    reportError.mockClear()
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

  describe('pickVoice', () => {
    it('returns undefined for an empty list', () => {
      expect(pickVoice([])).toBeUndefined()
    })

    it('returns undefined when no voice is English', () => {
      expect(pickVoice([fakeVoice('Google francais', 'fr-FR')])).toBeUndefined()
    })

    it('prefers the teacher-picked voice when it is still installed', () => {
      const voices = [fakeVoice('Google US English', 'en-US'), fakeVoice('Daniel', 'en-GB', 'picked-uri')]
      expect(pickVoice(voices, 'picked-uri')).toBe(voices[1])
    })

    it('falls through when the picked voice is gone', () => {
      const voices = [fakeVoice('Google US English', 'en-US')]
      expect(pickVoice(voices, 'gone-uri')).toBe(voices[0])
    })

    it('prefers natural/neural voices', () => {
      const voices = [fakeVoice('Google US English', 'en-US'), fakeVoice('Microsoft Jenny Online (Natural)', 'en-US')]
      expect(pickVoice(voices)).toBe(voices[1])
    })

    it('falls back to known-good names', () => {
      const voices = [fakeVoice('Some Voice', 'en-US'), fakeVoice('Samantha', 'en-US')]
      expect(pickVoice(voices)).toBe(voices[1])
    })

    it('falls back to any en-US voice', () => {
      const voices = [fakeVoice('Some Voice', 'en-GB'), fakeVoice('Other Voice', 'en-US')]
      expect(pickVoice(voices)).toBe(voices[1])
    })

    it('falls back to the first English voice', () => {
      const voices = [fakeVoice('Some Voice', 'en-AU')]
      expect(pickVoice(voices)).toBe(voices[0])
    })
  })

  describe('listDeviceVoices', () => {
    it('returns an empty list when TTS is unsupported', () => {
      expect(listDeviceVoices()).toEqual([])
    })

    it('returns only English voices', () => {
      const voices = [fakeVoice('Google US English', 'en-US'), fakeVoice('Google francais', 'fr-FR')]
      stubSpeechSynthesis(makeSynth({ getVoices: () => voices }))
      expect(listDeviceVoices()).toEqual([voices[0]])
    })

    it('returns an empty list when getVoices is missing', () => {
      stubSpeechSynthesis(makeSynth())
      expect(listDeviceVoices()).toEqual([])
    })
  })

  describe('onVoicesChanged', () => {
    it('returns a no-op when TTS is unsupported', () => {
      expect(() => onVoicesChanged(() => {})()).not.toThrow()
    })

    it('subscribes and unsubscribes', () => {
      const listeners = new Map<string, Array<() => void>>()
      stubSpeechSynthesis(
        makeSynth({
          addEventListener: (event, listener) => {
            listeners.set(event, [...(listeners.get(event) ?? []), listener])
          },
          removeEventListener: (event, listener) => {
            listeners.set(
              event,
              (listeners.get(event) ?? []).filter((l) => l !== listener)
            )
          },
        })
      )
      const listener = vi.fn()
      const unsubscribe = onVoicesChanged(listener)
      listeners.get('voiceschanged')?.forEach((l) => l())
      expect(listener).toHaveBeenCalledTimes(1)
      unsubscribe()
      listeners.get('voiceschanged')?.forEach((l) => l())
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('returns a no-op when addEventListener is missing', () => {
      stubSpeechSynthesis(makeSynth({ addEventListener: undefined, removeEventListener: undefined }))
      expect(() => onVoicesChanged(() => {})()).not.toThrow()
    })
  })

  describe('preferred voice persistence', () => {
    it('returns null when nothing is stored', () => {
      expect(getPreferredVoiceUri()).toBeNull()
    })

    it('round-trips the picked voice URI', () => {
      setPreferredVoiceUri('voice-1')
      expect(getPreferredVoiceUri()).toBe('voice-1')
      setPreferredVoiceUri(null)
      expect(getPreferredVoiceUri()).toBeNull()
    })

    it('reports and returns null when storage throws on read', () => {
      vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementationOnce(() => {
        throw new Error('denied')
      })
      expect(getPreferredVoiceUri()).toBeNull()
      expect(reportError).toHaveBeenCalled()
    })

    it('reports when storage throws on write', () => {
      vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementationOnce(() => {
        throw new Error('denied')
      })
      setPreferredVoiceUri('voice-1')
      expect(reportError).toHaveBeenCalled()
      expect(getPreferredVoiceUri()).toBeNull()
    })
  })

  describe('speak', () => {
    it('does nothing for empty or whitespace-only text', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)

      await speak('   ')

      expect(synth.cancel).not.toHaveBeenCalled()
      expect(speakWithNeuralVoice).not.toHaveBeenCalled()
      expect(createdUtterances).toHaveLength(0)
    })

    it('does not throw when nothing can speak', async () => {
      await expect(speak('hello')).resolves.toBeUndefined()
      expect(speakWithNeuralVoice).toHaveBeenCalledWith('hello', expect.any(AbortSignal))
    })

    it('plays the teacher recording instead of any voice', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)
      isRecordingStorageSupported.mockReturnValue(true)
      const recording = { text: 'cake', audio: new ArrayBuffer(8), mimeType: 'audio/webm', recordedAt: 1 }
      getRecording.mockResolvedValue(recording)

      await speak('cake')

      expect(getRecording).toHaveBeenCalledWith('cake')
      expect(recordingToBlob).toHaveBeenCalledWith(recording)
      expect(playAudioBlob).toHaveBeenCalled()
      expect(speakWithNeuralVoice).not.toHaveBeenCalled()
      expect(synth.speak).not.toHaveBeenCalled()
    })

    it('falls through to the neural voice when the recording lookup fails', async () => {
      stubSpeechSynthesis(makeSynth())
      isRecordingStorageSupported.mockReturnValue(true)
      getRecording.mockRejectedValue(new Error('idb down'))

      await speak('cake')

      expect(speakWithNeuralVoice).toHaveBeenCalledWith('cake', expect.any(AbortSignal))
    })

    it('falls through to the neural voice when the recording cannot play', async () => {
      stubSpeechSynthesis(makeSynth())
      isRecordingStorageSupported.mockReturnValue(true)
      getRecording.mockResolvedValue({ text: 'cake' })
      playAudioBlob.mockRejectedValue(new FakeNeuralTtsError('playback'))

      await speak('cake')

      expect(speakWithNeuralVoice).toHaveBeenCalledWith('cake', expect.any(AbortSignal))
    })

    it('stops a recording in flight without falling back when superseded', async () => {
      stubSpeechSynthesis(makeSynth())
      isRecordingStorageSupported.mockReturnValue(true)
      getRecording.mockImplementation(async (text: string) => (text === 'first' ? { text } : null))
      abortablePlayback()

      const first = speak('first')
      await speak('second')

      await expect(first).resolves.toBeUndefined()
      // The aborted recording never fell back to the neural voice...
      expect(speakWithNeuralVoice).toHaveBeenCalledTimes(1)
      expect(speakWithNeuralVoice).toHaveBeenCalledWith('second', expect.any(AbortSignal))
    })

    it('uses the neural voice and resets the failure count on success', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)

      await speak('cake')

      expect(speakWithNeuralVoice).toHaveBeenCalledWith('cake', expect.any(AbortSignal))
      expect(synth.speak).not.toHaveBeenCalled()
    })

    it('falls back to the built-in voice when the neural voice fails', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)
      speakWithNeuralVoice.mockRejectedValue(new FakeNeuralTtsError('unavailable'))

      await speak('  cake  ')

      expect(synth.cancel).toHaveBeenCalled()
      expect(synth.speak).toHaveBeenCalledTimes(1)
      expect(createdUtterances).toHaveLength(1)
      expect(createdUtterances[0]).toMatchObject({ text: 'cake', lang: 'en-US', rate: 0.9 })
    })

    it('uses the teacher-picked device voice for the fallback', async () => {
      const voices = [fakeVoice('Google US English', 'en-US'), fakeVoice('Daniel', 'en-GB', 'picked-uri')]
      const synth = makeSynth({ getVoices: () => voices })
      stubSpeechSynthesis(synth)
      setPreferredVoiceUri('picked-uri')
      speakWithNeuralVoice.mockRejectedValue(new FakeNeuralTtsError('unavailable'))

      await speak('cake')

      expect(createdUtterances[0]?.voice).toBe(voices[1])
    })

    it('retries the neural voice after a single failure', async () => {
      stubSpeechSynthesis(makeSynth())
      speakWithNeuralVoice.mockRejectedValue(new FakeNeuralTtsError('unavailable'))

      await speak('one')
      await speak('two')

      expect(speakWithNeuralVoice).toHaveBeenCalledTimes(2)
    })

    it('cools down the neural voice after two consecutive failures', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)
      speakWithNeuralVoice.mockRejectedValue(new FakeNeuralTtsError('unavailable'))

      await speak('one')
      await speak('two')
      await speak('three')

      expect(speakWithNeuralVoice).toHaveBeenCalledTimes(2)
      expect(synth.speak).toHaveBeenCalledTimes(3)
    })

    it('tries the neural voice again after the cooldown expires', async () => {
      stubSpeechSynthesis(makeSynth())
      speakWithNeuralVoice.mockRejectedValue(new FakeNeuralTtsError('unavailable'))
      let now = 1_000_000
      const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => now)

      try {
        await speak('one')
        await speak('two')
        expect(speakWithNeuralVoice).toHaveBeenCalledTimes(2)

        now += 10 * 60 * 1000 + 1
        await speak('three')
        expect(speakWithNeuralVoice).toHaveBeenCalledTimes(3)
      } finally {
        dateNow.mockRestore()
      }
    })

    it('does not fall back when the neural voice is aborted', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)
      abortableNeuralVoice()

      const pending = speak('cake')
      stopSpeaking()
      await expect(pending).resolves.toBeUndefined()

      expect(synth.speak).not.toHaveBeenCalled()
    })

    it('clears in-flight state when stopped externally', async () => {
      stubSpeechSynthesis(makeSynth())
      abortableNeuralVoice()

      const pending = speak('cake')
      // stopSpeaking nulls the in-flight playback; the abort rejects the
      // neural voice, and the finally block must tolerate the null.
      stopSpeaking()
      await expect(pending).resolves.toBeUndefined()

      // A later speak starts clean: nothing is aborted underneath it.
      speakWithNeuralVoice.mockResolvedValue(undefined)
      await speak('bake')
      expect(speakWithNeuralVoice).toHaveBeenCalledWith('bake', expect.any(AbortSignal))
    })

    it('reports when the built-in voice throws', async () => {
      stubSpeechSynthesis(
        makeSynth({
          speak: vi.fn(() => {
            throw new Error('speak failed')
          }),
        })
      )
      speakWithNeuralVoice.mockRejectedValue(new FakeNeuralTtsError('unavailable'))

      await expect(speak('cake')).resolves.toBeUndefined()
      expect(reportError).toHaveBeenCalled()
    })

    it('is a no-op fallback when TTS is unsupported', async () => {
      speakWithNeuralVoice.mockRejectedValue(new FakeNeuralTtsError('unavailable'))
      await expect(speak('cake')).resolves.toBeUndefined()
    })

    it('refreshes the cached voices when voiceschanged fires', async () => {
      const listeners = new Map<string, Array<() => void>>()
      const getVoices = vi.fn(() => [] as SpeechSynthesisVoice[])
      const synth = makeSynth({
        getVoices,
        addEventListener: (event, listener) => {
          listeners.set(event, [...(listeners.get(event) ?? []), listener])
        },
      })
      stubSpeechSynthesis(synth)
      speakWithNeuralVoice.mockRejectedValue(new FakeNeuralTtsError('unavailable'))

      await speak('one')
      expect(createdUtterances[0]?.voice).toBeUndefined()

      // Voices arrive asynchronously; the listener refreshes the cache.
      getVoices.mockReturnValue([fakeVoice('Google US English', 'en-US')])
      listeners.get('voiceschanged')?.forEach((l) => l())
      await speak('two')
      expect(createdUtterances[1]?.voice).toMatchObject({ name: 'Google US English' })
      expect(getVoices).toHaveBeenCalledTimes(2)
    })
  })

  describe('stopSpeaking', () => {
    it('does nothing when TTS is not supported', () => {
      expect(() => stopSpeaking()).not.toThrow()
    })

    it('cancels in-progress speech', () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)
      stopSpeaking()
      expect(synth.cancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('buildSentencePrompt', () => {
    it('uses the teacher sentence when present', () => {
      expect(buildSentencePrompt('cake', 'We baked a cake.')).toBe('We baked a cake.')
    })

    it('trims the teacher sentence', () => {
      expect(buildSentencePrompt('cake', '  We baked a cake.  ')).toBe('We baked a cake.')
    })

    it('falls back to the template without a sentence', () => {
      expect(buildSentencePrompt('cake')).toBe('The word is cake. Can you spell cake?')
    })

    it('falls back to the template for a blank sentence', () => {
      expect(buildSentencePrompt('cake', '   ')).toBe('The word is cake. Can you spell cake?')
    })
  })
})
