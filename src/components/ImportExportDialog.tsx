'use client'

import { useRef, useState } from 'react'
import { z } from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DownloadIcon, UploadIcon } from 'lucide-react'
import { createList, getLists } from '@/lib/lists-api'
import { CreateWordListSchema } from '@/models/WordList'

const ImportFileSchema = z.array(CreateWordListSchema)

interface ImportExportDialogProps {
  isOpen: boolean
  onClose: () => void
  /** Called after a successful import so the list views refresh. */
  onImported: () => void
}

/**
 * Import / export dialog (opened from the header menu). Export downloads all
 * word lists as JSON; import reads such a file back and creates the lists.
 */
export default function ImportExportDialog({ isOpen, onClose, onImported }: ImportExportDialogProps) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The file input is always rendered alongside its button, so the ref is set
  // whenever this can be clicked.
  const openFilePicker = () => (fileInputRef.current as HTMLInputElement).click()

  const handleExport = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const lists = await getLists()
      const blob = new Blob([JSON.stringify(lists, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `shepherd-speller-lists-${date}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMessage({
        kind: 'success',
        text: `Exported ${lists.length} ${lists.length === 1 ? 'list' : 'lists'}.`,
      })
    } catch {
      setMessage({ kind: 'error', text: 'Could not export your lists. Check your connection and try again.' })
    } finally {
      setBusy(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFileName(file?.name ?? null)
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('not-json')
      }
      const result = ImportFileSchema.safeParse(parsed)
      if (!result.success) {
        throw new Error('not-lists')
      }
      let imported = 0
      for (const input of result.data) {
        await createList(input)
        imported += 1
      }
      setMessage({ kind: 'success', text: `Imported ${imported} ${imported === 1 ? 'list' : 'lists'}.` })
      onImported()
    } catch (e) {
      if (e instanceof Error && e.message === 'not-json') {
        setMessage({ kind: 'error', text: 'That file is not valid JSON.' })
      } else if (e instanceof Error && e.message === 'not-lists') {
        setMessage({ kind: 'error', text: 'That file does not look like a PatternSpell export.' })
      } else {
        setMessage({ kind: 'error', text: 'Could not import that file. Check your connection and try again.' })
      }
    } finally {
      setBusy(false)
      // Reset the input so the same file can be picked again. The input is
      // always rendered, so the ref is set here.
      ;(fileInputRef.current as HTMLInputElement).value = ''
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import / export</DialogTitle>
          <DialogDescription>
            Back up your word lists to a file, or bring lists in from a file you exported earlier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <h3 className="font-bold">Export</h3>
            <p className="text-sm text-muted-foreground">Download all of your word lists as one JSON file.</p>
            <Button onClick={handleExport} disabled={busy}>
              <DownloadIcon className="size-4" />
              {busy ? 'Working...' : 'Export lists'}
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold">Import</h3>
            <p className="text-sm text-muted-foreground">Choose a JSON file exported from PatternSpell.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={openFilePicker} disabled={busy}>
                <UploadIcon className="size-4" />
                Choose file
              </Button>
              {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Choose a lists file to import"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {message && (
            <p
              role={message.kind === 'error' ? 'alert' : 'status'}
              className={
                message.kind === 'error'
                  ? 'text-sm font-semibold text-coral-ink'
                  : 'text-sm font-semibold text-leaf-ink'
              }
            >
              {message.text}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
