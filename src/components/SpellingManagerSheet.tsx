'use client'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import PatternListsManager from './PatternListsManager'

/**
 * Sheet containing the pattern-based word list manager.
 * Replaces the old flat (words/sounds/spelling) manager.
 */
export default function SpellingManagerSheet({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}) {
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-[95vw] max-w-[560px] overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold text-foreground">My Spelling Lists</SheetTitle>
          <SheetDescription>
            Organize words by spelling pattern. Each list groups words under the patterns that spell a target sound.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 py-4">
          <PatternListsManager />
        </div>
      </SheetContent>
    </Sheet>
  )
}
