'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface HelpDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Help</DialogTitle>
          <DialogDescription>
            If you need help, please contact us at{' '}
            <a href="mailto:support@shepherdspeller.com">support@shepherdspeller.com</a>.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
