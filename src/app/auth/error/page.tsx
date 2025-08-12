'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Home, HelpCircle } from 'lucide-react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  useEffect(() => {
    document.body.setAttribute('data-auth-page', 'true')
    return () => {
      document.body.removeAttribute('data-auth-page')
    }
  }, [])

  const errorMessages: Record<string, { title: string; description: string; action?: string }> = {
    Configuration: {
      title: 'Service Temporarily Unavailable',
      description:
        "We're experiencing technical difficulties with our authentication service. This is usually resolved quickly.",
      action: 'Please wait a few minutes and try again. If the problem persists, our team has been notified.',
    },
    AccessDenied: {
      title: 'Access Restricted',
      description: "Your account doesn't have permission to access Shepherd Speller at this time.",
      action: 'Please contact your administrator or support team to request access to your account.',
    },
    Verification: {
      title: 'Sign-in Link Expired',
      description: 'The sign-in link you used has expired for security reasons.',
      action: 'Please request a new sign-in link from the login page.',
    },
    OAuthSignin: {
      title: 'Sign-in Error',
      description: 'There was a problem starting the sign-in process with Google.',
      action: 'Please try again, or check your internet connection and browser settings.',
    },
    OAuthCallback: {
      title: 'Sign-in Interrupted',
      description: "The sign-in process was interrupted or couldn't be completed.",
      action: 'Please try signing in again from the beginning.',
    },
    OAuthCreateAccount: {
      title: 'Account Creation Failed',
      description: "We couldn't create your account automatically. This might be due to existing account settings.",
      action: 'Please try signing in with a different Google account or contact support for assistance.',
    },
    EmailCreateAccount: {
      title: 'Account Creation Failed',
      description: "We couldn't create your account with the provided email address.",
      action: 'Please try again or use a different email address.',
    },
    Callback: {
      title: 'Sign-in Error',
      description: 'There was a problem completing your sign-in process.',
      action: 'Please try again, and if the problem continues, contact our support team.',
    },
    OAuthAccountNotLinked: {
      title: 'Account Already Exists',
      description: 'An account with this email already exists but was created using a different sign-in method.',
      action: 'Please sign in using the same method you used when you first created your account.',
    },
    EmailSignin: {
      title: 'Email Sign-in Unavailable',
      description: 'Email-based sign-in is not currently available.',
      action: 'Please use Google sign-in instead.',
    },
    CredentialsSignin: {
      title: 'Sign-in Failed',
      description: 'The email or password you entered is incorrect.',
      action: 'Please check your credentials and try again.',
    },
    SessionRequired: {
      title: 'Sign-in Required',
      description: 'You need to be signed in to access this page.',
      action: 'Please sign in to continue.',
    },
    Default: {
      title: 'Something Went Wrong',
      description: 'We encountered an unexpected error while processing your sign-in request.',
      action: 'Please check your internet connection and try again. If the problem persists, contact our support team.',
    },
  }

  const currentError = errorMessages[error ?? 'Default']

  return (
    <div className="pt-32 pb-8 px-8 flex justify-center">
      <Card className="w-full max-w-[450px] min-h-[350px] flex flex-col mx-4 sm:mx-0">
        <CardHeader>
          <div className="flex flex-col items-center space-y-3">
            <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-center">{currentError.title}</CardTitle>
            <CardDescription className="text-center text-base leading-relaxed">
              {currentError.description}
            </CardDescription>
            {currentError.action && (
              <div className="flex items-start space-x-2 bg-muted/50 rounded-lg p-3 w-full">
                <HelpCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground leading-relaxed">{currentError.action}</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardFooter className="flex-col space-y-3 flex-1 flex items-end justify-center">
          <Button asChild className="w-full" aria-label="Try signing in again">
            <Link href="/auth/signin">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full" aria-label="Go to home page">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function AuthError() {
  return (
    <Suspense
      fallback={
        <div className="pt-32 pb-8 px-8 flex justify-center">
          <Card className="w-full max-w-[450px] min-h-[350px] flex flex-col mx-4 sm:mx-0">
            <CardHeader>
              <div className="flex flex-col items-center space-y-3">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
                </div>
                <CardTitle className="text-center">Loading Error Information</CardTitle>
                <CardDescription className="text-center">
                  Please wait while we load the error details...
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  )
}
