'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PatternMark } from '@/components/PatternMark'
import { Loader2 } from 'lucide-react'

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
  const [isLoading, setIsLoading] = useState(false)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    document.body.setAttribute('data-auth-page', 'true')
    return () => {
      document.body.removeAttribute('data-auth-page')
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id != null) {
      router.replace('/')
    }
  }, [status, session, router])

  async function handleGoogleSignIn() {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl: '/' })
    } catch (error) {
      setIsLoading(false)
      console.error(error)
    }
  }

  if (status === 'authenticated' && session?.user?.id != null) {
    return null
  }

  return (
    <div className="flex justify-center px-8 pt-32 pb-8">
      <Card className="mx-4 w-full max-w-[400px] sm:mx-0">
        <CardContent className="flex flex-col items-center px-10 py-12">
          <PatternMark className="h-[110px] w-[110px]" label="PatternSpell logo" />
          <h1 className="mt-6 text-center text-[26px] font-bold text-ink">PatternSpell</h1>
          <p className="mt-3 text-center text-[15px] leading-6 text-muted-foreground">
            A pattern-based spelling toolkit for K-3 teachers.
          </p>
          <Button
            variant="secondary"
            onClick={handleGoogleSignIn}
            className="mt-8 w-full"
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
                <GoogleMark />
                Sign in with Google
              </>
            )}
          </Button>
          <p className="mt-6 text-center text-[13px] text-muted-foreground">Free for classrooms.</p>
        </CardContent>
      </Card>
    </div>
  )
}
