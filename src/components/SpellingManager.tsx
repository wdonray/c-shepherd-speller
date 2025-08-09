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
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Spelling Manager</h2>
        <p className="text-gray-600">Manage your words, sounds, and spelling data</p>
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
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Words</h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Enter a word"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && addWord()}
              />
              <button
                onClick={addWord}
                disabled={isLoading || !newWord.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {spellingData.words.map((word, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                  <span className="text-gray-800">{word}</span>
                  <button
                    onClick={() => removeItem('words', index)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {spellingData.words.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No words added yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Sounds Section */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sounds</h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSound}
                onChange={(e) => setNewSound(e.target.value)}
                placeholder="Enter a sound"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && addSound()}
              />
              <button
                onClick={addSound}
                disabled={isLoading || !newSound.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {spellingData.sounds.map((sound, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                  <span className="text-gray-800">{sound}</span>
                  <button
                    onClick={() => removeItem('sounds', index)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {spellingData.sounds.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No sounds added yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Spelling Section */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spelling</h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSpelling}
                onChange={(e) => setNewSpelling(e.target.value)}
                placeholder="Enter spelling"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && addSpelling()}
              />
              <button
                onClick={addSpelling}
                disabled={isLoading || !newSpelling.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {spellingData.spelling.map((spell, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                  <span className="text-gray-800">{spell}</span>
                  <button
                    onClick={() => removeItem('spelling', index)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {spellingData.spelling.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No spelling added yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-600">Words</div>
            <div className="text-2xl font-bold text-indigo-600 flex flex-col gap-2">
              {spellingData.words.map((word) => (
                <div key={word}>{word}</div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Sounds</div>
            <div className="text-2xl font-bold text-indigo-600 flex flex-col gap-2">
              {spellingData.sounds.map((sound) => (
                <div key={sound}>{sound}</div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Spelling</div>
            <div className="text-2xl font-bold text-indigo-600 flex flex-col gap-2  ">
              {spellingData.spelling.map((spelling) => (
                <div key={spelling}>{spelling}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
