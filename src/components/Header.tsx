'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
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
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { notifyListsChanged } from '@/lib/lists-api'
import { getUserByEmail } from '@/lib/spelling-api'
import { processProfileImage } from '@/lib/profile-image'
import { reportError } from '@/lib/report-error'
import { getToastMessage, toastError, HttpError } from '@/lib/error-toast'

function initialsFor(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

// The tappable photo (with camera badge) is shared between the desktop
// account menu and the mobile menu's account header.
function photoButtonContent(avatarImage: string | undefined, initials: string, onImageError: () => void) {
  return (
    <>
      {avatarImage ? (
        <img
          src={avatarImage}
          alt=""
          aria-hidden="true"
          className="size-full rounded-full object-cover"
          onError={onImageError}
        />
      ) : (
        initials
      )}
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-leaf text-white ring-2 ring-card"
      >
        <Camera className="size-3" />
      </span>
    </>
  )
}

const PHOTO_BUTTON_CLASS =
  'relative flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-chunk-sky text-base font-bold text-white outline-none transition hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-ring/60'

export function Header() {
  const { data: session } = useSession()
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const [isImportExportOpen, setIsImportExportOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const desktopPhotoButtonRef = useRef<HTMLButtonElement>(null)
  const mobilePhotoButtonRef = useRef<HTMLButtonElement>(null)
  // Which photo button opened the picker, so focus returns to the right one.
  const photoFocusTargetRef = useRef<HTMLButtonElement | null>(null)
  // Which surface ('desktop' | 'mobile') the upload was initiated from, so
  // post-upload UI only touches that surface. Null when nothing was
  // recorded, e.g. tests that drive the file input directly.
  const photoSourceRef = useRef<'desktop' | 'mobile' | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const { setTheme, theme } = useTheme()
  const isDark = useMemo(() => theme === 'dark', [theme])
  const [profileImage, setProfileImage] = useState<string | undefined>(undefined)
  const [avatarBroken, setAvatarBroken] = useState(false)
  // Last image URL applied to state. A freshly fetched URL gets a fresh
  // load attempt; a URL that already failed keeps showing initials
  // instead of a broken image.
  const profileImageRef = useRef<string | undefined>(undefined)

  function applyProfileImage(image: string | undefined) {
    if (image !== profileImageRef.current) setAvatarBroken(false)
    profileImageRef.current = image
    setProfileImage(image)
  }

  useEffect(() => {
    let cancelled = false
    async function fetchProfileImage() {
      if (!session?.user?.email) return
      try {
        const user = await getUserByEmail(session.user.email)
        if (!cancelled) applyProfileImage(user.image || undefined)
      } catch (error) {
        // Header still works with the Google image or initials fallback.
        reportError(error, { location: 'Header.fetchProfileImage' })
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
        applyProfileImage(detailImage || undefined)
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

  // The photo at the top of the account menu (desktop) or the bottom
  // sheet (mobile) opens the file picker directly. The desktop account
  // menu stays open behind the native dialog; the mobile sheet has no
  // popover, so nothing must open there after the upload completes.
  function openPhotoPicker(source: 'desktop' | 'mobile', sourceRef: React.RefObject<HTMLButtonElement | null>) {
    photoSourceRef.current = source
    photoFocusTargetRef.current = sourceRef.current
    photoInputRef.current?.click()
  }

  async function handleMenuPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    try {
      if (!file || !session?.user?.email) return
      const dataUrl = await processProfileImage(file)
      // Use the app-table user id, NOT session.user.id. The session carries
      // the next-auth UUID, but /api/users/[id] checks ownership against the
      // app-table id from getUserByEmail; using the session id always 403s.
      const user = await getUserByEmail(session.user.email)
      if (!user) throw new Error('Could not find your profile. Please try again.')
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      if (!response.ok) throw new HttpError('Failed to update photo', response.status)
      setAvatarBroken(false)
      applyProfileImage(dataUrl)
      window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_UPDATED_EVENT, { detail: { image: dataUrl } }))
    } catch (error) {
      reportError(error, { location: 'Header.handleMenuPhotoSelect' })
      toastError(getToastMessage(error))
    } finally {
      // The native picker is an OS dialog; reassert the menu in case Radix
      // closed it on focus loss, and return focus to the photo button that
      // opened the picker. The reassert only applies to the desktop account
      // menu: on mobile the upload comes from the bottom sheet, which has
      // no popover, so opening it here would flash the desktop popover over
      // the phone UI. An unrecorded source (e.g. tests driving the input
      // directly) keeps the desktop behavior.
      if (photoSourceRef.current !== 'mobile') {
        setIsAccountMenuOpen(true)
      }
      ;(photoFocusTargetRef.current ?? desktopPhotoButtonRef.current)?.focus()
    }
  }

  // Re-read the stored photo. The mount-time fetch can miss it (the email
  // lookup hits an eventually-consistent index, and the record can be
  // created after the header mounts), while the profile page fetches on its
  // own mount and looks correct. Refreshing whenever a menu opens keeps the
  // account header truthful instead of showing stale initials.
  async function refreshProfileImage() {
    const email = session?.user?.email
    if (!email) return
    try {
      const user = await getUserByEmail(email)
      applyProfileImage(user.image || undefined)
    } catch (error) {
      // Keep whatever the header already shows; a failed refresh must not
      // blank a photo that is already displayed.
      reportError(error, { location: 'Header.refreshProfileImage' })
    }
  }

  function handleMobileMenuOpenChange(open: boolean) {
    setIsMobileMenuOpen(open)
    if (open) void refreshProfileImage()
  }

  function handleAccountMenuOpenChange(open: boolean) {
    setIsAccountMenuOpen(open)
    if (open) void refreshProfileImage()
  }

  // Mobile menu actions that open dialogs: close the sheet first so the
  // dialog doesn't sit behind it.
  function openImportExportFromMenu() {
    setIsMobileMenuOpen(false)
    setIsImportExportOpen(true)
  }

  function toggleThemeFromMenu() {
    setIsMobileMenuOpen(false)
    setTheme(isDark ? 'light' : 'dark')
  }

  function openHelpFromMenu() {
    setIsMobileMenuOpen(false)
    setIsHelpDialogOpen(true)
  }

  const accountName = session.user.name || 'Your profile'
  const accountEmail = session.user.email
  const accountInitials = initialsFor(session.user.name, session.user.email)
  const markImageBroken = () => setAvatarBroken(true)

  return (
    <header className="sticky top-0 z-50 w-full bg-card">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4">
        <Link
          href="/home"
          aria-label="PatternSpell home"
          className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <PatternMark label="PatternSpell logo" />
          <span className="text-[22px] font-bold tracking-tight">PatternSpell</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <Button size="sm" asChild>
              <Link href="/lists">My Spelling Lists</Link>
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/display">Present</Link>
            </Button>
          </div>
          {/*
            The avatar account menu is desktop-only. On mobile there is a
            single menu entry point (the hamburger below): its bottom sheet
            carries the account header plus every navigation and account
            action, grouped. Two menu-like controls side by side in the
            top bar breaks the one-clear-entry-point mobile pattern, so the
            avatar trigger is hidden below the md breakpoint.
          */}
          <div className="hidden md:block">
            <DropdownMenu open={isAccountMenuOpen} onOpenChange={handleAccountMenuOpenChange}>
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
                      onError={markImageBroken}
                    />
                  ) : (
                    accountInitials
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl border-2 border-line bg-card p-2">
                <div className="flex items-center gap-3 px-2 py-2">
                  <button
                    ref={desktopPhotoButtonRef}
                    type="button"
                    onClick={() => openPhotoPicker('desktop', desktopPhotoButtonRef)}
                    aria-label="Change profile photo"
                    className={PHOTO_BUTTON_CLASS}
                  >
                    {photoButtonContent(avatarImage, accountInitials, markImageBroken)}
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-ink">{accountName}</p>
                    <p className="truncate text-xs text-muted-foreground">{accountEmail}</p>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-line" />
                <DropdownMenuItem
                  className="rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer focus:bg-accent"
                  onSelect={openImportExportFromMenu}
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
                <DropdownMenuItem
                  asChild
                  className="rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer focus:bg-accent"
                >
                  <Link href="/feedback">Give feedback</Link>
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
          </div>
          <Sheet open={isMobileMenuOpen} onOpenChange={handleMobileMenuOpenChange}>
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
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex max-h-[75dvh] flex-col gap-2 overflow-y-auto px-4">
                <div className="flex items-center gap-3 px-2 py-1">
                  <button
                    ref={mobilePhotoButtonRef}
                    type="button"
                    onClick={() => openPhotoPicker('mobile', mobilePhotoButtonRef)}
                    aria-label="Change profile photo"
                    className={PHOTO_BUTTON_CLASS}
                  >
                    {photoButtonContent(avatarImage, accountInitials, markImageBroken)}
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-ink">{accountName}</p>
                    <p className="truncate text-xs text-muted-foreground">{accountEmail}</p>
                  </div>
                </div>
                <Separator className="bg-line" />
                <p className="px-2 pt-1 text-xs font-semibold text-muted-foreground">Navigate</p>
                <nav aria-label="Mobile navigation" className="flex flex-col gap-2">
                  <SheetClose asChild>
                    <Button size="lg" asChild>
                      <Link href="/lists">My Spelling Lists</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button size="lg" variant="secondary" asChild>
                      <Link href="/display">Present</Link>
                    </Button>
                  </SheetClose>
                </nav>
                <p className="px-2 pt-2 text-xs font-semibold text-muted-foreground">Account</p>
                <div className="flex flex-col gap-1">
                  <SheetClose asChild>
                    <Button size="lg" variant="ghost" asChild className="justify-start px-4">
                      <Link href="/profile">Profile</Link>
                    </Button>
                  </SheetClose>
                  <Button size="lg" variant="ghost" className="justify-start px-4" onClick={openImportExportFromMenu}>
                    Import / export
                  </Button>
                  <Button size="lg" variant="ghost" className="justify-start px-4" onClick={toggleThemeFromMenu}>
                    Theme: {isDark ? 'Light' : 'Dark'}
                  </Button>
                  <Button size="lg" variant="ghost" className="justify-start px-4" onClick={openHelpFromMenu}>
                    Get help
                  </Button>
                </div>
                <Separator className="bg-line" />
                <div className="flex flex-col gap-1">
                  <SheetClose asChild>
                    <Button size="lg" variant="ghost" asChild className="justify-start px-4">
                      <Link href="/version">Version</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button size="lg" variant="ghost" asChild className="justify-start px-4">
                      <Link href="/analytics">Analytics</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button size="lg" variant="ghost" asChild className="justify-start px-4">
                      <Link href="/feedback">Give feedback</Link>
                    </Button>
                  </SheetClose>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="justify-start px-4 text-coral-ink hover:text-coral-ink focus-visible:text-coral-ink"
                    onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                  >
                    <LogOutIcon className="size-4" />
                    Sign out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div className="h-[2px] w-full bg-line" aria-hidden="true" />
      <HelpDialog isOpen={isHelpDialogOpen} onClose={() => setIsHelpDialogOpen(false)} />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
