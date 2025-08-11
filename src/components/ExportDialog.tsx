'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download } from 'lucide-react'

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  onExport: (filename: string) => void
}

export default function ExportDialog({ isOpen, onClose, onExport }: ExportDialogProps) {
  const [filename, setFilename] = useState('')

  useEffect(() => {
    if (isOpen) {
      // Generate default filename with date and time
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-') // HH-MM-SS
      const defaultFilename = `spelling-data-${dateStr}-${timeStr}.json`
      setFilename(defaultFilename)
    }
  }, [isOpen])

  function handleExport() {
    if (filename.trim()) {
      onExport(filename.trim())
      onClose()
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') {
      handleExport()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Your Spelling Collection</DialogTitle>
          <DialogDescription>
            Give your file a name so you can easily find it later. We'll save it as a JSON file for you.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="My spelling collection..."
            className="w-full"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} className="gap-2" disabled={!filename.trim()}>
            <Download className="h-4 w-4" />
            Save File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
