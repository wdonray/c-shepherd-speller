'use client'

import { useEffect, useState } from 'react'
import {
  getPreferredVoiceUri,
  isTtsSupported,
  listDeviceVoices,
  onVoicesChanged,
  setPreferredVoiceUri,
} from '@/lib/tts'

/**
 * Device voice picker for the read-aloud fallback. The teacher picks the
 * clearest voice installed on this device; it is used whenever the neural
 * voice service cannot be reached. The choice persists per device in
 * localStorage. Renders nothing where speech synthesis is unavailable.
 */
export default function VoicePicker() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listDeviceVoices())
  const [selectedUri, setSelectedUri] = useState<string>(() => getPreferredVoiceUri() ?? '')

  useEffect(() => onVoicesChanged(() => setVoices(listDeviceVoices())), [])

  if (!isTtsSupported()) return null

  const handleChange = (value: string) => {
    setSelectedUri(value)
    setPreferredVoiceUri(value === '' ? null : value)
  }

  return (
    <div>
      <label htmlFor="voice-picker" className="text-[15px] font-bold text-ink">
        Device voice
      </label>
      <select
        id="voice-picker"
        value={selectedUri}
        onChange={(event) => handleChange(event.target.value)}
        className="mt-2 block w-full cursor-pointer rounded-[12px] border-2 border-line bg-card px-4 py-3 text-[15px] text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <option value="">Automatic (best available)</option>
        {voices.map((voice) => (
          <option key={voice.voiceURI} value={voice.voiceURI}>
            {voice.name} ({voice.lang})
          </option>
        ))}
      </select>
      <p className="mt-2 text-sm text-muted-foreground">
        The backup voice when the natural voice service cannot be reached. Pick the clearest voice on this device.
      </p>
    </div>
  )
}
