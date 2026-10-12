import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import VoicePicker from './VoicePicker'
import { getPreferredVoiceUri } from '@/lib/tts'

function fakeVoice(name: string, lang: string, voiceURI: string): SpeechSynthesisVoice {
  return { name, lang, voiceURI } as SpeechSynthesisVoice
}

const voices = [
  fakeVoice('Google US English', 'en-US', 'uri-us'),
  fakeVoice('Daniel', 'en-GB', 'uri-gb'),
  fakeVoice('Google francais', 'fr-FR', 'uri-fr'),
]

describe('VoicePicker', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when speech synthesis is unavailable', () => {
    const { container } = render(<VoicePicker />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists English voices and persists the teacher choice', () => {
    const listeners = new Map<string, Array<() => void>>()
    vi.stubGlobal('speechSynthesis', {
      speak: () => {},
      cancel: () => {},
      getVoices: () => voices,
      addEventListener: (event: string, listener: () => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), listener])
      },
      removeEventListener: (event: string, listener: () => void) => {
        listeners.set(
          event,
          (listeners.get(event) ?? []).filter((l) => l !== listener)
        )
      },
    })

    render(<VoicePicker />)
    const select = screen.getByLabelText('Device voice')
    // Only English voices are listed.
    expect(select.querySelectorAll('option')).toHaveLength(3) // Automatic + 2 English

    fireEvent.change(select, { target: { value: 'uri-gb' } })
    expect(getPreferredVoiceUri()).toBe('uri-gb')

    fireEvent.change(select, { target: { value: '' } })
    expect(getPreferredVoiceUri()).toBeNull()
  })

  it('starts with the stored preference selected', () => {
    vi.stubGlobal('speechSynthesis', {
      speak: () => {},
      cancel: () => {},
      getVoices: () => voices,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    window.localStorage.setItem('patternspell-fallback-voice-uri', 'uri-us')

    render(<VoicePicker />)
    expect(screen.getByLabelText('Device voice')).toHaveValue('uri-us')
  })

  it('refreshes the list when voices load asynchronously', () => {
    const listeners = new Map<string, Array<() => void>>()
    let current = [voices[0]]
    vi.stubGlobal('speechSynthesis', {
      speak: () => {},
      cancel: () => {},
      getVoices: () => current,
      addEventListener: (event: string, listener: () => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), listener])
      },
      removeEventListener: () => {},
    })

    render(<VoicePicker />)
    expect(screen.getByLabelText('Device voice').querySelectorAll('option')).toHaveLength(2)

    current = voices
    act(() => {
      listeners.get('voiceschanged')?.forEach((l) => l())
    })
    expect(screen.getByLabelText('Device voice').querySelectorAll('option')).toHaveLength(3)
  })
})
