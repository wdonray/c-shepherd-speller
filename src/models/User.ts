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

import type { PatternVideo } from './WordList'

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
   * The teacher's personal song-video collection (issue #458): every video
   * she added by pasting a link, in the order added. The curated bank is
   * static data, so only her own additions are stored here; the browse page
   * merges the two. Stored on the user item (not on any list) so deleting a
   * list never removes videos from her collection. Absent until she pastes
   * her first link.
   */
  videoLibrary?: PatternVideo[]
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
