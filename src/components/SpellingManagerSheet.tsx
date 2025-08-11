'use client'

import React, { useState, useRef } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'
import SpellingManager from './SpellingManager'
import ImportConfirmDialog from './ImportConfirmDialog'
import {
  exportSpellingData,
  importSpellingData,
  hasSpellingData,
  getSpellingDataCount,
  type SpellingData,
} from '@/lib/spelling-utils'

export default function SpellingManagerSheet({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  const [spellingData, setSpellingData] = useState<SpellingData>({ words: [], sounds: [], spelling: [] })
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    exportSpellingData(spellingData)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const importedData = await importSpellingData(file)

      if (hasSpellingData(spellingData)) {
        // Show confirmation dialog if there's existing data
        setPendingImportFile(file)
        setShowImportDialog(true)
      } else {
        // Direct import if no existing data
        setSpellingData(importedData)
      }
    } catch (error) {
      alert('Failed to import file. Please check the file format.')
    }

    // Reset file input
    event.target.value = ''
  }

  async function handleImportConfirm() {
    if (!pendingImportFile) return

    try {
      const importedData = await importSpellingData(pendingImportFile)
      setSpellingData(importedData)
      setShowImportDialog(false)
      setPendingImportFile(null)
    } catch (error) {
      alert('Failed to import file. Please check the file format.')
    }
  }

  function handleImportCancel() {
    setShowImportDialog(false)
    setPendingImportFile(null)
  }

  function handleExportFromDialog() {
    exportSpellingData(spellingData)
    setShowImportDialog(false)
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-[95vw] max-w-[1000px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold text-foreground">Spelling Manager</SheetTitle>
            <SheetDescription>
              <div className="flex gap-2 mt-4 justify-end">
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
            </SheetDescription>
          </SheetHeader>

          <div className="px-4">
            <SpellingManager spellingData={spellingData} setSpellingData={setSpellingData} />
          </div>
        </SheetContent>
      </Sheet>

      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} style={{ display: 'none' }} />

      <ImportConfirmDialog
        isOpen={showImportDialog}
        onClose={handleImportCancel}
        onConfirm={handleImportConfirm}
        onExport={handleExportFromDialog}
        existingDataCount={getSpellingDataCount(spellingData)}
      />
    </>
  )
}
