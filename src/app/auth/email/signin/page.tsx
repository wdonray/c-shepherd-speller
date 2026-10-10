'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getProviders, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { EmailAuthCard } from '../_components/email-auth-card'
import { AuthFeedback } from '../_components/auth-feedback'
import { reportError } from '@/lib/report-error'

// Machine-readable codes thrown by the email-password provider's authorize().
const ERROR_COPY: Record<string, string> = {
  'invalid-credentials': 'Incorrect email or password. Check both and try again.',
  'too-many-attempts': 'Too many attempts. Wait a few minutes and try again.',
  'not-configured': 'Email sign-in is not set up yet. Try signing in with Google instead.',
}
const FALLBACK_ERROR = 'Something went wrong. Try again in a moment.'

function EmailSignInForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [providerReady, setProviderReady] = useState<boolean | null>(null)

  useEffect(() => {
    getProviders()
      .then((providers) => setProviderReady(providers?.['email-password'] != null))
      .catch(() => setProviderReady(false))
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorCode(null)
    setIsLoading(true)
    try {
      const result = await signIn('email-password', { email, password, redirect: false, callbackUrl: '/' })
      if (result?.ok) {
        router.push(result.url ?? '/')
        return
      }
      setErrorCode(result?.error ?? 'server-error')
    } catch (error) {
      reportError(error, { location: 'EmailSignIn.handleSubmit' })
      setErrorCode('server-error')
    } finally {
      setIsLoading(false)
    }
  }

  let feedback: React.ReactNode = null
  if (errorCode === 'not-confirmed') {
    feedback = (
      <AuthFeedback tone="error">
        This account is not verified yet.{' '}
        <Link
          href={`/auth/email/verify?email=${encodeURIComponent(email)}`}
          className="font-medium underline underline-offset-4"
        >
          Enter your verification code
        </Link>
      </AuthFeedback>
    )
  } else if (errorCode) {
    feedback = <AuthFeedback tone="error">{ERROR_COPY[errorCode] ?? FALLBACK_ERROR}</AuthFeedback>
  }

  return (
    <EmailAuthCard title="Welcome back" subtitle="Sign in with your email and password.">
      {providerReady === null ? (
        <div className="flex justify-center py-8" role="status" aria-label="Loading sign-in form">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : providerReady === false ? (
        <AuthFeedback tone="error">
          Email sign-in is not set up yet.{' '}
          <Link href="/auth/signin" className="font-medium underline underline-offset-4">
            Back to sign in
          </Link>
        </AuthFeedback>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
          {feedback}
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="mt-2 w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Link href="/auth/email/forgot-password" className="underline underline-offset-4 hover:text-ink">
              Forgot your password?
            </Link>
            <p>
              New here?{' '}
              <Link href="/auth/email/signup" className="underline underline-offset-4 hover:text-ink">
                Create an account
              </Link>
            </p>
          </div>
        </form>
      )}
    </EmailAuthCard>
  )
}

export default function EmailSignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      }
    >
      <EmailSignInForm />
    </Suspense>
  )
}
