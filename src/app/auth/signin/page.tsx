'use client'

import { getProviders, signIn, useSession } from 'next-auth/react'
import type { ClientSafeProvider } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PatternMark } from '@/components/PatternMark'
import { Loader2, Mail } from 'lucide-react'
import { reportError } from '@/lib/report-error'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.6-5 3.6-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.7 2.9v.1C3.4 21.5 7.4 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.2-3.6-2.8-.1.1C.5 8.5 0 10.1 0 12s.5 3.5 1.4 5.2l3.8-2.8z"
      />
      <path
        fill="#EA4335"
        d="M12 4.6c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.5 1.4 6.8l3.8 2.8c1-2.9 3.7-5 6.8-5z"
      />
    </svg>
  )
}

export default function SignIn() {
  // Which provider is mid-redirect, so only its button shows the spinner.
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id != null) {
      router.replace('/')
    }
  }, [status, session, router])

  // The email/password button only exists when the Cognito provider is
  // configured server-side; Google-only deployments never see it.
  useEffect(() => {
    getProviders()
      .then(setProviders)
      .catch((error) => {
        reportError(error, { location: 'SignInPage.getProviders' })
        console.error(error)
      })
  }, [])

  async function handleProviderSignIn(providerId: string) {
    setIsLoading(providerId)
    try {
      await signIn(providerId, { callbackUrl: '/' })
    } catch (error) {
      reportError(error, { location: 'SignInPage.handleProviderSignIn' })
      setIsLoading(null)
      console.error(error)
    }
  }

  function handleKeyDown(providerId: string) {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) {
        void handleProviderSignIn(providerId)
      }
    }
  }

  if (status === 'authenticated' && session?.user?.id != null) {
    return null
  }

  // While the session is resolving, show a centered spinner instead of the
  // sign-in form so logged-in users never see a login flash.
  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Checking sign-in status">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  // The email/password button only exists when the email-password provider is
  // configured server-side; Google-only deployments never see it. It routes
  // to the custom email auth pages instead of Cognito's hosted UI.
  const emailSignInEnabled = providers?.['email-password'] != null

  return (
    <div className="flex justify-center px-5 pt-10 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[85vh] sm:items-center sm:px-8 sm:py-16">
      <Card className="w-full max-w-[400px]">
        <CardContent className="flex flex-col items-center px-6 py-8 sm:px-10 sm:py-12">
          <PatternMark className="h-[72px] w-[72px] sm:h-[110px] sm:w-[110px]" label="PatternSpell logo" />
          <h1 className="mt-5 text-center text-[26px] font-bold text-ink sm:mt-6">PatternSpell</h1>
          <p className="mt-2 text-center text-[15px] leading-6 text-muted-foreground sm:mt-3">
            A pattern-based spelling toolkit for K-3 teachers.
          </p>
          <Button
            variant="secondary"
            onClick={() => void handleProviderSignIn('google')}
            className="mt-6 w-full sm:mt-8"
            disabled={isLoading != null}
            aria-label="Sign in with Google account"
            onKeyDown={handleKeyDown('google')}
          >
            {isLoading === 'google' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <GoogleMark />
                Sign in with Google
              </>
            )}
          </Button>
          {emailSignInEnabled && (
            <>
              <div className="my-4 flex w-full items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                variant="secondary"
                onClick={() => router.push('/auth/email/signin')}
                className="w-full"
                aria-label="Sign in with email and password"
              >
                <Mail className="size-5" aria-hidden="true" />
                Continue with email
              </Button>
            </>
          )}
          <p className="mt-6 text-center text-[13px] text-muted-foreground">Free for everyone.</p>
          <p className="mt-3 text-center text-[12px] text-muted-foreground">
            By signing in, you agree to our{' '}
            <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
