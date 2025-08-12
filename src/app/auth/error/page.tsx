'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  function getErrorMessage(errorCode: string | null) {
    switch (errorCode) {
      case 'Configuration':
        return "We're experiencing technical difficulties. Please try again later."
      case 'AccessDenied':
        return "You don't have permission to access this account. Please contact your administrator."
      case 'Verification':
        return 'The sign-in link has expired. Please request a new one.'
      case 'Default':
      default:
        return 'Something went wrong. Please check your connection and try again.'
    }
  }

  return (
    <div className="p-8 flex justify-center">
      <Card className="w-full max-w-[400px] min-h-[300px] flex flex-col mx-4 sm:mx-0">
        <CardHeader>
          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Sign In Error</CardTitle>
            <CardDescription className="text-center">{getErrorMessage(error)}</CardDescription>
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
        <div className="p-8 flex justify-center">
          <Card className="w-full max-w-[400px] min-h-[300px] flex flex-col mx-4 sm:mx-0">
            <CardHeader>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
                </div>
                <CardTitle>Sign In Error</CardTitle>
                <CardDescription>Loading...</CardDescription>
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
