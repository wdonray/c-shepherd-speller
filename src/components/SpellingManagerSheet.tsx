'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'
import SpellingManager from './SpellingManager'
import ImportConfirmDialog from './ImportConfirmDialog'
import ExportDialog from './ExportDialog'
import {
  exportSpellingData,
  importSpellingData,
  hasSpellingData,
  getSpellingDataCount,
  type SpellingData,
} from '@/lib/spelling-utils'
import {
  getSpelling,
  addWord as addWordApi,
  addSound as addSoundApi,
  addSpelling as addSpellingApi,
  removeItem as removeItemApi,
  updateLastActive,
  getUserByEmail,
  saveSpellingData,
} from '@/lib/spelling-api'

type SpellingDataKey = 'words' | 'sounds' | 'spelling'

export default function SpellingManagerSheet({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const { data: session } = useSession()
  const [userId, setUserId] = useState<string>('')
  const [spellingData, setSpellingData] = useState<SpellingData>({ words: [], sounds: [], spelling: [] })
  const [newWord, setNewWord] = useState('')
  const [newSound, setNewSound] = useState('')
  const [newSpelling, setNewSpelling] = useState('')
  const [loadingSpellingData, setLoadingSpellingData] = useState(false)
  const [loadingHandler, setLoadingHandler] = useState({ words: false, sounds: false, spelling: false })
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadSpellingData() {
      setLoadingSpellingData(true)
      const userEmail = session?.user?.email
      if (!userEmail) return
      const user = await getUserByEmail(userEmail)
      if (!user) return
      setUserId(user.id)
      const spellingData = await getSpelling(user.id)
      setSpellingData(spellingData)
      updateLastActive(user.id)
      setLoadingSpellingData(false)
    }

    if (session?.user?.email) loadSpellingData()
  }, [session])

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

  function handleExport() {
    setShowExportDialog(true)
  }

  function handleExportWithFilename(filename: string) {
    exportSpellingData(spellingData, filename)
  }

  function handleImportClick() {
    if (hasSpellingData(spellingData)) {
      // Show confirmation dialog if there's existing data
      setShowImportDialog(true)
    } else {
      // Direct file selection if no existing data
      fileInputRef.current?.click()
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const importedData = await importSpellingData(file)

      // Save to server if we have a userId
      if (userId) {
        await saveSpellingData(userId, importedData)
        updateLastActive(userId)
      }

      setSpellingData(importedData)
    } catch (error) {
      alert('Failed to import file. Please check the file format.')
      console.error(error)
    }

    // Reset file input
    event.target.value = ''
  }

  function handleImportCancel() {
    setShowImportDialog(false)
  }

  function handleExportFromDialog() {
    // Generate a default filename for export from dialog
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-') // HH-MM-SS
    const defaultFilename = `spelling-data-${dateStr}-${timeStr}.json`
    exportSpellingData(spellingData, defaultFilename)
    setShowImportDialog(false)
  }

  function handleProceedWithImport() {
    setShowImportDialog(false)
    fileInputRef.current?.click()
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-[95vw] max-w-[1000px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold text-foreground">Spelling Collection</SheetTitle>
            <SheetDescription>
              Build your spelling lists with words, sounds, and patterns for your students.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleImportClick} className="gap-2">
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!hasSpellingData(spellingData)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>

            <SpellingManager
              spellingData={spellingData}
              newWord={newWord}
              setNewWord={setNewWord}
              newSound={newSound}
              setNewSound={setNewSound}
              newSpelling={newSpelling}
              setNewSpelling={setNewSpelling}
              addWord={addWord}
              addSound={addSound}
              addSpelling={addSpelling}
              removeItem={removeItem}
              loadingSpellingData={loadingSpellingData}
              loadingHandler={loadingHandler}
            />
          </div>
        </SheetContent>
      </Sheet>

      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} style={{ display: 'none' }} />

      <ImportConfirmDialog
        isOpen={showImportDialog}
        onClose={handleImportCancel}
        onExport={handleExportFromDialog}
        onProceed={handleProceedWithImport}
        existingDataCount={getSpellingDataCount(spellingData)}
      />

      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExportWithFilename}
      />
    </>
  )
}
