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
  'expired-code': 'That code has expired. Request a new one and try again.',
  'weak-password': 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.',
  'invalid-input': 'Fill in every field below, then try again.',
  'too-many-attempts': 'Too many attempts. Wait a few minutes and try again.',
}
const FALLBACK_ERROR = 'Something went wrong. Try again in a moment.'

function EmailResetPasswordForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorCode(null)
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/email/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      })
      const body = (await response.json()) as { ok: boolean; code?: string }
      if (body.ok) {
        setDone(true)
        return
      }
      setErrorCode(body.code ?? 'server-error')
    } catch (error) {
      reportError(error, { location: 'EmailResetPassword.handleSubmit' })
      setErrorCode('server-error')
    } finally {
      setIsLoading(false)
    }
  }

  if (done) {
    return (
      <EmailAuthCard title="Password updated" subtitle="Your new password is ready to use.">
        <div className="flex w-full flex-col gap-4">
          <AuthFeedback tone="success">Password changed. Sign in with the new one.</AuthFeedback>
          <Button asChild className="w-full">
            <Link href={`/auth/email/signin?email=${encodeURIComponent(email.trim())}`}>Continue to sign in</Link>
          </Button>
        </div>
      </EmailAuthCard>
    )
  }

  return (
    <EmailAuthCard title="Choose a new password" subtitle="Enter the code from your email, then pick a new password.">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        {errorCode ? <AuthFeedback tone="error">{ERROR_COPY[errorCode] ?? FALLBACK_ERROR}</AuthFeedback> : null}
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
          <Label htmlFor="code">Reset code</Label>
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={isLoading}
          />
          <p className="text-[13px] leading-5 text-muted-foreground">
            At least 8 characters, with uppercase, lowercase, a number, and a symbol.
          </p>
        </div>
        <Button type="submit" className="mt-2 w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Updating password...
            </>
          ) : (
            'Update password'
          )}
        </Button>
      </form>
    </EmailAuthCard>
  )
}

export default function EmailResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      }
    >
      <EmailResetPasswordForm />
    </Suspense>
  )
}
