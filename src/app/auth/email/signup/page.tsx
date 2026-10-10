'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { EmailAuthCard } from '../_components/email-auth-card'
import { AuthFeedback } from '../_components/auth-feedback'
import { reportError } from '@/lib/report-error'

const ERROR_COPY: Record<string, string> = {
  'email-in-use': 'An account with this email already exists.',
  'weak-password': 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.',
  'invalid-input': 'Check the fields below and try again.',
  'too-many-attempts': 'Too many attempts. Wait a few minutes and try again.',
  'not-configured': 'Email sign-in is not set up yet. Try signing in with Google instead.',
}
const FALLBACK_ERROR = 'Something went wrong. Try again in a moment.'

export default function EmailSignUpPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorCode(null)
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/email/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const body = (await response.json()) as { ok: boolean; code?: string }
      if (body.ok) {
        router.push(`/auth/email/verify?email=${encodeURIComponent(email.trim())}`)
        return
      }
      setErrorCode(body.code ?? 'server-error')
    } catch (error) {
      reportError(error, { location: 'EmailSignUp.handleSubmit' })
      setErrorCode('server-error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <EmailAuthCard title="Create your account" subtitle="One account for all of your spelling lists.">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
        {errorCode === 'email-in-use' ? (
          <AuthFeedback tone="error">
            {ERROR_COPY['email-in-use']}{' '}
            <Link href="/auth/email/signin" className="font-medium underline underline-offset-4">
              Sign in with email
            </Link>{' '}
            or{' '}
            <Link href="/auth/signin" className="font-medium underline underline-offset-4">
              sign in with Google
            </Link>
            .
          </AuthFeedback>
        ) : errorCode ? (
          <AuthFeedback tone="error">{ERROR_COPY[errorCode] ?? FALLBACK_ERROR}</AuthFeedback>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={100}
            placeholder="Jordan Lee"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isLoading}
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
              Creating your account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/email/signin" className="underline underline-offset-4 hover:text-ink">
            Sign in
          </Link>
        </p>
      </form>
    </EmailAuthCard>
  )
}
