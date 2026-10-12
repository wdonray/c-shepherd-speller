import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getRecording, isRecordingStorageSupported, recordingToBlob } = vi.hoisted(() => ({
  getRecording: vi.fn(),
  isRecordingStorageSupported: vi.fn(),
  recordingToBlob: vi.fn((recording: unknown) => recording),
}))
vi.mock('./voice-recordings', () => ({ getRecording, isRecordingStorageSupported, recordingToBlob }))

const { FakeAudioPlaybackError, playAudioBlob } = vi.hoisted(() => {
  class FakeAudioPlaybackError extends Error {
    code: string
    constructor(code: string, message: string = code) {
      super(message)
      this.name = 'AudioPlaybackError'
      this.code = code
    }
  }
  return {
    FakeAudioPlaybackError,
    playAudioBlob: vi.fn(),
  }
})
vi.mock('./audio-playback', () => ({ AudioPlaybackError: FakeAudioPlaybackError, playAudioBlob }))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('./report-error', () => ({ reportError }))

import {
  __resetTtsState,
  buildSentencePrompt,
  isTtsSupported,
  listDeviceVoices,
  onVoicesChanged,
  pickVoice,
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

/** Recording playback mock that rejects with "aborted" when its signal fires. */
function abortablePlayback() {
  playAudioBlob.mockImplementation(
    (_blob: unknown, signal: AbortSignal) =>
      new Promise<void>((_resolve, reject) => {
        if (signal.aborted) reject(new FakeAudioPlaybackError('aborted'))
        else signal.addEventListener('abort', () => reject(new FakeAudioPlaybackError('aborted')))
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

  describe('speak', () => {
    it('does nothing for empty or whitespace-only text', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)

      await speak('   ')

      expect(synth.cancel).not.toHaveBeenCalled()
      expect(createdUtterances).toHaveLength(0)
    })

    it('does not throw when nothing can speak', async () => {
      await expect(speak('hello')).resolves.toBeUndefined()
    })

    it('speaks with the built-in voice', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)

      await speak('  cake  ')

      expect(synth.cancel).toHaveBeenCalled()
      expect(synth.speak).toHaveBeenCalledTimes(1)
      expect(createdUtterances).toHaveLength(1)
      expect(createdUtterances[0]).toMatchObject({ text: 'cake', lang: 'en-US', rate: 0.9 })
    })

    it('plays the teacher recording instead of the built-in voice', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)
      isRecordingStorageSupported.mockReturnValue(true)
      const recording = { text: 'cake', audio: new ArrayBuffer(8), mimeType: 'audio/webm', recordedAt: 1 }
      getRecording.mockResolvedValue(recording)

      await speak('cake')

      expect(getRecording).toHaveBeenCalledWith('cake')
      expect(recordingToBlob).toHaveBeenCalledWith(recording)
      expect(playAudioBlob).toHaveBeenCalled()
      expect(synth.speak).not.toHaveBeenCalled()
    })

    it('falls through to the built-in voice when the recording lookup fails', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)
      isRecordingStorageSupported.mockReturnValue(true)
      getRecording.mockRejectedValue(new Error('idb down'))

      await speak('cake')

      expect(synth.speak).toHaveBeenCalledTimes(1)
    })

    it('falls through to the built-in voice when the recording cannot play', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)
      isRecordingStorageSupported.mockReturnValue(true)
      getRecording.mockResolvedValue({ text: 'cake' })
      playAudioBlob.mockRejectedValue(new FakeAudioPlaybackError('playback'))

      await speak('cake')

      expect(synth.speak).toHaveBeenCalledTimes(1)
    })

    it('stops a recording in flight without falling back when superseded', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)
      isRecordingStorageSupported.mockReturnValue(true)
      getRecording.mockImplementation(async (text: string) => (text === 'first' ? { text } : null))
      abortablePlayback()

      const first = speak('first')
      await speak('second')

      await expect(first).resolves.toBeUndefined()
      // The aborted recording never fell back to the built-in voice.
      expect(synth.speak).toHaveBeenCalledTimes(1)
    })

    it('does not fall back when the recording is aborted', async () => {
      const synth = makeSynth()
      stubSpeechSynthesis(synth)
      isRecordingStorageSupported.mockReturnValue(true)
      getRecording.mockResolvedValue({ text: 'cake' })
      abortablePlayback()

      const pending = speak('cake')
      stopSpeaking()
      await expect(pending).resolves.toBeUndefined()

      expect(synth.speak).not.toHaveBeenCalled()
    })

    it('reports when the built-in voice throws', async () => {
      stubSpeechSynthesis(
        makeSynth({
          speak: vi.fn(() => {
            throw new Error('speak failed')
          }),
        })
      )

      await expect(speak('cake')).resolves.toBeUndefined()
      expect(reportError).toHaveBeenCalled()
    })

    it('is a no-op when TTS is unsupported', async () => {
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
