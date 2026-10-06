'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { signOut, useSession } from 'next-auth/react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { useEffect, useState } from 'react'
import { getUserByEmail, User } from '@/lib/spelling-api'
import { Label } from '@/components/ui/label'
import { Separator } from './ui/separator'
import { CheckCircle } from 'lucide-react'
import { Badge } from './ui/badge'
import { UpdateUserBody } from '@/types/User'

interface ProfileDialogProps {
  isOpen: boolean
  onClose: () => void
}

function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

export default function ProfileDialog({ isOpen, onClose }: ProfileDialogProps) {
  const { data: session } = useSession()
  const [formData, setFormData] = useState({
    name: '',
    preferredName: '',
    gradeLevel: '',
    subject: '',
    schoolName: '',
    classroomSize: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    async function fetchUser() {
      if (user) return
      setIsLoading(true)
      try {
        if (session?.user?.email) {
          const email = session.user.email
          const user = await getUserByEmail(email)
          if (!user) return
          setUser(user)
          setFormData({
            name: user.name || '',
            preferredName: user.preferredName || '',
            gradeLevel: user.gradeLevel || '',
            subject: user.subject || '',
            schoolName: user.schoolName || '',
            classroomSize: user.classroomSize?.toString() || '',
          })
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()
  }, [session?.user?.email, user])

  async function updateUser(userId: string, data: UpdateUserBody): Promise<void> {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to update user')
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      if (user?.id) {
        const updateData: UpdateUserBody = {}
        if (formData.name) updateData.name = formData.name
        if (formData.preferredName) updateData.preferredName = formData.preferredName
        if (formData.gradeLevel) updateData.gradeLevel = formData.gradeLevel
        if (formData.subject) updateData.subject = formData.subject
        if (formData.schoolName) updateData.schoolName = formData.schoolName
        if (formData.classroomSize) updateData.classroomSize = parseInt(formData.classroomSize)

        await updateUser(user.id, updateData)
        setSaveSuccess(true)

        // Update local user state
        setUser({ ...user, ...updateData })

        // Hide success message after 2 seconds
        setTimeout(() => setSaveSuccess(false), 2000)
      }
    } catch (error) {
      console.error('Error updating user:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const displayName = user?.name || session?.user?.name || ''
  const displayEmail = session?.user?.email || ''

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div
              className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-sky-deep text-[22px] font-bold text-white"
              aria-hidden="true"
            >
              {initialsFor(displayName, displayEmail)}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-ink">{displayName || 'Your profile'}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">{displayEmail}</DialogDescription>
              <p className="mt-1 text-sm text-muted-foreground">Signed in with Google</p>
            </div>
          </div>
        </DialogHeader>

        <Button variant="secondary" className="w-full" onClick={() => signOut({ callbackUrl: '/auth/signin' })}>
          Sign out
        </Button>

        <Separator />

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-ink">Basic information</h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col justify-between gap-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Enter your full name"
                  className="h-10"
                />
              </div>

              <div className="flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="preferredName" className="text-sm font-medium">
                    Preferred Name
                  </Label>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Optional
                  </Badge>
                </div>
                <Input
                  id="preferredName"
                  type="text"
                  value={formData.preferredName}
                  onChange={(e) => handleInputChange('preferredName', e.target.value)}
                  disabled={isLoading}
                  placeholder="What students call you"
                  className="h-10"
                />
              </div>
            </div>

            <div className="flex flex-col justify-between gap-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input id="email" type="email" value={displayEmail} disabled className="h-10 bg-muted" />
              <p className="text-xs text-muted-foreground">Email is managed through your Google account</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-ink">Teaching information</h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="gradeLevel" className="text-sm font-medium">
                    Grade Level
                  </Label>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Optional
                  </Badge>
                </div>
                <Input
                  id="gradeLevel"
                  type="text"
                  value={formData.gradeLevel}
                  onChange={(e) => handleInputChange('gradeLevel', e.target.value)}
                  disabled={isLoading}
                  placeholder="e.g., 3rd Grade, K-2"
                  className="h-10"
                />
              </div>

              <div className="flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="subject" className="text-sm font-medium">
                    Subject/Area
                  </Label>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Optional
                  </Badge>
                </div>
                <Input
                  id="subject"
                  type="text"
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  disabled={isLoading}
                  placeholder="e.g., ELA, Reading, Special Ed"
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="schoolName" className="text-sm font-medium">
                    School Name
                  </Label>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Optional
                  </Badge>
                </div>
                <Input
                  id="schoolName"
                  type="text"
                  value={formData.schoolName}
                  onChange={(e) => handleInputChange('schoolName', e.target.value)}
                  disabled={isLoading}
                  placeholder="Your school name"
                  className="h-10"
                />
              </div>

              <div className="flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="classroomSize" className="text-sm font-medium">
                    Typical Class Size
                  </Label>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Optional
                  </Badge>
                </div>
                <Input
                  id="classroomSize"
                  type="number"
                  min="1"
                  max="50"
                  value={formData.classroomSize}
                  onChange={(e) => handleInputChange('classroomSize', e.target.value)}
                  disabled={isLoading}
                  placeholder="Number of students"
                  className="h-10"
                />
              </div>
            </div>
          </div>

          {/* Success Message */}
          {saveSuccess && (
            <div className="rounded-[20px] border-2 border-leaf bg-leaf-soft p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-leaf-deep" />
                <p className="text-sm font-medium text-leaf-deep">Profile updated successfully!</p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button variant="secondary" type="button" onClick={onClose} className="w-full md:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || isLoading} className="w-full md:w-auto">
              {isSaving ? 'Saving...' : 'Save Profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
