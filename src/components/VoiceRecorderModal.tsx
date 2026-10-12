'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MicIcon, MicOffIcon, PlayIcon, PauseIcon, SquareIcon, RotateCcwIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  isAudioCaptureSupported,
  isRecordingStorageSupported,
  saveRecording,
  startRecording,
  type RecordingSession,
} from '@/lib/voice-recordings'
import { reportError } from '@/lib/report-error'

/** Maximum recording length. Long enough for any single word, short enough to stay snappy. */
const MAX_RECORDING_SECONDS = 60
/** Warn once when this many seconds remain. */
const WARNING_SECONDS_REMAINING = 30
/** Recordings shorter than this are almost certainly an accidental tap. */
const MIN_RECORDING_SECONDS = 2

type Phase = 'checking' | 'ready' | 'denied' | 'unsupported' | 'recording' | 'review'

interface VoiceRecorderModalProps {
  /** The word being recorded. */
  word: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Maximum recording length in seconds. Defaults to 60. */
  maxSeconds?: number
  /** Warn once when this many seconds remain. Defaults to 30. */
  warningSeconds?: number
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Modal flow for recording the teacher's voice for one word.
 *
 * Phases: checking (mic permission) -> ready (press Record) -> recording
 * (live waveform, timer, auto-stop at the cap) -> review (playback, Save or
 * Re-record). A denied microphone shows in-modal steps to re-enable it.
 * Nothing records until the teacher presses Record.
 */
export default function VoiceRecorderModal({
  word,
  open,
  onOpenChange,
  maxSeconds = MAX_RECORDING_SECONDS,
  warningSeconds = WARNING_SECONDS_REMAINING,
}: VoiceRecorderModalProps) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [elapsed, setElapsed] = useState(0)
  const [warned, setWarned] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [saving, setSaving] = useState(false)

  const sessionRef = useRef<RecordingSession | null>(null)
  const recordedBlobRef = useRef<Blob | null>(null)
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number>(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stoppedAtCapRef = useRef(false)

  const cleanupRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    cancelAnimationFrame(animationRef.current)
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null
    sessionRef.current?.cancel()
    sessionRef.current = null
  }, [])

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setAudioUrl((url) => {
      if (url) URL.revokeObjectURL(url)
      return null
    })
    setPlaying(false)
  }, [])

  // Refs so the open/close effect only re-runs when `open` changes,
  // not when the cleanup callbacks are recreated.
  const cleanupRecordingRef = useRef(cleanupRecording)
  const cleanupAudioRef = useRef(cleanupAudio)
  useEffect(() => {
    cleanupRecordingRef.current = cleanupRecording
    cleanupAudioRef.current = cleanupAudio
  })

  // Reset everything when the modal opens; clean up when it closes.
  useEffect(() => {
    if (!open) {
      cleanupRecordingRef.current()
      cleanupAudioRef.current()
      return
    }
    setPhase('checking')
    setElapsed(0)
    setWarned(false)
    setNotice(null)
    setAudioDuration(0)
    setSaving(false)
    stoppedAtCapRef.current = false
    recordedBlobRef.current = null

    if (!isRecordingStorageSupported() || !isAudioCaptureSupported()) {
      setPhase('unsupported')
      return
    }
    // Check the cached permission state so a denied mic shows the help
    // UI immediately instead of a prompt that will never appear.
    const permissions = navigator.permissions as Permissions | undefined
    if (typeof permissions?.query !== 'function') {
      setPhase('ready')
      return
    }
    let cancelled = false
    permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        if (!cancelled) setPhase(status.state === 'denied' ? 'denied' : 'ready')
      })
      .catch(() => {
        if (!cancelled) setPhase('ready')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // Full cleanup on unmount.
  useEffect(() => {
    return () => {
      cleanupRecordingRef.current()
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  const drawLiveWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const data = new Uint8Array(analyser.frequencyBinCount)
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const draw = (): void => {
      animationRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      const barCount = 48
      const barWidth = width / barCount
      for (let i = 0; i < barCount; i++) {
        // Sample across the frequency bins for a lively, voice-like shape.
        const value = data[Math.floor((i / barCount) * data.length * 0.7)] ?? 0
        const barHeight = reducedMotion ? height * 0.2 : Math.max(3, (value / 255) * height)
        const x = i * barWidth
        const y = (height - barHeight) / 2
        ctx.fillStyle = '#0e7490'
        const gap = 2
        ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight)
      }
    }
    draw()
  }, [])

  // Start the live waveform once the recording canvas has rendered.
  useEffect(() => {
    if (phase === 'recording') drawLiveWaveform()
  }, [phase, drawLiveWaveform])

  const drawReviewWaveform = useCallback((blob: Blob) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const audioContext = new AudioContextClass()
    blob
      .arrayBuffer()
      .then((buffer) => audioContext.decodeAudioData(buffer))
      .then((audioBuffer) => {
        const channelData = audioBuffer.getChannelData(0)
        const { width, height } = canvas
        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = '#0e7490'
        const barCount = 96
        const step = Math.floor(channelData.length / barCount)
        for (let i = 0; i < barCount; i++) {
          let max = 0
          for (let j = 0; j < step; j += 10) {
            const sample = Math.abs(channelData[i * step + j] ?? 0)
            if (sample > max) max = sample
          }
          const barHeight = Math.max(3, max * height)
          const x = (i / barCount) * width
          const y = (height - barHeight) / 2
          ctx.fillRect(x, y, Math.max(1, width / barCount - 2), barHeight)
        }
        return audioContext.close().catch(() => {})
      })
      .catch((error: unknown) => {
        reportError(error, { location: 'VoiceRecorderModal.drawReviewWaveform' })
        audioContext.close().catch(() => {})
      })
  }, [])

  // Draw the review waveform once the review canvas has rendered.
  useEffect(() => {
    if (phase === 'review' && recordedBlobRef.current) {
      drawReviewWaveform(recordedBlobRef.current)
    }
  }, [phase, drawReviewWaveform])

  const stopAndReview = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return
    sessionRef.current = null
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    cancelAnimationFrame(animationRef.current)
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null
    try {
      const blob = await session.stop()
      recordedBlobRef.current = blob
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.addEventListener('loadedmetadata', () => {
        setAudioDuration(audio.duration)
      })
      audio.addEventListener('ended', () => setPlaying(false))
      setPhase('review')
    } catch (error) {
      reportError(error, { location: 'VoiceRecorderModal.stopAndReview' })
      setNotice('Could not finish the recording. Try again.')
      setPhase('ready')
    }
  }, [drawReviewWaveform])

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    setElapsed(0)
    setWarned(false)
    stoppedAtCapRef.current = false
    timerRef.current = setInterval(() => {
      const seconds = (Date.now() - startTimeRef.current) / 1000
      setElapsed(seconds)
      if (seconds >= maxSeconds - warningSeconds && !stoppedAtCapRef.current) {
        setWarned((already) => {
          if (!already) {
            // Announced once via the alert region below.
          }
          return true
        })
      }
      if (seconds >= maxSeconds) {
        stoppedAtCapRef.current = true
        void stopAndReview()
      }
    }, 250)
  }, [stopAndReview, maxSeconds, warningSeconds])

  const handleRecord = async () => {
    setNotice(null)
    try {
      const session = await startRecording()
      // The modal may have closed while the permission prompt was open.
      if (!openRef.current) {
        session.cancel()
        return
      }
      sessionRef.current = session
      // Live visualization taps the mic stream; never routed to speakers.
      if (session.stream) {
        try {
          const AudioContextClass =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          if (AudioContextClass) {
            const audioContext = new AudioContextClass()
            audioContextRef.current = audioContext
            const source = audioContext.createMediaStreamSource(session.stream)
            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 256
            source.connect(analyser)
            analyserRef.current = analyser
          }
        } catch (error) {
          reportError(error, { location: 'VoiceRecorderModal.visualizer' })
        }
      }
      setPhase('recording')
      startTimer()
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPhase('denied')
      } else {
        reportError(error, { location: 'VoiceRecorderModal.handleRecord' })
        setNotice('Microphone unavailable. Try again.')
      }
    }
  }

  const handleSave = async () => {
    const blob = recordedBlobRef.current
    if (!blob || saving) return
    setSaving(true)
    try {
      await saveRecording(word, blob)
      onOpenChange(false)
    } catch (error) {
      reportError(error, { location: 'VoiceRecorderModal.handleSave' })
      setNotice('Could not save the recording. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleRerecord = () => {
    cleanupAudio()
    recordedBlobRef.current = null
    setAudioDuration(0)
    setPhase('ready')
  }

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.currentTime = 0
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false)
      )
    }
  }

  const handleRetryPermission = () => {
    setPhase('checking')
    const permissions = navigator.permissions as Permissions | undefined
    if (typeof permissions?.query !== 'function') {
      setPhase('ready')
      return
    }
    permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => setPhase(status.state === 'denied' ? 'denied' : 'ready'))
      .catch(() => setPhase('ready'))
  }

  const secondsLeft = Math.max(0, Math.ceil(maxSeconds - elapsed))
  const tooShort = audioDuration > 0 && audioDuration < MIN_RECORDING_SECONDS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Record your voice</DialogTitle>
          <DialogDescription>
            Record yourself saying <strong className="text-ink">{word}</strong>. Your recording plays instead of the
            built-in voice whenever this word is read aloud.
          </DialogDescription>
        </DialogHeader>

        <div role="status" aria-live="polite" className="sr-only">
          {phase === 'recording' && 'Recording. Speak now.'}
          {phase === 'review' && 'Recording stopped. Review it, then save or re-record.'}
        </div>
        {warned && phase === 'recording' && (
          <p role="alert" className="text-sm font-semibold text-amber-700">
            {secondsLeft} seconds left. The recording stops automatically at {maxSeconds} seconds.
          </p>
        )}
        {notice && (
          <p role="alert" className="text-sm font-semibold text-coral-ink">
            {notice}
          </p>
        )}

        {phase === 'checking' && (
          <p className="py-6 text-center text-sm text-muted-foreground">Checking the microphone.</p>
        )}

        {phase === 'unsupported' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Voice recording is not supported in this browser. Try Chrome or Edge on a laptop or desktop.
            </p>
            <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full">
              Close
            </Button>
          </div>
        )}

        {phase === 'denied' && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-coral-soft text-coral-ink">
                <MicOffIcon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-bold text-ink">Microphone is blocked</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  PatternSpell needs microphone access to record your voice. Recordings stay on this device and are
                  never uploaded.
                </p>
              </div>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Click the lock or tune icon in the address bar.</li>
              <li>Find Microphone in the site settings.</li>
              <li>Change it to Allow.</li>
              <li>Come back here and tap Try again.</li>
            </ol>
            <div className="flex gap-2">
              <Button onClick={handleRetryPermission} className="flex-1">
                Try again
              </Button>
              <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        )}

        {phase === 'ready' && (
          <div className="space-y-4 py-2">
            <p className="text-center text-sm text-muted-foreground">
              Nothing records until you press the button. Recordings can be up to {maxSeconds} seconds.
            </p>
            <Button onClick={handleRecord} className="w-full" size="lg">
              <MicIcon className="size-5" aria-hidden="true" />
              Record
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
              Cancel
            </Button>
          </div>
        )}

        {phase === 'recording' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center gap-2">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-red-600" />
              </span>
              <span
                role="timer"
                aria-label={`Recording for ${formatTime(elapsed)}`}
                className="text-2xl font-bold tabular-nums text-ink"
              >
                {formatTime(elapsed)}
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={384}
              height={96}
              className="h-24 w-full rounded-[12px] bg-sky-soft"
              aria-hidden="true"
            />
            <Button variant="secondary" onClick={() => void stopAndReview()} className="w-full" size="lg">
              <SquareIcon className="size-5" aria-hidden="true" />
              Stop
            </Button>
          </div>
        )}

        {phase === 'review' && (
          <div className="space-y-4 py-2">
            <canvas
              ref={canvasRef}
              width={384}
              height={96}
              className="h-24 w-full rounded-[12px] bg-sky-soft"
              aria-hidden="true"
            />
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                onClick={togglePlayback}
                aria-label={playing ? 'Pause the recording' : 'Play the recording'}
                className="flex size-12 items-center justify-center rounded-full p-0"
              >
                {playing ? (
                  <PauseIcon className="size-5" aria-hidden="true" />
                ) : (
                  <PlayIcon className="size-5" aria-hidden="true" />
                )}
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">{formatTime(audioDuration)} recorded</span>
            </div>
            {tooShort && (
              <p className="text-center text-sm font-semibold text-coral-ink">
                That recording is very short. Re-record to make sure it captured your voice.
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={() => void handleSave()} disabled={saving || tooShort} className="flex-1">
                {saving ? 'Saving.' : 'Save recording'}
              </Button>
              <Button variant="secondary" onClick={handleRerecord} disabled={saving} className="flex-1">
                <RotateCcwIcon className="size-4" aria-hidden="true" />
                Re-record
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
