import type { Metadata } from 'next'
import BackBreadcrumb from '@/components/BackBreadcrumb'
import ProfileForm from '@/components/ProfileForm'
import HiddenVideosSection from '@/components/HiddenVideosSection'
import DeleteAccountSection from '@/components/DeleteAccountSection'

export const metadata: Metadata = {
  title: 'Profile | PatternSpell',
  description:
    'Manage your PatternSpell profile: photo, name, teaching information, hidden videos, and account deletion.',
}

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <BackBreadcrumb href="/home" label="Home" />
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Profile</h1>
      <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">
        Your personal and teaching details. Changes save automatically as you edit.
      </p>
      <div className="mt-8 space-y-6">
        <ProfileForm />
        <HiddenVideosSection />
      </div>
      <DeleteAccountSection />
    </div>
  )
}
