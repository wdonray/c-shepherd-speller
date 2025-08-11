'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'

interface ImportConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onExport: () => void
  onProceed: () => void
  existingDataCount: number
}

export default function ImportConfirmDialog({
  isOpen,
  onClose,
  onExport,
  onProceed,
  existingDataCount,
}: ImportConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Spelling Collection</DialogTitle>
          <DialogDescription>
            You currently have {existingDataCount} item{existingDataCount !== 1 ? 's' : ''} in your spelling collection.
            Adding a new collection will replace your current items. Would you like to save your current collection
            first?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Save Current Collection
          </Button>
          <Button onClick={onProceed} className="gap-2">
            <Upload className="h-4 w-4" />
            Add New Collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
