import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ProfileForm from '@/components/ProfileForm'

export const metadata: Metadata = {
  title: 'Profile | PatternSpell',
  description: 'Manage your PatternSpell profile: photo, name, and teaching information.',
}

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl text-[15px] font-semibold text-muted-foreground outline-none transition hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink">Profile</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">Changes save automatically.</p>
      <div className="mt-6 rounded-[20px] border-2 border-line bg-card p-6">
        <ProfileForm />
      </div>
    </div>
  )
}
