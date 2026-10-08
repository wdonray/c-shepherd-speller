'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import SpellingManagerSheet from './SpellingManagerSheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOutIcon, MenuIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import HelpDialog from './HelpDialog'
import ProfileDialog, { PROFILE_PHOTO_UPDATED_EVENT } from './ProfileDialog'
import ImportExportDialog from './ImportExportDialog'
import { PatternMark } from './PatternMark'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { notifyListsChanged } from '@/lib/lists-api'
import { getUserByEmail } from '@/lib/spelling-api'

function initialsFor(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

export function Header() {
  const { data: session } = useSession()
  const [isSpellingManagerOpen, setIsSpellingManagerOpen] = useState(false)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isImportExportOpen, setIsImportExportOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { setTheme, theme } = useTheme()
  const isDark = useMemo(() => theme === 'dark', [theme])
  const [profileImage, setProfileImage] = useState<string | undefined>(undefined)
  const [avatarBroken, setAvatarBroken] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchProfileImage() {
      if (!session?.user?.email) return
      try {
        const user = await getUserByEmail(session.user.email)
        if (!cancelled) setProfileImage(user.image || undefined)
      } catch {
        // Header still works with the Google image or initials fallback.
      }
    }
    fetchProfileImage()
    const refresh = () => fetchProfileImage()
    window.addEventListener(PROFILE_PHOTO_UPDATED_EVENT, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(PROFILE_PHOTO_UPDATED_EVENT, refresh)
    }
  }, [session?.user?.email])

  if (session?.user?.id == null) {
    return null
  }

  // An uploaded photo overrides the Google-provided image; initials are the last resort.
  // If the image URL fails to load, fall back to initials instead of a broken image.
  const avatarImage = avatarBroken ? undefined : (profileImage ?? session.user.image ?? undefined)

  return (
    <header className="sticky top-0 z-50 w-full bg-card">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          aria-label="PatternSpell home"
          className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <PatternMark label="PatternSpell logo" />
          <span className="text-[22px] font-bold tracking-tight">PatternSpell</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <Button size="sm" onClick={() => setIsSpellingManagerOpen(true)}>
              My Spelling Lists
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/display">Present</Link>
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open account menu"
                className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-chunk-sky text-sm font-bold text-white shadow-[0_4px_0_var(--color-chunk-sky-deep)] transition hover:brightness-110 focus-visible:brightness-110 active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-chunk-sky-deep)] cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
              >
                {avatarImage ? (
                  <img
                    src={avatarImage}
                    alt=""
                    aria-hidden="true"
                    className="size-full object-cover"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  initialsFor(session.user.name, session.user.email)
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl border-2 border-line bg-card p-2">
              <DropdownMenuItem
                className="rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer focus:bg-accent"
                onSelect={() => setIsImportExportOpen(true)}
              >
                Import / export
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer focus:bg-accent"
                onSelect={() => setTheme(isDark ? 'light' : 'dark')}
              >
                Theme: {isDark ? 'Light' : 'Dark'}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer focus:bg-accent"
                onSelect={() => setIsHelpDialogOpen(true)}
              >
                Get help
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer focus:bg-accent"
                onSelect={() => setIsProfileDialogOpen(true)}
              >
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-line" />
              <DropdownMenuItem
                asChild
                className="rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer focus:bg-accent"
              >
                <Link href="/version">Version</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                className="rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer focus:bg-accent"
              >
                <Link href="/analytics">Analytics</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-line" />
              <DropdownMenuItem
                className="rounded-xl px-4 py-3 text-[15px] font-semibold text-coral-ink cursor-pointer focus:bg-coral-soft"
                onSelect={() => signOut({ callbackUrl: '/auth/signin' })}
              >
                <LogOutIcon className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="icon" className="md:hidden" aria-label="Open menu">
                <MenuIcon className="size-5" aria-hidden="true" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-3xl border-t-2 border-line bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]"
            >
              <SheetHeader>
                <SheetTitle>PatternSpell</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="flex flex-col gap-3 px-4">
                <SheetClose asChild>
                  <Button size="lg" onClick={() => setIsSpellingManagerOpen(true)}>
                    My Spelling Lists
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button size="lg" variant="secondary" asChild>
                    <Link href="/display">Present</Link>
                  </Button>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div className="h-[2px] w-full bg-line" aria-hidden="true" />
      <SpellingManagerSheet isOpen={isSpellingManagerOpen} setIsOpen={setIsSpellingManagerOpen} />
      <HelpDialog isOpen={isHelpDialogOpen} onClose={() => setIsHelpDialogOpen(false)} />
      <ProfileDialog isOpen={isProfileDialogOpen} onClose={() => setIsProfileDialogOpen(false)} />
      <ImportExportDialog
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        onImported={notifyListsChanged}
      />
    </header>
  )
}
