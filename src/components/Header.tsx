'use client'

import { signOut, useSession } from 'next-auth/react'
import SpellingManagerSheet from './SpellingManagerSheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserIcon, LogOutIcon, HelpCircleIcon, BookOpenIcon, Settings, SunIcon, MoonIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import HelpDialog from './HelpDialog'
import ProfileDialog from './ProfileDialog'

export function Header() {
  const { data: session } = useSession()
  const [isSpellingManagerOpen, setIsSpellingManagerOpen] = useState(false)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const { setTheme, theme } = useTheme()
  const isDark = useMemo(() => theme === 'dark', [theme])

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
                  <Settings className="size-4" />
                  <span className="hidden sm:inline-block">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')}>
                  {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
                  <span>{isDark ? 'Light' : 'Dark'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsHelpDialogOpen(true)}>
                  <HelpCircleIcon className="size-4" />
                  Get Help
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsProfileDialogOpen(true)}>
                  <UserIcon className="size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/auth/signin' })}>
                  <LogOutIcon className="size-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <SpellingManagerSheet isOpen={isSpellingManagerOpen} setIsOpen={setIsSpellingManagerOpen} />
        <HelpDialog isOpen={isHelpDialogOpen} onClose={() => setIsHelpDialogOpen(false)} />
        <ProfileDialog isOpen={isProfileDialogOpen} onClose={() => setIsProfileDialogOpen(false)} />
      </header>
    </fieldset>
  )
}
