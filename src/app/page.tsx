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
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <>
      <Dashboard
        onNewList={() => setIsSheetOpen(true)}
        onEditList={(_list: WordList) => setIsSheetOpen(true)}
        onDeleteList={(_list: WordList) => setIsSheetOpen(true)}
      />
      <SpellingManagerSheet isOpen={isSheetOpen} setIsOpen={setIsSheetOpen} />
    </>
  )
}
