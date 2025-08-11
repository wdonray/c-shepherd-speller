'use client'

import SpellingDataCard from './SpellingDataCard'

type SpellingDataKey = 'words' | 'sounds' | 'spelling'

interface SpellingData {
  words: string[]
  sounds: string[]
  spelling: string[]
}

interface SpellingManagerProps {
  spellingData: SpellingData
  newWord: string
  setNewWord: React.Dispatch<React.SetStateAction<string>>
  newSound: string
  setNewSound: React.Dispatch<React.SetStateAction<string>>
  newSpelling: string
  setNewSpelling: React.Dispatch<React.SetStateAction<string>>
  addWord: () => Promise<void>
  addSound: () => Promise<void>
  addSpelling: () => Promise<void>
  removeItem: (type: SpellingDataKey, index: number) => Promise<void>
  loadingSpellingData: boolean
  loadingHandler: { words: boolean; sounds: boolean; spelling: boolean }
}

export default function SpellingManager({
  spellingData,
  newWord,
  setNewWord,
  newSound,
  setNewSound,
  newSpelling,
  setNewSpelling,
  addWord,
  addSound,
  addSpelling,
  removeItem,
  loadingSpellingData,
  loadingHandler,
}: SpellingManagerProps) {
  if (loadingSpellingData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading your spelling collection...</p>
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
