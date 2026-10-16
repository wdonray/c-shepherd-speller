'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MicIcon, MicOffIcon, PlayIcon, PauseIcon, SquareIcon, RotateCcwIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  deleteRecording,
  getRecording,
  isAudioCaptureSupported,
  isRecordingStorageSupported,
  recordingToBlob,
  requestMicrophoneStream,
  saveRecording,
  startRecording,
  MICROPHONE_REQUEST_TIMEOUT_MS,
  type MicrophoneRequest,
  type RecordingSession,
  type VoiceRecording,
} from '@/lib/voice-recordings'
import { drawLiveWaveform, drawReviewWaveform } from '@/lib/waveform-draw'
import { notifyRecordingSaved, notifyRecordingDeleted } from '@/lib/voice-sync'
import { reportError } from '@/lib/report-error'

/** Maximum recording length. Long enough for any single word, short enough to stay snappy. */
const MAX_RECORDING_SECONDS = 60
/** Warn once when this many seconds remain. */
const WARNING_SECONDS_REMAINING = 30
/** Recordings shorter than this are almost certainly an accidental tap. */
const MIN_RECORDING_SECONDS = 2

/** Browser families with meaningfully different microphone-blocked recovery UI. */
type BrowserFamily = 'chromium' | 'safari' | 'firefox' | 'unknown'

/**
 * Best-effort browser detection from the user agent, used only to pick the
 * right recovery instructions on the denied screen. Chrome on iOS (CriOS)
 * uses WebKit with Safari-style UI, so it maps to 'safari'.
 */
function detectBrowserFamily(): BrowserFamily {
  // Client component: navigator always exists here.
  const ua = navigator.userAgent
  if (/firefox|fxios/i.test(ua)) return 'firefox'
  if (/crios/i.test(ua)) return 'safari'
  if (/chrome|chromium|edg|opr/i.test(ua)) return 'chromium'
  if (/safari/i.test(ua)) return 'safari'
  return 'unknown'
}

/**
 * Schematic of the address-bar blocked-microphone icon, so a teacher can
 * match the instructions to what they see. Deliberately schematic, not a
 * pixel-perfect browser mock.
 */
function AddressBarHint() {
  return (
    <div className="flex items-center gap-3 rounded-[12px] bg-muted px-3 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-coral-soft text-coral-ink ring-2 ring-coral">
        <MicOffIcon className="size-4" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">Look for this blocked microphone icon in your address bar.</p>
    </div>
  )
}

/**
 * Browser-specific recovery steps for the denied phase. Chrome removed the
 * address-bar lock icon in 2023, so the Chromium path leads with the one-click
 * blocked-microphone icon instead of the longer site-settings detour. Never
 * says "lock icon": that UI no longer exists.
 */
function DeniedSteps({ family }: { family: BrowserFamily }) {
  if (family === 'safari') {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>In the menu bar at the very top of your screen, open the Safari menu.</li>
        <li>Choose Settings, then Websites, then Microphone.</li>
        <li>Find this site in the list and set it to Allow.</li>
        <li>Come back here and tap Try again.</li>
      </ol>
    )
  }
  if (family === 'firefox') {
    return (
      <>
        <AddressBarHint />
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Click the microphone icon in the address bar.</li>
          <li>Choose Allow.</li>
          <li>Come back here and tap Try again.</li>
        </ol>
      </>
    )
  }
  if (family === 'chromium') {
    return (
      <>
        <AddressBarHint />
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Click the microphone icon with a line through it, in the address bar at the top of your browser.</li>
          <li>Choose Allow.</li>
          <li>Come back here and tap Try again.</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          Do not see that icon? Click the tune icon in the address bar, open Site settings, set Microphone to Allow,
          then tap Try again.
        </p>
      </>
    )
  }
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
      <li>Open your browser's site settings for this page.</li>
      <li>Set Microphone to Allow.</li>
      <li>Come back here and tap Try again.</li>
    </ol>
  )
}

/** One-line recovery hint for the no-prompt notice, matched to the browser. */
function permissionPromptHint(family: BrowserFamily): string {
  switch (family) {
    case 'chromium':
      return 'Click the microphone icon with a line through it in the address bar, set it to Allow, then press Record again.'
    case 'safari':
      return 'Open the Safari menu, then Settings, then Websites, then Microphone, set this site to Allow, then press Record again.'
    case 'firefox':
      return 'Click the microphone icon in the address bar, choose Allow, then press Record again.'
    default:
      return "Open your browser's site settings for this page, set Microphone to Allow, then press Record again."
  }
}

type Phase =
  'checking' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'unsupported' | 'recording' | 'review' | 'saved'

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
  /**
   * Called with the trimmed word after a recording saves successfully, so
   * the opener can mark the word as recorded without re-reading storage.
   */
  onSaved?: (word: string) => void
  /**
   * Called with the trimmed word after its recording is deleted, so the
   * opener can unmark the word without re-reading storage.
   */
  onDeleted?: (word: string) => void
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Modal flow for recording the teacher's voice for one word.
 *
 * Phases: checking (mic support and permission preflight, plus a look for a
 * saved recording) -> saved (a previous recording: play it, record a new
 * one, or delete it) -> ready (press Record) -> requesting (waiting on the
 * browser prompt) -> recording (live waveform, timer, auto-stop at the cap)
 * -> review (playback, Save or Re-record). Saving lands on the saved phase
 * so the teacher sees the recording is really there. A denied microphone
 * shows in-modal steps to re-enable it. Nothing records until the teacher
 * presses Record.
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
  onSaved,
  onDeleted,
}: VoiceRecorderModalProps) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [elapsed, setElapsed] = useState(0)
  const [warned, setWarned] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [saving, setSaving] = useState(false)
  /** Two-step delete confirmation: the first tap arms, the second deletes. */
  const [confirmingDelete, setConfirmingDelete] = useState(false)

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

  /**
   * Wire a recorded blob up for playback: object URL, audio element, and
   * duration. Mobile Safari may never fire loadedmetadata, so the review
   * starts from the measured recording time and only refines when the
   * browser reports real, finite metadata. Shared by the review phase (the
   * take just captured) and the saved phase (a recording read from storage).
   */
  const attachAudio = useCallback(
    (blob: Blob, durationFallback: number) => {
      cleanupAudio()
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setAudioDuration(durationFallback)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration
        // Only trust positive, finite metadata. Some browsers report 0 for a
        // recording that lasted seconds, which would show "00:00 recorded".
        if (Number.isFinite(duration) && duration > 0) setAudioDuration(duration)
      })
      audio.addEventListener('ended', () => setPlaying(false))
    },
    [cleanupAudio]
  )

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
      setNotice(`The browser did not show a permission prompt. ${permissionPromptHint(detectBrowserFamily())}`)
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
    setConfirmingDelete(false)
    stoppedAtCapRef.current = false
    recordedBlobRef.current = null

    if (!isRecordingStorageSupported()) {
      setPhase('unsupported')
      return
    }
    let loadCancelled = false
    permissionCancelledRef.current = false
    void (async () => {
      // A saved recording opens in its own phase: the teacher reopens this
      // modal to hear what they saved, and showing only the record screen
      // made saved recordings look lost (#328). Playback needs no
      // microphone, so this runs even when capture is unsupported.
      let existing: VoiceRecording | null = null
      try {
        existing = await getRecording(word)
      } catch (error) {
        reportError(error, { location: 'VoiceRecorderModal.loadExisting' })
      }
      if (loadCancelled) return
      if (existing) {
        attachAudio(recordingToBlob(existing), 0)
        setPhase('saved')
        return
      }
      if (!isAudioCaptureSupported()) {
        setPhase('unsupported')
        return
      }
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
    })()
    return () => {
      loadCancelled = true
      permissionCancelledRef.current = true
    }
  }, [open, word, microphoneRequest, checkMicrophonePermission, mapPermissionError, releasePendingStream, attachAudio])

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
      // Mobile Safari may never fire loadedmetadata for the review audio,
      // and WebM blobs can report Infinity for duration. Start from the
      // measured recording time so the review never shows 00:00, then
      // refine when the browser reports real, finite metadata.
      const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000
      recordedBlobRef.current = blob
      attachAudio(blob, elapsedSeconds)
      setPhase('review')
    } catch (error) {
      reportError(error, { location: 'VoiceRecorderModal.stopAndReview' })
      setNotice('Could not finish the recording. Try again.')
      setPhase('ready')
    }
  }, [drawReviewWaveform, attachAudio])

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
      const saved = await saveRecording(word, blob)
      onSaved?.(saved.text)
      // Stay open on the saved recording instead of closing: the teacher
      // just saved this take and should see it is really there (#328). The
      // review audio element is already wired to the saved blob.
      setNotice(null)
      setPhase('saved')
      // Sync to the teacher's other devices in the background; never blocks
      // the UI. A full cloud storage reports back so we can explain it.
      void notifyRecordingSaved(saved).then((result) => {
        if (result === 'quota-full') {
          setNotice(
            'Your voice storage is full. This recording is saved on this device. Delete some recordings to make room for syncing.'
          )
        }
      })
    } catch (error) {
      reportError(error, { location: 'VoiceRecorderModal.handleSave' })
      setNotice('Could not save the recording. Try again.')
    } finally {
      setSaving(false)
    }
  }

  /** Leave the saved recording and go back to the record screen. */
  const handleRecordNew = () => {
    setConfirmingDelete(false)
    cleanupAudio()
    recordedBlobRef.current = null
    setAudioDuration(0)
    setPhase('ready')
  }

  const handleRerecord = () => {
    handleRecordNew()
  }

  const handleDelete = async () => {
    // Two-step confirmation: the first tap arms, the second deletes.
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setConfirmingDelete(false)
    setNotice(null)
    try {
      await deleteRecording(word)
      onDeleted?.(word.trim())
      // Remove the cloud copy too (or queue it when offline).
      void notifyRecordingDeleted(word.trim())
      handleRecordNew()
    } catch (error) {
      reportError(error, { location: 'VoiceRecorderModal.handleDelete' })
      setNotice('Could not delete the recording. Try again.')
    }
  }

  const togglePlayback = () => {
    // The play button renders in review and saved phases, after the audio
    // element is created.
    const audio = audioRef.current!
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.currentTime = 0
      void audio.play().then(
        () => setPlaying(true),
        (error: unknown) => {
          // A rejected play() used to fail silently, leaving the teacher
          // tapping a dead button (#328). Say so and report it.
          reportError(error, { location: 'VoiceRecorderModal.togglePlayback' })
          setNotice('Could not play the recording. Try again.')
          setPlaying(false)
        }
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
          <DialogTitle>{phase === 'saved' ? 'Your saved recording' : 'Record your voice'}</DialogTitle>
          <DialogDescription>
            {phase === 'saved' ? (
              <>
                Your recording of <strong className="text-ink">{word}</strong>. It plays instead of the built-in voice
                whenever this word is read aloud.
              </>
            ) : (
              <>
                Record yourself saying <strong className="text-ink">{word}</strong>. Your recording plays instead of the
                built-in voice whenever this word is read aloud.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div role="status" aria-live="polite" className="sr-only">
          {phase === 'recording' && 'Recording. Speak now.'}
          {phase === 'review' && 'Recording stopped. Review it, then save or re-record.'}
          {phase === 'saved' && 'Recording saved. Play it, record a new one, or delete it.'}
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
            <DeniedSteps family={detectBrowserFamily()} />
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

        {phase === 'saved' && (
          <div className="space-y-4 py-2">
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
              <span className="text-sm tabular-nums text-muted-foreground">
                {audioDuration > 0 ? `${formatTime(audioDuration)} recorded` : 'Recording saved'}
              </span>
            </div>
            <div className="flex gap-2">
              {isAudioCaptureSupported() && (
                <Button variant="secondary" onClick={handleRecordNew} className="flex-1">
                  <MicIcon className="size-4" aria-hidden="true" />
                  Record new
                </Button>
              )}
              <Button variant="destructive" onClick={() => void handleDelete()} className="flex-1" aria-live="polite">
                {confirmingDelete ? 'Tap again to confirm' : 'Delete'}
              </Button>
            </div>
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
              Done
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
