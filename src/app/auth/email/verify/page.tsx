'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { EmailAuthCard } from '../_components/email-auth-card'
import { AuthFeedback } from '../_components/auth-feedback'
import { reportError } from '@/lib/report-error'

const ERROR_COPY: Record<string, string> = {
  'invalid-code': 'That code is not right. Check the email and try again.',
  'expired-code': 'That code has expired. Request a new one below and try again.',
  'too-many-attempts': 'Too many attempts. Wait a few minutes and try again.',
  'invalid-input': 'Enter the email you signed up with and the 6-digit code.',
  'not-configured': 'Email sign-in is not set up yet. Try signing in with Google instead.',
}
const FALLBACK_ERROR = 'Something went wrong. Try again in a moment.'

function EmailVerifyForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [code, setCode] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [verified, setVerified] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorCode(null)
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const body = (await response.json()) as { ok: boolean; code?: string }
      if (body.ok) {
        setVerified(true)
        return
      }
      setErrorCode(body.code ?? 'server-error')
    } catch (error) {
      reportError(error, { location: 'EmailVerify.handleSubmit' })
      setErrorCode('server-error')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    setErrorCode(null)
    setResent(false)
    setIsResending(true)
    try {
      const response = await fetch('/api/auth/email/verify/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = (await response.json()) as { ok: boolean; code?: string }
      if (body.ok) {
        setResent(true)
        return
      }
      setErrorCode(body.code ?? 'server-error')
    } catch (error) {
      reportError(error, { location: 'EmailVerify.handleResend' })
      setErrorCode('server-error')
    } finally {
      setIsResending(false)
    }
  }

  if (verified) {
    return (
      <EmailAuthCard title="You are verified" subtitle="Your account is ready.">
        <div className="flex w-full flex-col gap-5">
          <AuthFeedback tone="success">Email verified. Sign in to get started.</AuthFeedback>
          <Button asChild className="w-full">
            <Link href={`/auth/email/signin?email=${encodeURIComponent(email.trim())}`}>Continue to sign in</Link>
          </Button>
        </div>
      </EmailAuthCard>
    )
  }

  return (
    <EmailAuthCard title="Check your email" subtitle="Enter the 6-digit code we sent you.">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
        {errorCode ? <AuthFeedback tone="error">{ERROR_COPY[errorCode] ?? FALLBACK_ERROR}</AuthFeedback> : null}
        {resent ? <AuthFeedback tone="success">New code sent. Check your email.</AuthFeedback> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@school.org"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={isLoading}
          />
        </div>
        <Button type="submit" className="mt-2 w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Verifying...
            </>
          ) : (
            'Verify email'
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Did not get a code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || email.trim().length === 0}
            className="underline underline-offset-4 hover:text-ink disabled:no-underline disabled:opacity-50"
          >
            {isResending ? 'Sending...' : 'Send a new one'}
          </button>
        </p>
      </form>
    </EmailAuthCard>
  )
}

export default function EmailVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      }
    >
      <EmailVerifyForm />
    </Suspense>
  )
}
