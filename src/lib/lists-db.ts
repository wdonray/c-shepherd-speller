/**
 * DynamoDB access for pattern-based word lists.
 *
 * Table: shepherd-speller-lists (LISTS_TABLE_NAME)
 *   PK: USER#<userId>, SK: LIST#<listId>  — one item per list, patterns embedded.
 *
 * Lists are small (a few patterns, dozens of words), so a single-item design
 * keeps reads/writes atomic without transactions.
 */

import { PutCommand, GetCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import docClient from './dynamodb'
import {
  LISTS_TABLE_NAME,
  getListKeys,
  createWordListItem,
  updateWordListItem,
  type WordList,
  type CreateWordListInput,
  type UpdateWordListInput,
} from '../models/WordList'

/** Create a new list for a user. */
export async function createList(userId: string, input: CreateWordListInput): Promise<WordList> {
  const list = createWordListItem(userId, input)
  const keys = getListKeys(userId, list.id)

  await docClient.send(
    new PutCommand({
      TableName: LISTS_TABLE_NAME,
      Item: { ...keys, ...list },
      // Don't overwrite an existing list with the same ID (shouldn't happen,
      // but guards against ID collision).
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  )
  return list
}

/** Get a single list by ID. Returns undefined if not found or not owned. */
export async function getListById(userId: string, listId: string): Promise<WordList | undefined> {
  const keys = getListKeys(userId, listId)

  const result = await docClient.send(
    new GetCommand({
      TableName: LISTS_TABLE_NAME,
      Key: keys,
    })
  )
  if (!result.Item) return undefined
  // Strip the DynamoDB key attributes before returning.
  const { PK, SK, ...list } = result.Item as Record<string, unknown>
  return list as unknown as WordList
}

/** Get all lists for a user, most recently updated first. */
export async function getListsByUser(userId: string): Promise<WordList[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: LISTS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'LIST#',
      },
    })
  )
  const items = (result.Items ?? []) as Record<string, unknown>[]
  const lists = items.map(({ PK, SK, ...list }) => list as unknown as WordList)
  // Sort by updatedAt descending (most recent first).
  lists.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return lists
}

/** Update a list. Throws if the list does not exist. */
export async function updateList(userId: string, listId: string, input: UpdateWordListInput): Promise<WordList> {
  const existing = await getListById(userId, listId)
  if (!existing) {
    throw new Error('List not found')
  }
  const updated = updateWordListItem(existing, input)
  const keys = getListKeys(userId, listId)

  await docClient.send(
    new PutCommand({
      TableName: LISTS_TABLE_NAME,
      Item: { ...keys, ...updated },
      ConditionExpression: 'attribute_exists(PK)',
    })
  )
  return updated
}

/** Delete a list. No-op if it does not exist. */
export async function deleteList(userId: string, listId: string): Promise<void> {
  const keys = getListKeys(userId, listId)

  await docClient.send(
    new DeleteCommand({
      TableName: LISTS_TABLE_NAME,
      Key: keys,
    })
  )
}
