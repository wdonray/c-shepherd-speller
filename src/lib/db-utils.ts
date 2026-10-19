import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import docClient from './dynamodb'
import { IUser, USER_TABLE_NAME, createUserItem, updateUserTimestamps } from '../models/User'
import type { PatternVideo } from '../models/WordList'
import type { BlockedVideo } from '../models/User'
import { reportError } from './report-error'

/**
 * Cap for the teacher's personal video library (issue #458). A library
 * entry is ~150 bytes, so 200 entries stay far under the DynamoDB 400KB
 * item limit; beyond the cap the oldest additions drop off.
 */
export const VIDEO_LIBRARY_MAX = 200

// Helper function to generate consistent DynamoDB keys from userId
export function getUserKeys(userId: string) {
  const uniqueId = userId.replace('-user', '')
  return {
    PK: `${uniqueId}-user`,
    SK: `${uniqueId}-profile`,
  }
}

export async function createUser(userData: {
  email: string
  name: string
  words: string[]
  sounds: string[]
  spelling: string[]
}) {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const userId = `${uniqueId}-user`

  // Email is the GSI lookup key and getUserByEmail queries its lowercase
  // form, so the stored value must be lowercase too. Cognito and Google can
  // return mixed-case emails; without this, the record is written but never
  // found again, and every requireUser() endpoint returns 403 (Sentry #157).
  const user = createUserItem({
    id: userId,
    ...userData,
    email: userData.email.toLowerCase(),
    lastActive: new Date().toISOString(),
  })

  const keys = getUserKeys(userId)

  const command = new PutCommand({
    TableName: USER_TABLE_NAME,
    Item: {
      ...keys,
      ...user,
    },
  })

  await docClient.send(command)
  return user
}

export async function updateUser(
  userId: string,
  userData: {
    name?: string
    gradeLevel?: string
    subject?: string
    schoolName?: string
    classroomSize?: number
    preferredName?: string
    image?: string
    defaultClassId?: string | null
    blockedVideos?: BlockedVideo[]
  }
): Promise<IUser> {
  // Field-scoped update (issue #263): only the provided attributes are
  // touched, so a profile save can never clobber a concurrently saved
  // defaultClassId (or vice versa). Returns ALL_NEW so callers never need
  // an eventually consistent re-read. All attribute names go through
  // ExpressionAttributeNames because some (e.g. "name") are DynamoDB
  // reserved words.
  const keys = getUserKeys(userId)
  const timestamp = new Date().toISOString()
  const names: Record<string, string> = { '#updatedAt': 'updatedAt' }
  const setClauses = ['#updatedAt = :now']
  const removeClauses: string[] = []
  const values: Record<string, unknown> = { ':now': timestamp }
  let fieldIndex = 0
  for (const [field, value] of Object.entries(userData)) {
    if (value === undefined) continue
    const nameRef = `#field${fieldIndex}`
    const varName = `:field${fieldIndex}`
    fieldIndex++
    names[nameRef] = field
    // A cleared default class drops the attribute (matches the old
    // read-modify-write behavior); other falsy values are stored as-is.
    if (field === 'defaultClassId' && !value) {
      removeClauses.push(nameRef)
      continue
    }
    setClauses.push(`${nameRef} = ${varName}`)
    values[varName] = value
  }
  let updateExpression = `SET ${setClauses.join(', ')}`
  if (removeClauses.length > 0) {
    updateExpression += ` REMOVE ${removeClauses.join(', ')}`
  }
  const command = new UpdateCommand({
    TableName: USER_TABLE_NAME,
    Key: keys,
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  })
  try {
    const response = await docClient.send(command)
    return response.Attributes as IUser
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      throw new Error('User not found')
    }
    throw error
  }
}

/**
 * Field-scoped update for the teacher's default classroom (issue #263).
 * Uses UpdateCommand so a default-class save never overwrites concurrent
 * profile edits: unlike updateUser's read-modify-write, only the
 * defaultClassId attribute is touched. Returns ALL_NEW so callers never
 * need an eventually consistent re-read.
 */
export async function updateUserDefaultClassId(userId: string, defaultClassId: string | null): Promise<IUser> {
  const keys = getUserKeys(userId)
  const timestamp = new Date().toISOString()
  const command = defaultClassId
    ? new UpdateCommand({
        TableName: USER_TABLE_NAME,
        Key: keys,
        UpdateExpression: 'SET defaultClassId = :classId, updatedAt = :now',
        ExpressionAttributeValues: {
          ':classId': defaultClassId,
          ':now': timestamp,
        },
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_NEW',
      })
    : new UpdateCommand({
        TableName: USER_TABLE_NAME,
        Key: keys,
        UpdateExpression: 'REMOVE defaultClassId SET updatedAt = :now',
        ExpressionAttributeValues: {
          ':now': timestamp,
        },
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_NEW',
      })
  const response = await docClient.send(command)
  return response.Attributes as IUser
}

export async function getUserByEmail(email: string) {
  // Note: In DynamoDB, we'll need to create a GSI (Global Secondary Index) on email
  // For now, this is a placeholder - you'll need to implement email-based queries
  // using a GSI or scan operation (not recommended for production)

  // This is a simplified implementation - you should create a GSI on email field
  const command = new QueryCommand({
    TableName: USER_TABLE_NAME,
    IndexName: 'EmailIndex', // You'll need to create this GSI
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email.toLowerCase(),
    },
  })

  try {
    let result = await docClient.send(command)
    let items = (result.Items ?? []) as IUser[]
    if (items.length === 0) {
      // The EmailIndex GSI is eventually consistent. Right after sign-in the
      // user record may exist but not be visible yet, causing spurious 403s
      // (Sentry #227). One short retry covers the typical propagation lag.
      await new Promise((resolve) => setTimeout(resolve, 200))
      result = await docClient.send(command)
      items = (result.Items ?? []) as IUser[]
    }
    if (items.length > 1) {
      // Duplicate records for one email should not happen (POST /api/users is
      // idempotent), but if they do the GSI query order is not guaranteed, so
      // resolve deterministically: the most recently updated record wins. This
      // keeps reads stable instead of flip-flopping between records.
      reportError(new Error(`Duplicate user records for email: ${email} (${items.length} records)`), {
        location: 'db-utils.getUserByEmail',
      })
      items.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    }
    return items[0] as IUser | undefined
  } catch (error) {
    reportError(error, { location: 'db-utils.getUserByEmail' })
    console.error('Error querying user by email:', error)
    return undefined
  }
}

export async function getUserById(userId: string) {
  const keys = getUserKeys(userId)

  const command = new GetCommand({
    TableName: USER_TABLE_NAME,
    Key: keys,
  })

  try {
    const result = await docClient.send(command)
    return result.Item as IUser | undefined
  } catch (error) {
    reportError(error, { location: 'db-utils.getUserById' })
    console.error('Error getting user by ID:', error)
    return undefined
  }
}

export async function getUserSpellingData(userId: string) {
  const user = await getUserById(userId)
  if (!user) return null

  return {
    words: user.words || [],
    sounds: user.sounds || [],
    spelling: user.spelling || [],
  }
}

export async function updateUserSpellingData(
  userId: string,
  updateData: {
    words?: string[]
    sounds?: string[]
    spelling?: string[]
  }
) {
  // First check if the user exists
  const existingUser = await getUserById(userId)
  if (!existingUser) {
    throw new Error('User not found')
  }

  const updateFields: Record<string, string[] | string> = {}
  if (updateData.words !== undefined) updateFields.words = updateData.words
  if (updateData.sounds !== undefined) updateFields.sounds = updateData.sounds
  if (updateData.spelling !== undefined) updateFields.spelling = updateData.spelling

  // Use updateUserTimestamps to get the updated timestamp
  const updatedTimestamp = updateUserTimestamps({} as IUser).updatedAt
  updateFields.updatedAt = updatedTimestamp

  const updateExpression = Object.keys(updateFields)
    .map((key) => `#${key} = :${key}`)
    .join(', ')

  const expressionAttributeNames = Object.keys(updateFields).reduce(
    (acc, key) => {
      acc[`#${key}`] = key
      return acc
    },
    {} as Record<string, string>
  )

  const expressionAttributeValues = Object.keys(updateFields).reduce(
    (acc, key) => {
      acc[`:${key}`] = updateFields[key]
      return acc
    },
    {} as Record<string, string[] | string>
  )

  const keys = getUserKeys(userId)

  const command = new UpdateCommand({
    TableName: USER_TABLE_NAME,
    Key: keys,
    UpdateExpression: `SET ${updateExpression}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  })

  try {
    const result = await docClient.send(command)
    return result.Attributes as IUser
  } catch (error) {
    console.error('Error updating user spelling data:', error)
    throw error
  }
}

/**
 * The teacher's personal song-video collection (issue #458): every video
 * she added by pasting a link, in the order added. Empty for teachers who
 * never pasted a link (the attribute is absent on their user item).
 */
export async function getUserVideoLibrary(userId: string): Promise<PatternVideo[]> {
  const user = await getUserById(userId)
  if (!user) return []
  return user.videoLibrary ?? []
}

/**
 * Append a video to the teacher's personal song-video collection
 * (issue #458). De-duplicated by video ID: pasting the same link on
 * another pattern does not duplicate it in her collection. Returns the
 * updated library. Throws when the user does not exist.
 *
 * Two pastes in quick succession (or from two tabs) race: each request
 * reads the library, appends in memory, and writes it back. An
 * unconditional write lets the second request silently overwrite the
 * first video (issue #473). The write is therefore conditional on the
 * library still being exactly what this call read (attribute_not_exists
 * when the teacher has no library yet), and a lost race re-reads and
 * retries up to VIDEO_LIBRARY_WRITE_MAX_ATTEMPTS times.
 */
const VIDEO_LIBRARY_WRITE_MAX_ATTEMPTS = 3

export async function addVideoToUserLibrary(userId: string, video: PatternVideo): Promise<PatternVideo[]> {
  const keys = getUserKeys(userId)
  let lastConflict: unknown = null
  for (let attempt = 0; attempt < VIDEO_LIBRARY_WRITE_MAX_ATTEMPTS; attempt++) {
    const existingUser = await getUserById(userId)
    if (!existingUser) {
      throw new Error('User not found')
    }
    const library = existingUser.videoLibrary ?? []
    if (library.some((entry) => entry.videoId === video.videoId)) {
      return library
    }
    const updated = [...library, video].slice(-VIDEO_LIBRARY_MAX)
    const command = new UpdateCommand({
      TableName: USER_TABLE_NAME,
      Key: keys,
      UpdateExpression: 'SET videoLibrary = :videos, updatedAt = :now',
      ExpressionAttributeValues: {
        ':videos': updated,
        ':now': new Date().toISOString(),
        // Only included when the read library existed: DynamoDB rejects
        // undefined expression values, and the absent-library case uses
        // attribute_not_exists which references no value.
        ...(existingUser.videoLibrary === undefined ? {} : { ':expectedLibrary': existingUser.videoLibrary }),
      },
      ConditionExpression:
        existingUser.videoLibrary === undefined
          ? 'attribute_not_exists(videoLibrary)'
          : 'videoLibrary = :expectedLibrary',
      ReturnValues: 'ALL_NEW',
    })
    try {
      const result = await docClient.send(command)
      const attributes = result.Attributes as IUser
      return attributes.videoLibrary ?? updated
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        // Another request appended first; re-read and try again.
        lastConflict = error
        continue
      }
      console.error('Error adding video to user library:', error)
      throw error
    }
  }
  console.error('Error adding video to user library: write conflict after retries', lastConflict)
  throw lastConflict
}

export async function updateUserLastActive(userId: string) {
  // First check if the user exists
  const existingUser = await getUserById(userId)
  if (!existingUser) {
    throw new Error('User not found')
  }

  const keys = getUserKeys(userId)

  const command = new UpdateCommand({
    TableName: USER_TABLE_NAME,
    Key: keys,
    UpdateExpression: 'SET lastActive = :lastActive',
    ExpressionAttributeValues: {
      ':lastActive': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  })

  try {
    const result = await docClient.send(command)
    return result.Attributes as IUser
  } catch (error) {
    console.error('Error updating user last active:', error)
    throw error
  }
}
