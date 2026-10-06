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
import { LogOutIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import HelpDialog from './HelpDialog'
import ProfileDialog from './ProfileDialog'
import ImportExportDialog from './ImportExportDialog'
import { PatternMark } from './PatternMark'
import { notifyListsChanged } from '@/lib/lists-api'

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
  const [migrating, setMigrating] = useState(false)
  const [migrateError, setMigrateError] = useState<string | null>(null)
  const { setTheme, theme } = useTheme()
  const isDark = useMemo(() => theme === 'dark', [theme])

  if (session?.user?.id == null) {
    return null
  }

  const handleMigrate = async (e: Event) => {
    // Keep the menu open so the error (if any) is visible in place.
    e.preventDefault()
    if (migrating) return
    setMigrating(true)
    setMigrateError(null)
    try {
      const res = await fetch('/api/migrate', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Migration failed')
      }
      notifyListsChanged()
    } catch (err) {
      setMigrateError(err instanceof Error ? err.message : 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-card">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <PatternMark label="PatternSpell logo" />
          <span className="text-[22px] font-bold tracking-tight">PatternSpell</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setIsSpellingManagerOpen(true)}>
            My Spelling Lists
          </Button>
          <Button size="sm" variant="secondary" asChild>
            <Link href="/display">Present</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open account menu"
                className="flex size-10 items-center justify-center rounded-full bg-chunk-sky text-sm font-bold text-white shadow-[0_4px_0_var(--color-chunk-sky-deep)] transition-all hover:brightness-110 active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-chunk-sky-deep)] cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
              >
                {initialsFor(session.user.name, session.user.email)}
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
                className="rounded-xl px-4 py-3 text-[15px] font-semibold cursor-pointer focus:bg-accent"
                onSelect={handleMigrate}
              >
                {migrating ? 'Migrating...' : 'Migrate old lists'}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl px-4 py-3 text-[15px] font-semibold text-coral-ink cursor-pointer focus:bg-coral-soft"
                onSelect={() => signOut({ callbackUrl: '/auth/signin' })}
              >
                <LogOutIcon className="size-4" />
                Sign out
              </DropdownMenuItem>
              {migrateError && (
                <p role="alert" className="px-4 py-2 text-sm font-semibold text-coral-ink">
                  {migrateError}
                </p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
