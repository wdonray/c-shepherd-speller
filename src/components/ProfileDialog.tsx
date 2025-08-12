'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSession } from 'next-auth/react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { useEffect, useState } from 'react'
import { getUserByEmail, User } from '@/lib/spelling-api'
import { Label } from '@/components/ui/label'
import { Separator } from './ui/separator'
import { GraduationCap, School, CheckCircle, UserIcon } from 'lucide-react'
import { Badge } from './ui/badge'
import { UpdateUserBody } from '@/types/User'

interface ProfileDialogProps {
  isOpen: boolean
  onClose: () => void
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
          const email = session?.user?.email
          if (!email) return
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center  gap-2">
            <GraduationCap className="w-6 h-6" />
            Teacher Profile
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Customize your profile to personalize the spelling experience for your classroom
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-blue-600" />
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Input id="email" type="email" value={session?.user?.email ?? ''} disabled className="h-10 bg-muted" />
              <p className="text-xs text-muted-foreground">Email is managed through your Google account</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <School className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-lg">Teaching Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-green-800 text-sm font-medium">Profile updated successfully!</p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button variant="outline" type="button" onClick={onClose} className="w-full md:w-auto">
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
