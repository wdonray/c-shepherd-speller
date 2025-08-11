'use client'

import { useSession } from 'next-auth/react'
import { useMemo, useEffect, useState } from 'react'

export default function Home() {
  const { data: session, status } = useSession()
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    async function syncUser() {
      setIsSyncing(true)

      const email = session?.user?.email

      if (!email) {
        setIsSyncing(false)
        return
      }

      const user = await fetch(`/api/users?email=${email}`)
      const userData = await user.json()

      if (!userData.user.id) {
        await fetch(`/api/users`, {
          method: 'POST',
          body: JSON.stringify({
            email: session?.user?.email || '',
            name: session?.user?.name || '',
          }),
        })
      }

      setIsSyncing(false)
    }

    syncUser()
  }, [session?.user])

  const isLoading = useMemo(() => status === 'loading' || isSyncing, [status, isSyncing])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <h1 className="text-2xl font-semibold">Welcome, {session?.user?.name || 'User'}! 👋</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Use the buttons in the header to manage your spelling data and sign out.
      </p>
    </div>
  )
}
