/**
 * User Model for DynamoDB
 *
 * This module defines the User interface and utilities for users who use the C-PatternSpell
 * application. Uses basic information from Google authentication.
 *
 * Features:
 * - User authentication via Google OAuth
 * - Basic profile management
 * - Last active date tracking
 * - Created and updated timestamps
 */

export interface IUser {
  id: string
  email: string
  name: string
  image?: string
  lastActive: string
  createdAt: string
  updatedAt: string
  words: string[]
  sounds: string[]
  spelling: string[]
  // Teacher-specific fields
  gradeLevel?: string
  subject?: string
  schoolName?: string
  classroomSize?: number
  preferredName?: string // How they want to be addressed by students
  /**
   * The teacher's default classroom (a Class id). New lists inherit it;
   * the teacher can override per list. Absent until set. Teachers with
   * exactly one class get that class as the effective default without
   * storing it (see resolveDefaultClassId).
   */
  defaultClassId?: string
  /**
   * Videos the teacher has hidden (issue #443: "don't ever show me this
   * video again"). Suggestions, in-app search results, and the home browse
   * section filter these out for this teacher. Entries snapshot the
   * title/channel at block time so the profile settings list can show them
   * without another lookup (custom pasted videos have no bank entry).
   * Unique by videoId; absent until the teacher hides their first video.
   */
  blockedVideos?: BlockedVideo[]
}

/**
 * One hidden video on a teacher's profile (issue #443).
 */
export interface BlockedVideo {
  /** The 11-character YouTube video ID. */
  videoId: string
  /** Title snapshot taken when the teacher hid the video. */
  title: string
  /** Channel name snapshot, when known. */
  channel?: string
}

export const USER_TABLE_NAME = process.env.USER_TABLE_NAME || 'c-shepherd-users'
export const USER_KEY_SCHEMA = { PK: '${id}-user', SK: '${id}-profile' }

export function createUserItem(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'> & { id: string }): IUser {
  const now = new Date().toISOString()
  return { ...userData, createdAt: now, updatedAt: now }
}

export function updateUserItem(user: IUser, userData: Partial<IUser>): IUser {
  return { ...user, ...userData, updatedAt: new Date().toISOString() }
}

export function updateUserTimestamps(user: IUser): IUser {
  return { ...user, updatedAt: new Date().toISOString() }
}
