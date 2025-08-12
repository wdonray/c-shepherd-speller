'use client'

import { signIn } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpenIcon, Loader2, ExternalLink } from 'lucide-react'

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    document.body.setAttribute('data-auth-page', 'true')
    return () => {
      document.body.removeAttribute('data-auth-page')
    }
  }, [])

  async function handleGoogleSignIn() {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl: '/' })
    } catch (error) {
      setIsLoading(false)
      console.error(error)
    }
  }

  return (
    <div className="pt-32 pb-8 px-8 flex justify-center">
      <Card className="w-full max-w-[400px] min-h-[300px] flex flex-col mx-4 sm:mx-0">
        <CardHeader>
          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <BookOpenIcon className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle>Welcome to Shepherd Speller</CardTitle>
            <CardDescription>Sign in to access your spelling collections</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Button
            onClick={handleGoogleSignIn}
            className="w-full"
            disabled={isLoading}
            aria-label="Sign in with Google account"
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleGoogleSignIn()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Continue with Google
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your data is protected with industry-standard security
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
