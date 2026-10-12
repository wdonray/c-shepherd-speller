'use client'

import { useEffect, useRef, useState } from 'react'
import { MicIcon, PlayIcon, SquareIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NeuralTtsError, playAudioBlob } from '@/lib/neural-tts'
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
}

/**
 * Record-your-voice control for one read-aloud text. The teacher records
 * their own voice for the word or sentence; the recording then plays instead
 * of the neural or built-in voice whenever that exact text is spoken.
 * Recordings stay on this device in IndexedDB and are never uploaded.
 * Renders nothing where recording is unsupported.
 */
export default function VoiceRecorder({ text, kind }: VoiceRecorderProps) {
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
      // A second start slipped in while this one was pending: the latest
      // session wins, so cancel this one instead of leaking its mic stream.
      if (sessionRef.current) {
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
      if (!(error instanceof NeuralTtsError) || error.code !== 'aborted') {
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
