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
          <DialogTitle className="text-2xl font-bold text-ink">Get help</DialogTitle>
          <DialogDescription className="text-[15px] leading-6 text-muted-foreground">
            If you need help with PatternSpell, please reach out to your school administrator.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
