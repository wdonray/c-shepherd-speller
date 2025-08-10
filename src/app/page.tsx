'use client'

import { signOut, useSession } from 'next-auth/react'
import SpellingManagerSheet from '../components/SpellingManagerSheet'
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
        console.log('Creating user')
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-lg border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-8">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Shepherd Speller
                </h1>
                <p className="text-gray-600 mt-2 text-lg">Hello, {session?.user?.name || 'User'}! 👋</p>
              </div>
              <button
                onClick={() => signOut()}
                className="px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform hover:scale-105"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Shepherd Speller</h2>
            <p className="text-lg text-gray-600 mb-8">Manage your spelling data with our interactive tools</p>
            <SpellingManagerSheet />
          </div>
        </div>
      </div>
    </div>
  )
}
