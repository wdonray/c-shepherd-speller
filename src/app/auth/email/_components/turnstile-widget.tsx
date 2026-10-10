'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

/** Imperative handle: the form calls execute() on submit to get a fresh token. */
export interface TurnstileHandle {
  execute: () => Promise<string | null>
}

interface TurnstileWidgetProps {
  siteKey: string
  onToken?: (token: string | null) => void
  onUnavailable?: () => void
}

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  execute: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const EXECUTE_TIMEOUT_MS = 15_000

let scriptPromise: Promise<TurnstileApi | null> | null = null

/** Test-only: forget the cached script load so tests start from a clean slate. */
export function resetTurnstileScript(): void {
  scriptPromise = null
}

function loadTurnstileScript(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = () => resolve(window.turnstile ?? null)
      script.onerror = () => {
        scriptPromise = null
        resolve(null)
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

/**
 * Invisible Cloudflare Turnstile widget. Renders nothing visible; the parent
 * form calls execute() on submit to run the challenge and receive a token.
 * Tokens expire after 5 minutes, so execute() refreshes when needed.
 */
const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { siteKey, onToken, onUnavailable },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<TurnstileApi | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const tokenRef = useRef<string | null>(null)
  const pendingRef = useRef<((token: string | null) => void) | null>(null)
  const onTokenRef = useRef(onToken)
  const onUnavailableRef = useRef(onUnavailable)
  onTokenRef.current = onToken
  onUnavailableRef.current = onUnavailable

  useEffect(() => {
    let cancelled = false
    loadTurnstileScript().then((api) => {
      if (cancelled) return
      if (!api) {
        onUnavailableRef.current?.()
        return
      }
      // Refs are attached before effects run, so the container exists here.
      const container = containerRef.current as HTMLElement
      apiRef.current = api
      widgetIdRef.current = api.render(container, {
        sitekey: siteKey,
        size: 'invisible',
        callback: (token: string) => {
          tokenRef.current = token
          onTokenRef.current?.(token)
          pendingRef.current?.(token)
          pendingRef.current = null
        },
        'expired-callback': () => {
          tokenRef.current = null
          onTokenRef.current?.(null)
        },
        'error-callback': () => {
          tokenRef.current = null
          onTokenRef.current?.(null)
          pendingRef.current?.(null)
          pendingRef.current = null
        },
      })
      // Pre-warm the challenge so a token is usually ready by submit time.
      api.execute(widgetIdRef.current)
    })
    return () => {
      cancelled = true
      if (apiRef.current && widgetIdRef.current) {
        apiRef.current.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey])

  useImperativeHandle(ref, () => ({
    execute: () => {
      if (tokenRef.current) return Promise.resolve(tokenRef.current)
      return new Promise<string | null>((resolve) => {
        if (!apiRef.current || !widgetIdRef.current) {
          resolve(null)
          return
        }
        pendingRef.current = resolve
        apiRef.current.execute(widgetIdRef.current)
        setTimeout(() => {
          if (pendingRef.current === resolve) {
            pendingRef.current = null
            resolve(null)
          }
        }, EXECUTE_TIMEOUT_MS)
      })
    },
  }))

  // Invisible mode renders nothing; the div is only the widget's anchor.
  return <div ref={containerRef} aria-hidden="true" data-testid="turnstile-widget" />
})

export default TurnstileWidget
