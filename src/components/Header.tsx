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
import { Camera, LogOutIcon, MenuIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import HelpDialog from './HelpDialog'
import { PROFILE_PHOTO_UPDATED_EVENT } from './ProfileForm'
import ImportExportDialog from './ImportExportDialog'
import { PatternMark } from './PatternMark'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { notifyListsChanged } from '@/lib/lists-api'
import { getUserByEmail } from '@/lib/spelling-api'
import { processProfileImage } from '@/lib/profile-image'

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
  const [isImportExportOpen, setIsImportExportOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const menuPhotoButtonRef = useRef<HTMLButtonElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const { setTheme, theme } = useTheme()
  const isDark = useMemo(() => theme === 'dark', [theme])
  const [profileImage, setProfileImage] = useState<string | undefined>(undefined)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [menuPhotoError, setMenuPhotoError] = useState<string | null>(null)

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
    const refresh = (event?: Event) => {
      const detailImage = (event as CustomEvent<{ image?: unknown }> | undefined)?.detail?.image
      if (typeof detailImage === 'string') {
        // The uploader already knows the new image; apply it directly.
        // A re-fetch here can return stale data because the email lookup
        // queries an eventually-consistent index.
        setAvatarBroken(false)
        setProfileImage(detailImage || undefined)
        return
      }
      fetchProfileImage()
    }
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

  // The photo at the top of the account menu opens the file picker directly,
  // and the menu stays open behind the native dialog. The Profile menu item
  // below opens the full profile dialog.
  function handleMenuPhotoClick() {
    photoInputRef.current?.click()
  }

  async function handleMenuPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    setMenuPhotoError(null)
    try {
      if (!file || !session?.user?.id) return
      const dataUrl = await processProfileImage(file)
      const response = await fetch(`/api/users/${session.user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      if (!response.ok) throw new Error('Failed to update photo')
      setProfileImage(dataUrl)
      setAvatarBroken(false)
      window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_UPDATED_EVENT, { detail: { image: dataUrl } }))
    } catch {
      setMenuPhotoError('Could not update your photo. Check your connection and try again.')
    } finally {
      // The native picker is an OS dialog; reassert the menu in case Radix
      // closed it on focus loss, and return focus to the photo button.
      setIsAccountMenuOpen(true)
      menuPhotoButtonRef.current?.focus()
    }
  }

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
          <DropdownMenu open={isAccountMenuOpen} onOpenChange={setIsAccountMenuOpen}>
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
              <div className="flex items-center gap-3 px-2 py-2">
                <button
                  ref={menuPhotoButtonRef}
                  type="button"
                  onClick={handleMenuPhotoClick}
                  aria-label="Change profile photo"
                  className="relative flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-chunk-sky text-base font-bold text-white outline-none transition hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-ring/60"
                >
                  {avatarImage ? (
                    <img
                      src={avatarImage}
                      alt=""
                      aria-hidden="true"
                      className="size-full rounded-full object-cover"
                      onError={() => setAvatarBroken(true)}
                    />
                  ) : (
                    initialsFor(session.user.name, session.user.email)
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-leaf text-white ring-2 ring-card"
                  >
                    <Camera className="size-3" />
                  </span>
                </button>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-ink">{session.user.name || 'Your profile'}</p>
                  <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                </div>
              </div>
              {menuPhotoError && (
                <p role="alert" className="px-4 py-2 text-sm font-semibold text-coral-ink">
                  {menuPhotoError}
                </p>
              )}
              <DropdownMenuSeparator className="bg-line" />
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
                asChild
                className="rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer focus:bg-accent"
              >
                <Link href="/profile">Profile</Link>
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
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleMenuPhotoSelect}
        aria-label="Upload profile photo"
        tabIndex={-1}
      />
      <ImportExportDialog
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        onImported={notifyListsChanged}
      />
    </header>
  )
}
