'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect } from 'react'
import Dashboard from '@/components/Dashboard'
import { notifyListsChanged } from '@/lib/lists-api'
import type { WordList } from '@/models/WordList'

export default function HomePage() {
  const { data: session } = useSession()
  const router = useRouter()

  // Start at the top of the page on load. useLayoutEffect runs before paint
  // so there is no flash of a scrolled position, and the rAF re-pin catches
  // iOS Safari nudging scroll while its toolbar settles after load.
  // (history.scrollRestoration only covers history navigation, not fresh loads.)
  // Cleanup restores the previous value so back navigation on other pages
  // keeps the browser's default scroll-restoration behavior.
  useLayoutEffect(() => {
    const supportsScrollRestoration = 'scrollRestoration' in window.history
    const previousScrollRestoration = supportsScrollRestoration ? window.history.scrollRestoration : 'auto'
    if (supportsScrollRestoration) {
      window.history.scrollRestoration = 'manual'
    }
    window.scrollTo(0, 0)
    let frames = 2
    let raf = 0
    const pinToTop = () => {
      window.scrollTo(0, 0)
      frames -= 1
      if (frames > 0) {
        raf = requestAnimationFrame(pinToTop)
      }
    }
    raf = requestAnimationFrame(pinToTop)
    return () => {
      cancelAnimationFrame(raf)
      if (supportsScrollRestoration) {
        window.history.scrollRestoration = previousScrollRestoration
      }
    }
  }, [])

  // User sync runs in the background and never blocks rendering (issue
  // #480): the middleware already guarantees this page only loads for
  // signed-in teachers, and the dashboard fetches its own data in parallel
  // with the session check, so holding the page on the user record would
  // re-add the sequential wait we just removed. Dashboard shows its own
  // skeleton while its data loads.
  useEffect(() => {
    async function syncUser() {
      const email = session?.user?.email

      if (!email) {
        return
      }

      try {
        const user = await fetch(`/api/users?email=${encodeURIComponent(email)}`)
        if (!user.ok) return
        const userData = await user.json()

        if (!userData.user?.id) {
          // First sign-in: create the database user record. The dashboard
          // fetches its lists in parallel (issue #480), so its request may
          // have landed before this POST and hit the 403 path for "no user
          // record yet". After a successful create, tell the dashboard to
          // retry its fetch so the teacher does not stare at an error card.
          const created = await fetch(`/api/users`, {
            method: 'POST',
            body: JSON.stringify({
              email,
              name: session?.user?.name || 'Teacher',
            }),
          })
          if (created.ok) {
            notifyListsChanged()
          }
        }
      } catch {
        // Sync failure is non-fatal: the dashboard still renders, the user
        // record just will not be up to date this session.
      }
    }

    syncUser()
  }, [session?.user])

  return (
    <>
      <Dashboard
        onNewList={() => router.push('/lists/new')}
        onEditList={(list: WordList) => router.push(`/lists/${encodeURIComponent(list.id)}`)}
      />
    </>
  )
}
