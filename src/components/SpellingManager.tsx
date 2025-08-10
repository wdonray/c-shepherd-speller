'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Alert, AlertDescription } from './ui/alert'
import {
  getSpelling,
  addWord as addWordApi,
  addSound as addSoundApi,
  addSpelling as addSpellingApi,
  removeItem as removeItemApi,
  updateLastActive,
  getUserByEmail,
} from '@/lib/spelling-api'

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

  useEffect(() => {
    async function loadSpellingData() {
      const userEmail = session?.user?.email
      if (!userEmail) return
      const userId = await getUserByEmail(userEmail)
      if (!userId) return
      setUserId(userId)
      const spellingData = await getSpelling(userId)
      setSpellingData(spellingData)
      updateLastActive(userId)
    }

    if (session?.user?.id) loadSpellingData()
  }, [session?.user?.id])

  async function addWord() {
    if (!newWord.trim() || !userId) return

    setIsLoading(true)
    setMessage('')

    try {
      await addWordApi(userId, newWord.trim(), spellingData.words)
      setSpellingData((prev) => ({
        ...prev,
        words: [...prev.words, newWord.trim()],
      }))
      setNewWord('')
      setMessage('Word added successfully!')
      await updateLastActive(userId)
    } catch (error) {
      setMessage('Error adding word')
    } finally {
      setIsLoading(false)
    }
  }

  async function addSound() {
    if (!newSound.trim() || !userId) return

    setIsLoading(true)
    setMessage('')

    try {
      await addSoundApi(userId, newSound.trim(), spellingData.sounds)
      setSpellingData((prev) => ({
        ...prev,
        sounds: [...prev.sounds, newSound.trim()],
      }))
      setNewSound('')
      setMessage('Sound added successfully!')
      updateLastActive(userId)
    } catch (error) {
      setMessage('Error adding sound')
    } finally {
      setIsLoading(false)
    }
  }

  async function addSpelling() {
    if (!newSpelling.trim() || !userId) return

    setIsLoading(true)
    setMessage('')

    try {
      await addSpellingApi(userId, newSpelling.trim(), spellingData.spelling)
      setSpellingData((prev) => ({
        ...prev,
        spelling: [...prev.spelling, newSpelling.trim()],
      }))
      setNewSpelling('')
      setMessage('Spelling added successfully!')
      updateLastActive(userId)
    } catch (error) {
      setMessage('Error adding spelling')
    } finally {
      setIsLoading(false)
    }
  }

  async function removeItem(type: keyof SpellingData, index: number) {
    if (!userId) return

    setIsLoading(true)
    setMessage('')

    try {
      await removeItemApi(userId, type, index, spellingData[type])
      const updatedArray = spellingData[type].filter((_, i) => i !== index)
      setSpellingData((prev) => ({
        ...prev,
        [type]: updatedArray,
      }))
      setMessage(`${type} removed successfully!`)
      updateLastActive(userId)
    } catch (error) {
      setMessage(`Error removing ${type}`)
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
    <div className="space-y-4">
      {message && (
        <Alert
          className={message.includes('successfully') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}
        >
          <AlertDescription className={message.includes('successfully') ? 'text-green-800' : 'text-red-800'}>
            {message}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4">
        {/* Words Section */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
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
              <Input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Enter a word"
                onKeyPress={(e) => e.key === 'Enter' && addWord()}
                className="flex-1"
              />
              <Button onClick={addWord} disabled={isLoading || !newWord.trim()} size="sm" className="flex-shrink-0">
                {isLoading ? 'Adding...' : 'Add'}
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {spellingData.words.map((word, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors duration-200 group"
                >
                  <span className="text-gray-800 font-medium text-sm">{word}</span>
                  <Button
                    onClick={() => removeItem('words', index)}
                    disabled={isLoading}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200 h-7 px-2"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {spellingData.words.length === 0 && (
                <div className="text-center py-6">
                  <div className="mx-auto w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
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
              <Input
                type="text"
                value={newSound}
                onChange={(e) => setNewSound(e.target.value)}
                placeholder="Enter a sound"
                onKeyPress={(e) => e.key === 'Enter' && addSound()}
                className="flex-1"
              />
              <Button onClick={addSound} disabled={isLoading || !newSound.trim()} size="sm" className="flex-shrink-0">
                {isLoading ? 'Adding...' : 'Add'}
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {spellingData.sounds.map((sound, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors duration-200 group"
                >
                  <span className="text-gray-800 font-medium text-sm">{sound}</span>
                  <Button
                    onClick={() => removeItem('sounds', index)}
                    disabled={isLoading}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200 h-7 px-2"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {spellingData.sounds.length === 0 && (
                <div className="text-center py-6">
                  <div className="mx-auto w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
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
              <Input
                type="text"
                value={newSpelling}
                onChange={(e) => setNewSpelling(e.target.value)}
                placeholder="Enter spelling"
                onKeyPress={(e) => e.key === 'Enter' && addSpelling()}
                className="flex-1"
              />
              <Button
                onClick={addSpelling}
                disabled={isLoading || !newSpelling.trim()}
                size="sm"
                className="flex-shrink-0"
              >
                {isLoading ? 'Adding...' : 'Add'}
              </Button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {spellingData.spelling.map((spell, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors duration-200 group"
                >
                  <span className="text-gray-800 font-medium text-sm">{spell}</span>
                  <Button
                    onClick={() => removeItem('spelling', index)}
                    disabled={isLoading}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200 h-7 px-2"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {spellingData.spelling.length === 0 && (
                <div className="text-center py-6">
                  <div className="mx-auto w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Summary</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
            <div className="text-xl font-bold text-blue-600 mb-1">{spellingData.words.length}</div>
            <div className="text-xs font-medium text-blue-700">Words</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
            <div className="text-xl font-bold text-green-600 mb-1">{spellingData.sounds.length}</div>
            <div className="text-xs font-medium text-green-700">Sounds</div>
          </div>
          <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg border border-purple-100">
            <div className="text-xl font-bold text-purple-600 mb-1">{spellingData.spelling.length}</div>
            <div className="text-xs font-medium text-purple-700">Spelling</div>
          </div>
        </div>
      </div>
    </div>
  )
}
