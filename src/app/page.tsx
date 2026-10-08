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
      <div
        className="mx-auto max-w-6xl space-y-10 px-4 py-8"
        role="status"
        aria-label="Loading dashboard"
        aria-busy="true"
      >
        {/* Greeting: matches Dashboard h1 text-3xl */}
        <div className="space-y-2" aria-hidden="true">
          <div className="h-9 w-56 animate-pulse rounded-xl bg-line/60" />
        </div>
        {/* Quick actions: matches Dashboard (3x size="lg" buttons) */}
        <div className="flex flex-wrap gap-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 w-32 animate-pulse rounded-2xl bg-line/60" />
          ))}
        </div>
        {/* My word lists: matches Dashboard (h2 + card grid) */}
        <div className="space-y-4" aria-hidden="true">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-line/60" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[20px] border-2 border-line bg-card p-6">
                <div className="h-7 w-3/4 animate-pulse rounded-lg bg-line/60" />
                <div className="mt-3 h-5 w-1/2 animate-pulse rounded-lg bg-line/60" />
                <div className="mt-4 h-20 animate-pulse rounded-xl bg-line/40" />
              </div>
            ))}
          </div>
        </div>
        {/* Getting started: matches Dashboard (h2 + text + 3 cards) */}
        <div className="space-y-4" aria-hidden="true">
          <div className="h-8 w-72 animate-pulse rounded-xl bg-line/60" />
          <div className="h-5 w-full max-w-3xl animate-pulse rounded-lg bg-line/60" />
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[20px] border-2 border-line bg-card p-6">
                <div className="mb-4 size-10 animate-pulse rounded-full bg-line/60" />
                <div className="mb-2 h-6 w-2/3 animate-pulse rounded-lg bg-line/60" />
                <div className="h-4 w-full animate-pulse rounded-lg bg-line/40" />
                <div className="mt-2 h-4 w-5/6 animate-pulse rounded-lg bg-line/40" />
              </div>
            ))}
          </div>
        </div>
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
