'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PowerBar } from '@/components/ui/power-bar'

interface FrequencyHelpDialogProps {
  isOpen: boolean
  onClose: () => void
  accentFill: string
}

const LEVELS = [
  {
    label: 'Common',
    level: 3 as const,
    meaning: 'Shows up in most words with this sound. Teach this spelling first.',
  },
  {
    label: 'Less common',
    level: 2 as const,
    meaning: 'Shows up sometimes. Teach it after the common spelling.',
  },
  {
    label: 'Rare',
    level: 1 as const,
    meaning: 'Shows up in just a few words. Teach it last, or skip it for now.',
  },
]

/**
 * Explains what pattern frequency means and what each level implies for
 * teaching order. Opened from the (?) button next to the Frequency label.
 */
export default function FrequencyHelpDialog({ isOpen, onClose, accentFill }: FrequencyHelpDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ink">About frequency</DialogTitle>
        </DialogHeader>
        <p className="text-[14px] text-muted-foreground">
          How often this spelling shows up for the sound. Common spellings get the widest column on the chart.
        </p>
        <div className="space-y-4">
          {LEVELS.map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="rounded-xl border-2 border-line p-2">
                <PowerBar level={f.level} filledClassName={accentFill} />
              </div>
              <div>
                <p className="font-bold text-ink">{f.label}</p>
                <p className="text-[13px] text-muted-foreground">{f.meaning}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
