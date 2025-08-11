'use client'

import { signOut, useSession } from 'next-auth/react'
import { ThemeToggle } from '@/components/ThemeToggle'
import SpellingManagerSheet from './SpellingManagerSheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserIcon, LogOutIcon, HelpCircleIcon, BookOpenIcon } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const { data: session } = useSession()
  const [isSpellingManagerOpen, setIsSpellingManagerOpen] = useState(false)

  if (session?.user?.id == null) {
    return null
  }

  return (
    <fieldset disabled={session?.user?.id == null}>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container m-auto px-8 flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg md:text-2xl font-bold">Shepherd Speller</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setIsSpellingManagerOpen(true)}>
              <BookOpenIcon className="size-4" />
              <span className="hidden sm:inline-block">My Spelling Lists</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <UserIcon className="size-4" />
                  <span className="hidden sm:inline-block">{session?.user?.name || 'Teacher'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session?.user?.name || 'Teacher'}</p>
                    <p className="text-xs leading-none text-muted-foreground">{session?.user?.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <HelpCircleIcon className="size-4" />
                  Get Help
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOutIcon className="size-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
          </div>
        </div>
        <SpellingManagerSheet isOpen={isSpellingManagerOpen} setIsOpen={setIsSpellingManagerOpen} />
      </header>
    </fieldset>
  )
}
