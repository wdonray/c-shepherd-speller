'use client'

import { useSession } from 'next-auth/react'
import { useMemo, useEffect, useState } from 'react'
import Dashboard from '@/components/Dashboard'
import SpellingManagerSheet from '@/components/SpellingManagerSheet'
import type { WordList } from '@/models/WordList'

export default function Home() {
  const { data: session, status } = useSession()
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

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
            email,
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
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8" role="status" aria-label="Loading">
        <div className="space-y-2" aria-hidden="true">
          <div className="h-9 w-56 animate-pulse rounded-xl bg-line/60" />
        </div>
        <div className="flex flex-wrap gap-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 w-32 animate-pulse rounded-2xl bg-line/60" />
          ))}
        </div>
        <div className="space-y-4" aria-hidden="true">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-line/60" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-[20px] bg-line/60" />
            ))}
          </div>
        </div>
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    )
  }

  return (
    <>
      <Dashboard onNewList={() => setIsSheetOpen(true)} onEditList={(_list: WordList) => setIsSheetOpen(true)} />
      <SpellingManagerSheet isOpen={isSheetOpen} setIsOpen={setIsSheetOpen} />
    </>
  )
}
