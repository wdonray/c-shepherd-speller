'use client'

import React, { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import SpellingManager from './SpellingManager'

export default function SpellingManagerSheet() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
        >
          📚 Open Spelling Manager
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[95vw] max-w-[1000px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Spelling Manager
          </SheetTitle>
          <SheetDescription className="text-lg">Manage your words, sounds, and spelling data</SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <SpellingManager />
        </div>
      </SheetContent>
    </Sheet>
  )
}
