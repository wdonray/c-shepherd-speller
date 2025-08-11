'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, ArrowLeft } from 'lucide-react'

export default function VerifyRequest() {
  return (
    <div className="p-8 flex justify-center">
      <Card className="w-full max-w-[400px] min-h-[300px] flex flex-col mx-4 sm:mx-0">
        <CardHeader>
          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>We&apos;ve sent you a sign in link to your email address.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">If you don&apos;t see the email, check your spam folder.</p>
            <p className="text-xs text-muted-foreground">The link will expire in 24 hours for security.</p>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-center">
          <Button asChild variant="outline" className="w-full" aria-label="Return to sign in page">
            <Link href="/auth/signin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
