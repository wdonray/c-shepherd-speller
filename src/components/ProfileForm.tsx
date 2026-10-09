'use client'

import { useSession } from 'next-auth/react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { useEffect, useRef, useState } from 'react'
import { getUserByEmail, User } from '@/lib/spelling-api'
import { Label } from '@/components/ui/label'
import { Camera, CheckCircle } from 'lucide-react'
import { Badge } from './ui/badge'
import { UpdateUserBody } from '@/types/User'
import { processProfileImage } from '@/lib/profile-image'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

export const PROFILE_PHOTO_UPDATED_EVENT = 'patternspell:profile-photo-updated'

/** How long to wait after the last keystroke before auto-saving. */
const SAVE_DEBOUNCE_MS = 500
/** How long the "Saved" confirmation stays visible. */
const SAVED_MESSAGE_MS = 2000

interface ProfileFormState {
  name: string
  preferredName: string
  gradeLevel: string
  subject: string
  schoolName: string
  classroomSize: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

function buildTextPayload(form: ProfileFormState): UpdateUserBody {
  const updateData: UpdateUserBody = {}
  if (form.name) updateData.name = form.name
  if (form.preferredName) updateData.preferredName = form.preferredName
  if (form.gradeLevel) updateData.gradeLevel = form.gradeLevel
  if (form.subject) updateData.subject = form.subject
  if (form.schoolName) updateData.schoolName = form.schoolName
  if (form.classroomSize) updateData.classroomSize = parseInt(form.classroomSize)
  return updateData
}

function SaveStatusPill({ status, error }: { status: SaveStatus; error: string | null }) {
  return (
    <div aria-live="polite">
      {status === 'saving' && (
        <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
          <span
            className="size-3.5 animate-spin rounded-full border-2 border-line border-t-sky-deep"
            aria-hidden="true"
          />
          Saving...
        </span>
      )}
      {status === 'saved' && (
        <span className="inline-flex items-center gap-2 rounded-full bg-leaf-soft px-3 py-1.5 text-sm font-semibold text-leaf-deep">
          <CheckCircle className="size-4" aria-hidden="true" />
          Saved
        </span>
      )}
      {status === 'error' && (
        <p role="alert" className="text-sm font-semibold text-coral-ink">
          {error}
        </p>
      )}
    </div>
  )
}

export default function ProfileForm() {
  const { data: session } = useSession()
  const [formData, setFormData] = useState<ProfileFormState>({
    name: '',
    preferredName: '',
    gradeLevel: '',
    subject: '',
    schoolName: '',
    classroomSize: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | undefined>(undefined)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs mirror the latest state so the unmount cleanup below can flush a
  // pending save with fresh values.
  const formDataRef = useRef(formData)
  formDataRef.current = formData
  const doSaveRef = useRef(doSave)
  doSaveRef.current = doSave

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
          setPhoto(user.image || undefined)
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

  async function doSave(payload: UpdateUserBody, isPhotoChange: boolean): Promise<void> {
    if (!user?.id) return
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = null
    }
    setSaveStatus('saving')
    setSaveError(null)
    try {
      await updateUser(user.id, payload)
      setUser({ ...user, ...payload })
      if (isPhotoChange) {
        // Carry the new image on the event so listeners can update
        // immediately; a re-fetch here can return stale data because the
        // email lookup queries an eventually-consistent index.
        window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_UPDATED_EVENT, { detail: { image: payload.image } }))
      }
      setSaveStatus('saved')
      savedTimerRef.current = setTimeout(() => {
        setSaveStatus('idle')
      }, SAVED_MESSAGE_MS)
    } catch (error) {
      console.error('Error updating user:', error)
      setSaveStatus('error')
      setSaveError('Could not save your changes. Check your connection and try again.')
    }
  }
  doSaveRef.current = doSave

  // On unmount, flush any pending debounced save so edits are not lost when
  // navigating away. The save runs in the background; unmount is not blocked.
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        const latestDoSave = doSaveRef.current
        const latestForm = formDataRef.current
        void latestDoSave(buildTextPayload(latestForm), false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function scheduleAutosave(next: ProfileFormState): void {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const payload = buildTextPayload(next)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void doSave(payload, false)
    }, SAVE_DEBOUNCE_MS)
  }

  const handleInputChange = (field: keyof ProfileFormState, value: string) => {
    const next = { ...formData, [field]: value }
    setFormData(next)
    scheduleAutosave(next)
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset the input so the same file can be picked again.
    e.target.value = ''
    if (!file) return
    setIsProcessingPhoto(true)
    setPhotoError(null)
    try {
      const dataUrl = await processProfileImage(file)
      setPhoto(dataUrl)
      await doSave({ ...buildTextPayload(formData), image: dataUrl }, true)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not read the image file.')
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  async function handlePhotoRemove() {
    setPhoto(undefined)
    setPhotoError(null)
    fileInputRef.current?.focus()
    await doSave({ ...buildTextPayload(formData), image: '' }, true)
  }

  const displayName = user?.name || session?.user?.name || ''
  const displayEmail = session?.user?.email || ''
  const openFilePicker = () => fileInputRef.current?.click()

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={openFilePicker}
              aria-label="Upload profile photo"
              className="group relative flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-sky-deep text-3xl font-bold text-white outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/60"
            >
              {photo ? (
                <img src={photo} alt="" aria-hidden="true" className="size-full object-cover" />
              ) : (
                initialsFor(displayName, displayEmail)
              )}
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                <Camera className="size-7 text-white" />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold tracking-tight text-ink">{displayName || 'Your profile'}</h2>
              <p className="mt-1 text-[15px] text-muted-foreground">{displayEmail}</p>
              <p className="text-sm text-muted-foreground">Signed in with Google</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={openFilePicker}
                  disabled={isProcessingPhoto}
                >
                  Change photo
                </Button>
                {photo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePhotoRemove}
                    disabled={isProcessingPhoto}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <div className="shrink-0 sm:pt-1">
              <SaveStatusPill status={saveStatus} error={saveError} />
            </div>
          </div>
          {photoError && (
            <p role="alert" className="mt-4 text-sm font-semibold text-coral-ink">
              {photoError}
            </p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            JPEG, PNG, or WebP under 5MB. Your photo is resized to fit and shows in the header.
          </p>
        </CardContent>
      </Card>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handlePhotoSelect}
        disabled={isProcessingPhoto}
        aria-label="Profile photo file input"
        tabIndex={-1}
      />

      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold text-ink">Personal information</h3>
          <CardDescription>How your name appears across PatternSpell.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Full name
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={isLoading}
                placeholder="Enter your full name"
                className="h-11 text-[15px]"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="preferredName" className="text-sm font-medium">
                  Preferred name
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
                className="h-11 text-[15px]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email address
            </Label>
            <Input id="email" type="email" value={displayEmail} disabled className="h-11 bg-muted text-[15px]" />
            <p className="text-sm text-muted-foreground">Email is managed through your Google account.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold text-ink">Teaching information</h3>
          <CardDescription>Used to personalize your lists and suggestions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="gradeLevel" className="text-sm font-medium">
                  Grade level
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
                placeholder="e.g. 3rd Grade, K-2"
                className="h-11 text-[15px]"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="subject" className="text-sm font-medium">
                  Subject or area
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
                placeholder="e.g. ELA, Reading, Special Ed"
                className="h-11 text-[15px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="schoolName" className="text-sm font-medium">
                  School name
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
                className="h-11 text-[15px]"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="classroomSize" className="text-sm font-medium">
                  Typical class size
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
                className="h-11 text-[15px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
