'use client'

import { useEffect, useRef, useState } from 'react'
import { MicIcon, PlayIcon, SquareIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { AudioPlaybackError, playAudioBlob } from '@/lib/audio-playback'
import {
  deleteRecording,
  getRecording,
  hasRecording,
  isAudioCaptureSupported,
  isRecordingStorageSupported,
  recordingToBlob,
  saveRecording,
  startRecording,
  type RecordingSession,
} from '@/lib/voice-recordings'
import { reportError } from '@/lib/report-error'

type Status = 'checking' | 'idle' | 'saving' | 'ready' | 'playing'

interface VoiceRecorderProps {
  /** The exact text that will be spoken (and that the recording overrides). */
  text: string
  kind: 'word' | 'sentence'
  /**
   * Compact icon-button rendering for tight spaces (e.g. a table row).
   * Matches the surrounding action buttons instead of the full card.
   */
  compact?: boolean
}

/**
 * Record-your-voice control for one read-aloud text. The teacher records
 * their own voice for the word or sentence; the recording then plays instead
 * of the built-in voice whenever that exact text is spoken.
 * Recordings stay on this device in IndexedDB and are never uploaded.
 * Renders nothing where recording is unsupported.
 */
export default function VoiceRecorder({ text, kind, compact = false }: VoiceRecorderProps) {
  const supported = isRecordingStorageSupported() && isAudioCaptureSupported()
  const [status, setStatus] = useState<Status>('checking')
  const [session, setSession] = useState<RecordingSession | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const sessionRef = useRef<RecordingSession | null>(null)
  const playbackRef = useRef<AbortController | null>(null)
  // Tracks an in-flight startRecording() call so rapid double-taps cannot
  // open two microphone sessions (the first would leak when the second
  // replaces it via setSession).
  const startPendingRef = useRef(false)
  // Bumped when the text changes or the component unmounts, so a
  // startRecording() promise that resolves late gets cancelled instead of
  // attaching a live mic session to stale UI (or no UI at all).
  const generationRef = useRef(0)

  // Mirror the session into a ref so the unmount cleanup sees the latest.
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    if (!supported) return
    generationRef.current += 1
    let cancelled = false
    setStatus('checking')
    setNotice(null)
    // A text change abandons any in-progress recording for the old text.
    setSession(null)
    hasRecording(text)
      .then((exists) => {
        if (!cancelled) setStatus(exists ? 'ready' : 'idle')
      })
      .catch(() => {
        if (!cancelled) setStatus('idle')
      })
    return () => {
      generationRef.current += 1
      cancelled = true
      // Abandon any in-flight recording or playback on unmount or text change.
      sessionRef.current?.cancel()
      sessionRef.current = null
      playbackRef.current?.abort()
      playbackRef.current = null
    }
  }, [text, supported])

  if (!supported) return null

  const noun = kind === 'word' ? 'word' : 'sentence'

  const start = async () => {
    if (startPendingRef.current) return
    startPendingRef.current = true
    setNotice(null)
    const generation = generationRef.current
    try {
      // The recording UI appears only once the mic is live, so a permission
      // prompt never looks like taped silence.
      const next = await startRecording()
      if (generation !== generationRef.current) {
        // Text changed or the component unmounted while the mic was warming
        // up: drop the session instead of attaching it to stale UI.
        next.cancel()
        return
      }
      setSession(next)
    } catch (error) {
      reportError(error, { location: 'VoiceRecorder.start' })
      setNotice('Microphone unavailable. Allow microphone access in your browser, then try again.')
    } finally {
      startPendingRef.current = false
    }
  }

  const stopAndSave = async (activeSession: RecordingSession) => {
    setSession(null)
    setStatus('saving')
    try {
      const audio = await activeSession.stop()
      await saveRecording(text, audio)
      setStatus('ready')
    } catch (error) {
      reportError(error, { location: 'VoiceRecorder.stopAndSave' })
      setNotice('Could not save the recording. Try again.')
      setStatus('idle')
    }
  }

  const play = async () => {
    setNotice(null)
    setStatus('playing')
    const controller = new AbortController()
    playbackRef.current = controller
    try {
      const recording = await getRecording(text)
      if (!recording) {
        setStatus('idle')
        return
      }
      await playAudioBlob(recordingToBlob(recording), controller.signal)
      setStatus('ready')
    } catch (error) {
      if (!(error instanceof AudioPlaybackError) || error.code !== 'aborted') {
        reportError(error, { location: 'VoiceRecorder.play' })
        setNotice('Could not play the recording.')
      }
      setStatus('ready')
    } finally {
      if (playbackRef.current === controller) playbackRef.current = null
    }
  }

  const stopPlayback = () => {
    // The stop button only renders while playing, when the controller is set.
    playbackRef.current!.abort()
  }

  const remove = async () => {
    setNotice(null)
    try {
      await deleteRecording(text)
      setStatus('idle')
    } catch (error) {
      reportError(error, { location: 'VoiceRecorder.remove' })
      setNotice('Could not delete the recording. Try again.')
    }
  }

  if (compact) {
    const iconButton =
      'flex size-11 cursor-pointer items-center justify-center rounded-full p-2 outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:cursor-default disabled:opacity-40'
    const muted = 'text-muted-foreground hover:bg-sky-soft hover:text-sky-ink focus-visible:bg-sky-soft'
    const recording = session !== null
    return (
      <TooltipProvider delayDuration={300}>
        <span className="inline-flex items-center gap-3">
          {recording ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => stopAndSave(sessionRef.current!)}
                  aria-label="Stop recording"
                  className={cn(iconButton, 'animate-pulse bg-coral-soft text-coral-ink')}
                >
                  <SquareIcon className="size-5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Stop recording</TooltipContent>
            </Tooltip>
          ) : status === 'ready' ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={play}
                    aria-label={`Play your recording for this ${noun}`}
                    className={cn(iconButton, 'bg-sky-soft text-sky-ink hover:brightness-95')}
                  >
                    <PlayIcon className="size-5" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Play your recording</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={remove}
                    aria-label={`Delete your recording for this ${noun}`}
                    className={cn(iconButton, muted)}
                  >
                    <Trash2Icon className="size-5" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete your recording</TooltipContent>
              </Tooltip>
            </>
          ) : status === 'playing' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={stopPlayback} aria-label="Stop" className={cn(iconButton, muted)}>
                  <SquareIcon className="size-5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Stop</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={start}
                  disabled={status !== 'idle'}
                  aria-label={`Record your voice for this ${noun}`}
                  className={cn(iconButton, muted)}
                >
                  <MicIcon className="size-5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Record your voice</TooltipContent>
            </Tooltip>
          )}
          {notice && (
            <span className="sr-only" role="alert">
              {notice}
            </span>
          )}
        </span>
      </TooltipProvider>
    )
  }

  return (
    <div className="rounded-[14px] border-2 border-line bg-card p-4">
      <p className="text-[15px] font-bold text-ink">Your voice for this {noun}</p>

      {session !== null ? (
        <div className="mt-3">
          <Button variant="secondary" onClick={() => stopAndSave(session)}>
            <SquareIcon className="size-4" aria-hidden="true" />
            Stop recording
          </Button>
          <p className="mt-2 text-sm font-semibold text-coral-ink" role="status">
            Recording. Speak now, then tap stop.
          </p>
        </div>
      ) : (
        <>
          {status === 'checking' && <p className="mt-2 text-sm text-muted-foreground">Checking for your recording.</p>}
          {status === 'idle' && (
            <div className="mt-3">
              <Button variant="secondary" onClick={start} aria-label={`Record your voice for this ${noun}`}>
                <MicIcon className="size-4" aria-hidden="true" />
                Record your voice
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                Record yourself saying it. Your recording plays instead of the other voices.
              </p>
            </div>
          )}
          {status === 'saving' && <p className="mt-3 text-sm text-muted-foreground">Saving your recording.</p>}
          {status === 'ready' && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={play} aria-label={`Play your recording for this ${noun}`}>
                  <PlayIcon className="size-4" aria-hidden="true" />
                  Play
                </Button>
                <Button variant="ghost" onClick={remove} aria-label={`Delete your recording for this ${noun}`}>
                  <Trash2Icon className="size-4" aria-hidden="true" />
                  Delete
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Your recording plays instead of the other voices for this {noun}.
              </p>
            </div>
          )}
          {status === 'playing' && (
            <div className="mt-3">
              <Button variant="secondary" onClick={stopPlayback}>
                <SquareIcon className="size-4" aria-hidden="true" />
                Stop
              </Button>
              <p className="mt-2 text-sm text-muted-foreground" role="status">
                Playing your recording.
              </p>
            </div>
          )}
        </>
      )}

      {notice && (
        <p className="mt-2 text-sm font-semibold text-coral-ink" role="alert">
          {notice}
        </p>
      )}
    </div>
  )
}
