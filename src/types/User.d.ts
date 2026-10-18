import type { BlockedVideo } from '@/models/User'

export interface UpdateUserBody {
  name?: string
  gradeLevel?: string
  subject?: string
  schoolName?: string
  classroomSize?: number
  preferredName?: string
  image?: string
  /** Set to a Class id to change the default, or null to clear it. */
  defaultClassId?: string | null
  /** Replace the teacher's hidden-video list (issue #443). */
  blockedVideos?: BlockedVideo[]
}
