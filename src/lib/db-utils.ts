import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import docClient from './dynamodb'
import { IUser, USER_TABLE_NAME, createUserItem, updateUserTimestamps } from '../models/User'

// Helper function to generate consistent DynamoDB keys from userId
function getUserKeys(userId: string) {
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

  const user = createUserItem({
    id: userId,
    ...userData,
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
    const result = await docClient.send(command)
    return result.Items?.[0] as IUser | undefined
  } catch (error) {
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
