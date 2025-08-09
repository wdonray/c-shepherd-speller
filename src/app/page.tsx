'use client'

import { signOut, useSession } from 'next-auth/react'
import SpellingManager from '../components/SpellingManager'
import { useMemo } from 'react'

export default function Home() {
  const { data: session, status } = useSession()

  const isLoading = useMemo(() => status === 'loading', [status])

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

        <SpellingManager />
      </div>
    </div>
  )
}
