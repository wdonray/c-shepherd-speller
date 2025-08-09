'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface SpellingData {
  words: string[]
  sounds: string[]
  spelling: string[]
}

export default function SpellingManager() {
  const { data: session } = useSession()
  const [userId, setUserId] = useState<string>('')
  const [spellingData, setSpellingData] = useState<SpellingData>({
    words: [],
    sounds: [],
    spelling: [],
  })
  const [newWord, setNewWord] = useState('')
  const [newSound, setNewSound] = useState('')
  const [newSpelling, setNewSpelling] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Load existing data when component mounts
  useEffect(() => {
    async function loadSpellingData() {
      try {
        const currentUserId = session?.user?.id

        if (!currentUserId) {
          return
        }

        setUserId(currentUserId)

        // Then get the spelling data using the user ID
        const spellingResponse = await fetch(`/api/users/${currentUserId}/spelling`)
        if (spellingResponse.ok) {
          const data = await spellingResponse.json()
          setSpellingData(data.spellingData)
        }
      } catch (error) {
        console.error('Error loading spelling data:', error)
      }
    }

    if (session?.user?.id) {
      loadSpellingData()
    }
  }, [session?.user?.id])

  async function addWord() {
    if (!newWord.trim() || !userId) return

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(`/api/users/${userId}/spelling`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: [...spellingData.words, newWord.trim()],
        }),
      })

      if (response.ok) {
        setSpellingData((prev) => ({
          ...prev,
          words: [...prev.words, newWord.trim()],
        }))
        setNewWord('')
        setMessage('Word added successfully!')
      } else {
        setMessage('Failed to add word')
      }
    } catch (error) {
      setMessage('Error adding word')
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function addSound() {
    if (!newSound.trim() || !userId) return

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(`/api/users/${userId}/spelling`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sounds: [...spellingData.sounds, newSound.trim()],
        }),
      })

      if (response.ok) {
        setSpellingData((prev) => ({
          ...prev,
          sounds: [...prev.sounds, newSound.trim()],
        }))
        setNewSound('')
        setMessage('Sound added successfully!')
      } else {
        setMessage('Failed to add sound')
      }
    } catch (error) {
      setMessage('Error adding sound')
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function addSpelling() {
    if (!newSpelling.trim() || !userId) return

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(`/api/users/${userId}/spelling`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spelling: [...spellingData.spelling, newSpelling.trim()],
        }),
      })

      if (response.ok) {
        setSpellingData((prev) => ({
          ...prev,
          spelling: [...prev.spelling, newSpelling.trim()],
        }))
        setNewSpelling('')
        setMessage('Spelling added successfully!')
      } else {
        setMessage('Failed to add spelling')
      }
    } catch (error) {
      setMessage('Error adding spelling')
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function removeItem(type: keyof SpellingData, index: number) {
    if (!userId) return

    setIsLoading(true)
    setMessage('')

    try {
      const updatedArray = spellingData[type].filter((_, i) => i !== index)
      const response = await fetch(`/api/users/${userId}/spelling`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [type]: updatedArray,
        }),
      })

      if (response.ok) {
        setSpellingData((prev) => ({
          ...prev,
          [type]: updatedArray,
        }))
        setMessage(`${type} removed successfully!`)
      } else {
        setMessage(`Failed to remove ${type}`)
      }
    } catch (error) {
      setMessage(`Error removing ${type}`)
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!session?.user?.email || !userId) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Please sign in to manage your spelling data.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
          Spelling Manager
        </h2>
        <p className="text-gray-600 text-lg">Manage your words, sounds, and spelling data</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md ${
            message.includes('successfully')
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Words Section */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Words
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Enter a word"
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                onKeyPress={(e) => e.key === 'Enter' && addWord()}
              />
              <button
                onClick={addWord}
                disabled={isLoading || !newWord.trim()}
                className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium whitespace-nowrap"
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {spellingData.words.map((word, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors duration-200 group"
                >
                  <span className="text-gray-800 font-medium">{word}</span>
                  <button
                    onClick={() => removeItem('words', index)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 px-2 py-1 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {spellingData.words.length === 0 && (
                <div className="text-center py-8">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">No words added yet</p>
                  <p className="text-gray-400 text-xs mt-1">Add your first word to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sounds Section */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            Sounds
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSound}
                onChange={(e) => setNewSound(e.target.value)}
                placeholder="Enter a sound"
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                onKeyPress={(e) => e.key === 'Enter' && addSound()}
              />
              <button
                onClick={addSound}
                disabled={isLoading || !newSound.trim()}
                className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium whitespace-nowrap"
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {spellingData.sounds.map((sound, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors duration-200 group"
                >
                  <span className="text-gray-800 font-medium">{sound}</span>
                  <button
                    onClick={() => removeItem('sounds', index)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 px-2 py-1 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {spellingData.sounds.length === 0 && (
                <div className="text-center py-8">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">No sounds added yet</p>
                  <p className="text-gray-400 text-xs mt-1">Add your first sound to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Spelling Section */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-purple-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Spelling
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSpelling}
                onChange={(e) => setNewSpelling(e.target.value)}
                placeholder="Enter spelling"
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                onKeyPress={(e) => e.key === 'Enter' && addSpelling()}
              />
              <button
                onClick={addSpelling}
                disabled={isLoading || !newSpelling.trim()}
                className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium whitespace-nowrap"
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {spellingData.spelling.map((spell, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors duration-200 group"
                >
                  <span className="text-gray-800 font-medium">{spell}</span>
                  <button
                    onClick={() => removeItem('spelling', index)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 px-2 py-1 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {spellingData.spelling.length === 0 && (
                <div className="text-center py-8">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">No spelling added yet</p>
                  <p className="text-gray-400 text-xs mt-1">Add your first spelling to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
            <div className="text-2xl font-bold text-blue-600 mb-1">{spellingData.words.length}</div>
            <div className="text-sm font-medium text-blue-700">Words</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
            <div className="text-2xl font-bold text-green-600 mb-1">{spellingData.sounds.length}</div>
            <div className="text-sm font-medium text-green-700">Sounds</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg border border-purple-100">
            <div className="text-2xl font-bold text-purple-600 mb-1">{spellingData.spelling.length}</div>
            <div className="text-sm font-medium text-purple-700">Spelling</div>
          </div>
        </div>
      </div>
    </div>
  )
}
