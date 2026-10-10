/**
 * Server-side account deletion helpers: remove every trace of a user across
 * all data stores.
 *
 * Data owned by one user:
 *  - App user record (profile, photo, settings) in the users table
 *  - Word lists in the lists table (PK USER#<appUserId>)
 *  - next-auth adapter records (user, accounts, sessions) in the auth table
 *    (pk USER#<nextAuthSub>)
 *  - The Cognito user itself, for email/password accounts (handled in
 *    cognito-auth.ts via the self-service DeleteUser API)
 *
 * Every delete here is idempotent: deleting what is already gone is a no-op,
 * so a failed deletion can be safely retried. The route deletes in an order
 * that keeps retries possible: app data first, adapter records next, the
 * Cognito user last. That way a mid-flight failure leaves the user still able
 * to sign in and retry, instead of orphaned data with no way back in.
 */
import { BatchWriteCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import docClient from './dynamodb'
import { USER_TABLE_NAME } from '../models/User'
import { LISTS_TABLE_NAME } from '../models/WordList'
import { getUserKeys } from './db-utils'

function authTableName(): string {
  // Read at call time so tests can point it at a scratch table.
  return process.env.AUTH_TABLE_NAME || 'next-auth'
}

/**
 * next-auth provider ids whose identities live in the Cognito user pool and
 * therefore need the Cognito user deleted too: the legacy hosted-UI OAuth
 * provider and the custom email/password Credentials provider.
 */
export const COGNITO_PROVIDERS = ['cognito', 'email-password']

interface KeyedItem {
  pk?: string
  sk?: string
  PK?: string
  SK?: string
  provider?: string
}

async function queryAllItems(
  tableName: string,
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, string>
): Promise<KeyedItem[]> {
  const items: KeyedItem[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExclusiveStartKey: exclusiveStartKey,
      })
    )
    items.push(...((result.Items ?? []) as KeyedItem[]))
    exclusiveStartKey = result.LastEvaluatedKey
  } while (exclusiveStartKey)
  return items
}

async function batchDeleteKeys(tableName: string, keys: Record<string, string>[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25)
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((Key) => ({ DeleteRequest: { Key } })),
        },
      })
    )
  }
}

/**
 * next-auth provider ids linked to this sign-in identity (e.g. 'google',
 * 'cognito', 'email-password'). Used to decide whether the account has a
 * Cognito user that needs deleting (and password re-authentication).
 */
export async function getAccountProviders(sub: string): Promise<string[]> {
  const items = await queryAllItems(authTableName(), 'pk = :pk', { ':pk': `USER#${sub}` })
  const providers = new Set<string>()
  for (const item of items) {
    if (typeof item.provider === 'string' && item.provider.length > 0) {
      providers.add(item.provider)
    }
  }
  return [...providers]
}

/** Delete every next-auth adapter record (user, accounts, sessions) for an identity. */
export async function deleteAuthRecords(sub: string): Promise<void> {
  const tableName = authTableName()
  const items = await queryAllItems(tableName, 'pk = :pk', {
    ':pk': `USER#${sub}`,
  })
  await batchDeleteKeys(
    tableName,
    items.map((item) => ({ pk: item.pk as string, sk: item.sk as string }))
  )
}

/** Delete every word list owned by an app user. */
export async function deleteUserLists(appUserId: string): Promise<void> {
  const items = await queryAllItems(LISTS_TABLE_NAME, 'PK = :pk', { ':pk': `USER#${appUserId}` })
  await batchDeleteKeys(
    LISTS_TABLE_NAME,
    items.map((item) => ({ PK: item.PK as string, SK: item.SK as string }))
  )
}

/** Delete the app user record (profile, photo, settings). */
export async function deleteAppUser(appUserId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: USER_TABLE_NAME,
      Key: getUserKeys(appUserId),
    })
  )
}
