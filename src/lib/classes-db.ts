/**
 * DynamoDB access for teacher classes.
 *
 * Table: shepherd-speller-lists (LISTS_TABLE_NAME, shared with word lists)
 *   PK: USER#<userId>, SK: CLASS#<classId>  — one item per class, rules embedded.
 *
 * Classes are small (a name plus a map of pattern-text to rule), so a
 * single-item design keeps reads/writes atomic without transactions.
 */

import { PutCommand, GetCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import docClient from './dynamodb'
import { LISTS_TABLE_NAME } from '../models/WordList'
import type { WordList } from '../models/WordList'
import { getListsByUser } from './lists-db'
import {
  CLASS_SK_PREFIX,
  canDeleteClass,
  createClassItem,
  getClassKeys,
  updateClassItem,
  type Class,
  type ClassDeletionInfo,
  type ClassRule,
  type CreateClassInput,
  type UpdateClassInput,
} from '../models/Class'

/** Create a new class for a user. */
export async function createClass(userId: string, input: CreateClassInput): Promise<Class> {
  const cls = createClassItem(userId, input)
  const keys = getClassKeys(userId, cls.id)

  await docClient.send(
    new PutCommand({
      TableName: LISTS_TABLE_NAME,
      Item: { ...keys, ...cls },
      // Don't overwrite an existing class with the same ID (shouldn't happen,
      // but guards against ID collision).
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  )
  return cls
}

/** Get a single class by ID. Returns undefined if not found or not owned. */
export async function getClassById(userId: string, classId: string): Promise<Class | undefined> {
  const keys = getClassKeys(userId, classId)

  const result = await docClient.send(
    new GetCommand({
      TableName: LISTS_TABLE_NAME,
      Key: keys,
      // Strongly consistent read (issue #308): the Present chart and the list
      // page read a class immediately after a rule save lands, and an
      // eventually consistent read can return the pre-save item, so a newly
      // saved rule "disappears" until the next reload. Strong reads reflect
      // every write that already succeeded; class items are tiny, so the
      // extra read capacity is negligible.
      ConsistentRead: true,
    })
  )
  if (!result.Item) return undefined
  // Strip the DynamoDB key attributes before returning.
  const { PK, SK, ...cls } = result.Item as Record<string, unknown>
  return cls as unknown as Class
}

/** Get all classes for a user, most recently updated first. */
export async function getClassesByUser(userId: string): Promise<Class[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: LISTS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': CLASS_SK_PREFIX,
      },
    })
  )
  const items = result.Items ?? []
  const classes = items.map(({ PK, SK, ...cls }) => cls as unknown as Class)
  classes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return classes
}

/** Update a class. Throws if the class does not exist or is not owned. */
export async function updateClass(userId: string, classId: string, input: UpdateClassInput): Promise<Class> {
  const existing = await getClassById(userId, classId)
  if (!existing) {
    throw new Error(`Class not found: ${classId}`)
  }
  const updated = updateClassItem(existing, input)
  const keys = getClassKeys(userId, classId)

  await docClient.send(
    new PutCommand({
      TableName: LISTS_TABLE_NAME,
      Item: { ...keys, ...updated },
    })
  )
  return updated
}

/** Delete a class. Idempotent: deleting a missing class is a no-op. */
export async function deleteClass(userId: string, classId: string): Promise<void> {
  const keys = getClassKeys(userId, classId)

  await docClient.send(
    new DeleteCommand({
      TableName: LISTS_TABLE_NAME,
      Key: keys,
    })
  )
}

/**
 * Save rules for a class, merging the given pattern-text-to-rule map into
 * the class's existing rules. Returns the merged rules. Throws if the class
 * does not exist or is not owned.
 */
export async function saveClassRules(
  userId: string,
  classId: string,
  rules: Record<string, ClassRule>
): Promise<Record<string, ClassRule>> {
  const existing = await getClassById(userId, classId)
  if (!existing) {
    throw new Error(`Class not found: ${classId}`)
  }
  const merged = { ...existing.rules, ...rules }
  const keys = getClassKeys(userId, classId)

  await docClient.send(
    new UpdateCommand({
      TableName: LISTS_TABLE_NAME,
      Key: keys,
      UpdateExpression: 'SET #rules = :rules, updatedAt = :now',
      ExpressionAttributeNames: { '#rules': 'rules' },
      ExpressionAttributeValues: {
        ':rules': merged,
        ':now': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(PK)',
    })
  )
  return merged
}

/**
 * Delete one pattern's rule from a class. Idempotent: deleting a rule that
 * isn't there is a no-op. Returns the remaining rules. Throws if the class
 * does not exist or is not owned.
 *
 * The removal is a single atomic UpdateCommand (REMOVE on the nested map
 * key), so concurrent deletes cannot read the same map and restore each
 * other's removed rules the way a read-modify-write could.
 */
export async function deleteClassRule(
  userId: string,
  classId: string,
  patternText: string
): Promise<Record<string, ClassRule>> {
  const existing = await getClassById(userId, classId)
  if (!existing) {
    throw new Error(`Class not found: ${classId}`)
  }
  const keys = getClassKeys(userId, classId)

  const result = await docClient.send(
    new UpdateCommand({
      TableName: LISTS_TABLE_NAME,
      Key: keys,
      UpdateExpression: 'REMOVE #rules.#patternText SET updatedAt = :now',
      ExpressionAttributeNames: { '#rules': 'rules', '#patternText': patternText },
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
      },
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'UPDATED_NEW',
    })
  )
  // Absent on legacy classes that predate the rules map.
  return (result.Attributes?.rules as Record<string, ClassRule> | undefined) ?? {}
}

/**
 * Build the deletion info for a class from its item and the teacher's word
 * lists. Pure: no server dependencies, so routes and tests can use it.
 * Legacy class items predate the rules map, so rules is optional.
 */
export function buildClassDeletionInfo(
  cls: { id: string; rules?: Record<string, ClassRule> },
  lists: Pick<WordList, 'classId'>[]
): ClassDeletionInfo {
  const info = {
    ruleCount: Object.keys(cls.rules ?? {}).length,
    assignedListCount: lists.filter((list) => list.classId === cls.id).length,
    // The app stores no per-classroom student roster.
    studentCount: 0,
  }
  return { ...info, canDelete: canDeleteClass(info) }
}

/**
 * Get what is attached to one of the caller's classes for the deletion
 * guard (issue #309). Throws if the class does not exist or is not owned.
 */
export async function getClassDeletionInfo(userId: string, classId: string): Promise<ClassDeletionInfo> {
  const cls = await getClassById(userId, classId)
  if (!cls) {
    throw new Error(`Class not found: ${classId}`)
  }
  const lists = await getListsByUser(userId)
  return buildClassDeletionInfo(cls, lists)
}

/**
 * Get all classes for a user with their deletion info attached, for the
 * classroom management UI (issue #309). One lists query serves every class.
 */
export async function getClassesWithDeletionInfo(
  userId: string
): Promise<Array<Class & { deletion: ClassDeletionInfo }>> {
  const [classes, lists] = await Promise.all([getClassesByUser(userId), getListsByUser(userId)])
  return classes.map((cls) => ({ ...cls, deletion: buildClassDeletionInfo(cls, lists) }))
}

/**
 * Resolve the teacher's effective default classroom.
 *
 * An explicitly set default wins. Otherwise a teacher with exactly one
 * class gets that class as the default automatically (no migration, no
 * stored value): this is the common "one classroom" case from issue #263.
 * Teachers with zero or multiple classes and no explicit default get null,
 * which means "No class".
 */
export function resolveDefaultClassId(
  user: { defaultClassId?: string | null } | null | undefined,
  classes: Pick<Class, 'id'>[]
): string | null {
  if (user?.defaultClassId) return user.defaultClassId
  if (classes.length === 1) return classes[0].id
  return null
}
