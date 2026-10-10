'use client'

import { useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { reportError } from '@/lib/report-error'

const ERROR_COPY: Record<string, string> = {
  'email-mismatch': 'That email does not match your account.',
  'password-required': 'Enter your password to confirm.',
  'invalid-credentials': 'Incorrect password. Check it and try again.',
  'too-many-attempts': 'Too many attempts. Wait a few minutes and try again.',
  'server-error': 'Something went wrong. Try again in a moment.',
}
const FALLBACK_ERROR = 'Something went wrong. Try again in a moment.'

interface AccountInfo {
  email: string
  listCount: number
  requiresPassword: boolean
}

/**
 * Danger zone on the profile page: permanently delete the caller's account
 * and all of their data. Confirmation follows the standard for irreversible
 * account deletion: a modal that plainly lists everything being destroyed,
 * requires typing the account email to confirm, and (for Cognito
 * email/password accounts) requires re-entering the password as
 * re-authentication. There is no grace period and no undo.
 */
export default function DeleteAccountSection() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const sessionEmail = session?.user?.email ?? ''

  useEffect(() => {
    if (!sessionEmail) return
    let cancelled = false
    async function fetchAccount() {
      try {
        const response = await fetch('/api/account')
        if (!response.ok) return
        const info = (await response.json()) as AccountInfo
        if (!cancelled) setAccount(info)
      } catch (error) {
        reportError(error, { location: 'DeleteAccountSection.fetchAccount' })
      }
    }
    fetchAccount()
    return () => {
      cancelled = true
    }
  }, [sessionEmail])

  function closeDialog() {
    setOpen(false)
    setEmail('')
    setPassword('')
    setErrorCode(null)
  }

  const emailMatches = email.trim().toLowerCase() === sessionEmail.toLowerCase()
  const canDelete = emailMatches && !isDeleting && (!account?.requiresPassword || password.length > 0)

  async function handleDelete() {
    setErrorCode(null)
    setIsDeleting(true)
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password || undefined }),
      })
      const body = (await response.json()) as { ok?: boolean; code?: string }
      if (body.ok) {
        // The account and every session record are gone; drop the local
        // session (JWT) and land on the signed-out home page.
        await signOut({ callbackUrl: '/' })
        return
      }
      setErrorCode(body.code ?? 'server-error')
    } catch (error) {
      reportError(error, { location: 'DeleteAccountSection.handleDelete' })
      setErrorCode('server-error')
    } finally {
      setIsDeleting(false)
    }
  }

  const listLine =
    account && account.listCount > 0 ? `All ${account.listCount} of your word lists` : 'All of your word lists'

  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="mt-10 rounded-2xl border-2 border-destructive/40 p-5 sm:p-6"
    >
      <h2 id="danger-zone-heading" className="text-lg font-bold text-ink">
        Danger zone
      </h2>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Permanently delete your PatternSpell account and all of your data. This cannot be undone.
      </p>
      <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
        Delete account
      </Button>

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-10 text-[17px] font-bold text-ink">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
              Delete your account?
            </DialogTitle>
            <DialogDescription className="text-left">
              This will permanently delete everything tied to your account:
            </DialogDescription>
          </DialogHeader>

          <ul className="list-disc space-y-1 pl-5 text-[15px] text-foreground">
            <li>Your profile and settings</li>
            <li>{listLine}</li>
            <li>Your profile photo</li>
            <li>Your access to PatternSpell. You will be signed out immediately.</li>
          </ul>
          <p className="text-[15px] font-semibold text-destructive">This cannot be undone.</p>

          {errorCode ? (
            <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-[15px] text-destructive">
              {ERROR_COPY[errorCode] ?? FALLBACK_ERROR}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-confirm-email">Type your email address to confirm</Label>
            <Input
              id="delete-confirm-email"
              name="delete-confirm-email"
              type="email"
              autoComplete="off"
              placeholder={sessionEmail}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isDeleting}
            />
          </div>

          {account?.requiresPassword ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-confirm-password">Enter your password</Label>
              <Input
                id="delete-confirm-password"
                name="delete-confirm-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isDeleting}
              />
              <p className="text-[13px] leading-5 text-muted-foreground">
                We need your password to verify it is really you.
              </p>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={closeDialog} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!canDelete}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Deleting...
                </>
              ) : (
                'Yes, delete my account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
