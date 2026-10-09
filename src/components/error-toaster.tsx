'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { subscribeToErrorToasts } from '@/lib/error-toast'

const AUTO_DISMISS_MS = 8000
const MAX_TOASTS = 3

type Toast = {
  id: number
  message: string
}

/**
 * Global error toasts. Mounted once in the root layout. Bottom-center dark
 * card, auto-dismisses after 8s (timer pauses on hover and keyboard focus),
 * Escape dismisses the most recent, max 3 stacked with newest on top.
 * Screen readers are notified assertively via role="alert"; focus is never
 * moved. No action buttons: the toast informs, then dismisses.
 */
export function ErrorToaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    return subscribeToErrorToasts((message) => {
      nextId.current += 1
      const id = nextId.current
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, message }])
    })
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => {
    if (toasts.length === 0) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setToasts((prev) => prev.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toasts.length])

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {toasts.map((toast) => (
        <ErrorToastItem key={toast.id} message={toast.message} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  )
}

function ErrorToastItem({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [paused, onDismiss])

  return (
    <div
      role="alert"
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-2xl border-l-4 border-l-coral bg-[#2c261e] px-4 py-3 text-[#fff6e9] shadow-xl"
    >
      <AlertCircle className="size-5 shrink-0 text-coral" aria-hidden="true" />
      <p className="flex-1 text-[15px] font-medium">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#fff6e9]/70 outline-none transition hover:bg-white/10 hover:text-[#fff6e9] focus-visible:ring-[3px] focus-visible:ring-white/60 motion-reduce:transition-none"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
