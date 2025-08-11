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
  onConfirm: () => void
  onExport: () => void
  existingDataCount: number
}

export default function ImportConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  onExport,
  existingDataCount,
}: ImportConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Spelling Data</DialogTitle>
          <DialogDescription>
            You currently have {existingDataCount} item{existingDataCount !== 1 ? 's' : ''} in your spelling data.
            Importing new data will replace all existing items.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export Current Data
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="gap-2">
            <Upload className="h-4 w-4" />
            Import & Replace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
