'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  getSpelling,
  addWord as addWordApi,
  addSound as addSoundApi,
  addSpelling as addSpellingApi,
  removeItem as removeItemApi,
  updateLastActive,
  getUserByEmail,
} from '@/lib/spelling-api'
import { Separator } from '@/components/ui/separator'
import SpellingDataCard from './SpellingDataCard'

type SpellingDataKey = 'words' | 'sounds' | 'spelling'

interface SpellingData {
  words: string[]
  sounds: string[]
  spelling: string[]
}

interface SpellingManagerProps {
  spellingData?: SpellingData
  setSpellingData?: React.Dispatch<React.SetStateAction<SpellingData>>
}

export default function SpellingManager({
  spellingData: externalSpellingData,
  setSpellingData: externalSetSpellingData,
}: SpellingManagerProps = {}) {
  const { data: session } = useSession()
  const [userId, setUserId] = useState<string>('')
  const [internalSpellingData, setInternalSpellingData] = useState<SpellingData>({
    words: [],
    sounds: [],
    spelling: [],
  })

  // Use external data if provided, otherwise use internal state
  const spellingData = externalSpellingData || internalSpellingData
  const setSpellingData = externalSetSpellingData || setInternalSpellingData
  const [newWord, setNewWord] = useState('')
  const [newSound, setNewSound] = useState('')
  const [newSpelling, setNewSpelling] = useState('')
  const [loadingSpellingData, setLoadingSpellingData] = useState(false)
  const [loadingHandler, setLoadingHandler] = useState({ words: false, sounds: false, spelling: false })

  useEffect(() => {
    async function loadSpellingData() {
      setLoadingSpellingData(true)
      const userEmail = session?.user?.email
      if (!userEmail) return
      const userId = await getUserByEmail(userEmail)
      if (!userId) return
      setUserId(userId)
      const spellingData = await getSpelling(userId)
      setSpellingData(spellingData)
      updateLastActive(userId)
      setLoadingSpellingData(false)
    }

    if (session?.user?.id) loadSpellingData()
  }, [session?.user?.id])

  async function addWord() {
    if (!newWord.trim() || !userId) return

    setLoadingHandler((prev) => ({ ...prev, words: true }))
    await addWordApi(userId, newWord.trim(), spellingData.words)
    setSpellingData((prev) => ({ ...prev, words: [...prev.words, newWord.trim()] }))
    setNewWord('')
    updateLastActive(userId)
    setLoadingHandler((prev) => ({ ...prev, words: false }))
  }

  async function addSound() {
    if (!newSound.trim() || !userId) return

    setLoadingHandler((prev) => ({ ...prev, sounds: true }))
    await addSoundApi(userId, newSound.trim(), spellingData.sounds)
    setSpellingData((prev) => ({ ...prev, sounds: [...prev.sounds, newSound.trim()] }))
    setNewSound('')
    updateLastActive(userId)
    setLoadingHandler((prev) => ({ ...prev, sounds: false }))
  }

  async function addSpelling() {
    if (!newSpelling.trim() || !userId) return

    setLoadingHandler((prev) => ({ ...prev, spelling: true }))
    await addSpellingApi(userId, newSpelling.trim(), spellingData.spelling)
    setSpellingData((prev) => ({ ...prev, spelling: [...prev.spelling, newSpelling.trim()] }))
    setNewSpelling('')
    updateLastActive(userId)
    setLoadingHandler((prev) => ({ ...prev, spelling: false }))
  }

  async function removeItem(type: SpellingDataKey, index: number) {
    if (!userId) return

    setLoadingHandler((prev) => ({ ...prev, [type]: true }))
    await removeItemApi(userId, type, index, spellingData[type])
    const updatedArray = spellingData[type].filter((_, i) => i !== index)
    setSpellingData((prev) => ({ ...prev, [type]: updatedArray }))
    updateLastActive(userId)
    setLoadingHandler((prev) => ({ ...prev, [type]: false }))
  }

  if (loadingSpellingData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading spelling data...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SpellingDataCard
        title="Words"
        value={newWord}
        setValue={setNewWord}
        addItem={addWord}
        removeItem={(index) => removeItem('words', index)}
        spellingData={spellingData.words}
        loading={loadingHandler.words}
      />

      <SpellingDataCard
        title="Sounds"
        value={newSound}
        setValue={setNewSound}
        addItem={addSound}
        removeItem={(index) => removeItem('sounds', index)}
        spellingData={spellingData.sounds}
        loading={loadingHandler.sounds}
      />

      <SpellingDataCard
        title="Spelling"
        value={newSpelling}
        setValue={setNewSpelling}
        addItem={addSpelling}
        removeItem={(index) => removeItem('spelling', index)}
        spellingData={spellingData.spelling}
        loading={loadingHandler.spelling}
      />
    </div>
  )
}
