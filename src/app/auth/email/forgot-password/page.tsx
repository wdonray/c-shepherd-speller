'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { EmailAuthCard } from '../_components/email-auth-card'
import { AuthFeedback } from '../_components/auth-feedback'
import { reportError } from '@/lib/report-error'

const FALLBACK_ERROR = 'Something went wrong. Try again in a moment.'

export default function EmailForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFailed(false)
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/email/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = (await response.json()) as { ok: boolean }
      if (body.ok) {
        setSent(true)
        return
      }
      setFailed(true)
    } catch (error) {
      reportError(error, { location: 'EmailForgotPassword.handleSubmit' })
      setFailed(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <EmailAuthCard title="Check your email" subtitle="If that address has an account, a reset code is on its way.">
        <div className="flex w-full flex-col gap-4">
          <AuthFeedback tone="success">Reset code sent. It expires in about an hour.</AuthFeedback>
          <Button asChild className="w-full">
            <Link href={`/auth/email/reset-password?email=${encodeURIComponent(email.trim())}`}>Enter your code</Link>
          </Button>
        </div>
      </EmailAuthCard>
    )
  }

  return (
    <EmailAuthCard title="Reset your password" subtitle="We will email you a reset code.">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        {failed ? <AuthFeedback tone="error">{FALLBACK_ERROR}</AuthFeedback> : null}
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
        <Button type="submit" className="mt-2 w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Sending code...
            </>
          ) : (
            'Send reset code'
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link href="/auth/email/signin" className="underline underline-offset-4 hover:text-ink">
            Back to sign in
          </Link>
        </p>
      </form>
    </EmailAuthCard>
  )
}
