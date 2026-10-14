'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MicIcon, MicOffIcon, PlayIcon, PauseIcon, SquareIcon, RotateCcwIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  isAudioCaptureSupported,
  isRecordingStorageSupported,
  requestMicrophoneStream,
  saveRecording,
  startRecording,
  MICROPHONE_REQUEST_TIMEOUT_MS,
  type MicrophoneRequest,
  type RecordingSession,
} from '@/lib/voice-recordings'
import { drawLiveWaveform, drawReviewWaveform } from '@/lib/waveform-draw'
import { reportError } from '@/lib/report-error'

/** Maximum recording length. Long enough for any single word, short enough to stay snappy. */
const MAX_RECORDING_SECONDS = 60
/** Warn once when this many seconds remain. */
const WARNING_SECONDS_REMAINING = 30
/** Recordings shorter than this are almost certainly an accidental tap. */
const MIN_RECORDING_SECONDS = 2

type Phase = 'checking' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'unsupported' | 'recording' | 'review'

interface VoiceRecorderModalProps {
  /** The word being recorded. */
  word: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * In-flight microphone permission request started by the opener directly
   * from its click gesture. Browsers only show the permission prompt for
   * requests made in a user gesture, so the opener asks and this modal
   * awaits the answer instead of asking again from an effect, where the
   * request would be silently dropped. When absent, the modal falls back to
   * asking from the Record button's own tap.
   */
  microphoneRequest?: MicrophoneRequest | null
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
 * Phases: checking (mic support and permission preflight) -> ready (press
 * Record) -> requesting (waiting on the browser prompt) -> recording (live
 * waveform, timer, auto-stop at the cap) -> review (playback, Save or
 * Re-record). A denied microphone shows in-modal steps to re-enable it.
 * Nothing records until the teacher presses Record.
 *
 * The permission prompt must be requested from a user gesture: browsers
 * silently drop permission requests made from effects or promise callbacks,
 * showing no prompt and never settling. So the opener asks from its click
 * and this modal awaits the answer (the microphoneRequest prop); without
 * that prop, the request happens in the Record button's own tap instead.
 * The open-time permissions check is only a preflight hint so an
 * already-blocked microphone shows the recovery UI immediately.
 */
export default function VoiceRecorderModal({
  word,
  open,
  onOpenChange,
  microphoneRequest = null,
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
  /** Stream granted by the opener's permission request, waiting for Record. */
  const pendingStreamRef = useRef<MediaStream | null>(null)
  /** Aborts the in-flight permission request when the modal closes. */
  const permissionAbortRef = useRef<AbortController | null>(null)
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])
  // If the modal unmounts while startRecording is awaiting permission,
  // the guard in handleRecord must see a closed modal.
  useEffect(() => {
    return () => {
      openRef.current = false
    }
  }, [])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const waveformCleanupRef = useRef<(() => void) | null>(null)
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
    waveformCleanupRef.current?.()
    waveformCleanupRef.current = null
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

  // Cancellation flag for the async permission flow, shared by the open
  // effect and the Try again retry so a late rejection never updates state.
  const permissionCancelledRef = useRef(false)
  /**
   * Generation counter for the opener's warmup request. The open effect can
   * run setup/cleanup/setup (React StrictMode double-invokes effects in
   * development); only the latest setup's handlers may claim the granted
   * stream, so a stale setup never stops a stream the live setup just
   * received.
   */
  const warmupGenerationRef = useRef(0)

  /** Map a microphone permission failure onto the matching modal phase. */
  const mapPermissionError = useCallback((error: unknown) => {
    const name = error instanceof DOMException ? error.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      setPhase('denied')
    } else if (name === 'TimeoutError') {
      // The browser never answered the prompt. Give the teacher a way
      // forward instead of hanging on the spinner.
      setNotice(
        'The browser did not show a permission prompt. Click the lock or tune icon in the address bar, set Microphone to Allow, then press Record again.'
      )
      setPhase('ready')
    } else if (name === 'AbortError') {
      setPhase('ready')
    } else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') {
      setPhase('unavailable')
    } else {
      reportError(error, { location: 'VoiceRecorderModal.handleRecord' })
      setNotice('Microphone unavailable. Try again.')
      setPhase('ready')
    }
  }, [])

  const checkMicrophonePermission = useCallback(() => {
    // Preflight hint only: when the microphone is already blocked, show the
    // recovery UI immediately. Otherwise stay on ready; the actual request
    // waits for a user gesture (the opener's click or the Record press),
    // which is what browsers require before they will show the prompt.
    const permissions = navigator.permissions as Permissions | undefined
    if (typeof permissions?.query !== 'function') {
      setPhase('ready')
      return
    }
    let query: Promise<PermissionStatus>
    try {
      query = permissions.query({ name: 'microphone' as PermissionName })
    } catch {
      // Some browsers throw synchronously for permission names they do not
      // recognize. Fall through to the gesture-driven request instead.
      setPhase('ready')
      return
    }
    query.then(
      (status) => {
        if (!permissionCancelledRef.current) setPhase(status.state === 'denied' ? 'denied' : 'ready')
      },
      () => {
        if (!permissionCancelledRef.current) setPhase('ready')
      }
    )
  }, [])

  /** Release a granted-but-unused warmup stream so the mic light goes out. */
  const releasePendingStream = useCallback(() => {
    pendingStreamRef.current?.getTracks().forEach((track) => track.stop())
    pendingStreamRef.current = null
  }, [])

  // Reset everything when the modal opens; clean up when it closes.
  useEffect(() => {
    if (!open) {
      permissionAbortRef.current?.abort()
      permissionAbortRef.current = null
      releasePendingStream()
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
    permissionCancelledRef.current = false
    if (microphoneRequest) {
      // The opener asked for microphone access from its click gesture.
      // Await the answer here instead of asking again from this effect,
      // where the request would be silently dropped with no prompt.
      setPhase('requesting')
      const generation = ++warmupGenerationRef.current
      microphoneRequest.promise.then(
        (stream) => {
          // A stale setup (superseded by a newer effect run) must not
          // touch the stream; the live setup owns it.
          if (generation !== warmupGenerationRef.current) return
          if (permissionCancelledRef.current) {
            stream.getTracks().forEach((track) => track.stop())
            return
          }
          pendingStreamRef.current = stream
          setPhase('ready')
        },
        (error: unknown) => {
          if (generation !== warmupGenerationRef.current) return
          if (!permissionCancelledRef.current) mapPermissionError(error)
        }
      )
    } else {
      // No opener request (or an unsupported browser): preflight hint only.
      // The real request waits for the Record press's user gesture.
      checkMicrophonePermission()
    }
    return () => {
      permissionCancelledRef.current = true
    }
  }, [open, microphoneRequest, checkMicrophonePermission, mapPermissionError, releasePendingStream])

  // Full cleanup on unmount.
  useEffect(() => {
    return () => {
      permissionAbortRef.current?.abort()
      permissionAbortRef.current = null
      releasePendingStream()
      cleanupRecordingRef.current()
      if (audioRef.current) audioRef.current.pause()
    }
  }, [releasePendingStream])

  // Start the live waveform once the recording canvas has rendered.
  useEffect(() => {
    if (phase === 'recording') {
      waveformCleanupRef.current = drawLiveWaveform(canvasRef.current, analyserRef.current)
      return () => {
        waveformCleanupRef.current?.()
        waveformCleanupRef.current = null
      }
    }
  }, [phase])

  // Draw the review waveform once the review canvas has rendered.
  useEffect(() => {
    if (phase === 'review' && recordedBlobRef.current) {
      drawReviewWaveform(canvasRef.current, recordedBlobRef.current, (error) =>
        reportError(error, { location: 'VoiceRecorderModal.drawReviewWaveform' })
      )
    }
  }, [phase])

  const stopAndReview = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return
    sessionRef.current = null
    clearInterval(timerRef.current!)
    timerRef.current = null
    waveformCleanupRef.current?.()
    waveformCleanupRef.current = null
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    analyserRef.current = null
    try {
      const blob = await session.stop()
      // WebM blobs can report Infinity for duration; fall back to measured time.
      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000
      recordedBlobRef.current = blob
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration
        setAudioDuration(Number.isFinite(duration) ? duration : elapsedSeconds)
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
    const aborter = new AbortController()
    permissionAbortRef.current = aborter
    // Prefer the stream the opener pre-authorized from its click gesture;
    // otherwise ask here, in this tap's gesture, which is what browsers
    // require before they will show the permission prompt.
    let stream: MediaStream | null = pendingStreamRef.current
    pendingStreamRef.current = null
    try {
      if (!stream) {
        setPhase('requesting')
        stream = await requestMicrophoneStream(MICROPHONE_REQUEST_TIMEOUT_MS, aborter.signal)
      }
      // The modal may have closed while the permission prompt was open.
      if (!openRef.current) return
      const session = await startRecording(stream)
      // Ownership of the stream moves to the session; stop()/cancel()
      // release it from here on.
      stream = null
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
      // The modal may have closed while the permission prompt was open.
      if (!openRef.current) return
      mapPermissionError(error)
    } finally {
      // A stream that never made it into a session (request failed, or the
      // modal closed first) is released here so the mic light goes out.
      stream?.getTracks().forEach((track) => track.stop())
      if (permissionAbortRef.current === aborter) permissionAbortRef.current = null
    }
  }

  const handleSave = async () => {
    // The Save button only renders in review phase, after the blob is captured,
    // so recordedBlobRef is non-null here. The button disables while saving
    // to prevent double-submit.
    const blob = recordedBlobRef.current!
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
    // The play button only renders in review phase, after the audio element is created.
    const audio = audioRef.current!
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
    permissionCancelledRef.current = false
    checkMicrophonePermission()
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

        {phase === 'requesting' && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Requesting microphone access. Allow access in the browser prompt to continue.
          </p>
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

        {phase === 'unavailable' && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-coral-soft text-coral-ink">
                <MicOffIcon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-bold text-ink">No microphone found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  PatternSpell could not reach a microphone. Make sure one is connected and not in use by another app,
                  then try again.
                </p>
              </div>
            </div>
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
