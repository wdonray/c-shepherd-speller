'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { LogOutIcon, Loader2, AlertTriangle } from 'lucide-react'

export default function SignOut() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    document.body.setAttribute('data-auth-page', 'true')
    return () => {
      document.body.removeAttribute('data-auth-page')
    }
  }, [])

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await signOut({ redirect: false })
      router.push('/')
    } catch (error) {
      setIsSigningOut(false)
      console.error(error)
    }
  }

  return (
    <div className="pt-32 pb-8 px-8 flex justify-center">
      <Card className="w-full max-w-[400px] min-h-[300px] flex flex-col mx-4 sm:mx-0">
        <CardHeader>
          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Sign Out</CardTitle>
            <CardDescription>Are you sure you want to sign out?</CardDescription>
          </div>
        </CardHeader>
        <CardFooter className="flex-col space-y-3 flex-1 flex items-end justify-center">
          <Button
            onClick={handleSignOut}
            variant="destructive"
            className="w-full"
            disabled={isSigningOut}
            aria-label="Confirm sign out"
            onKeyDown={(e) => e.key === 'Enter' && !isSigningOut && handleSignOut()}
          >
            {isSigningOut ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing out...
              </>
            ) : (
              <>
                <LogOutIcon className="mr-2 h-4 w-4" />
                Sign Out
              </>
            )}
          </Button>
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="w-full"
            disabled={isSigningOut}
            aria-label="Cancel sign out"
          >
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
