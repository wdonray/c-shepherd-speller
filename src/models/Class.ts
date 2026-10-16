/**
 * Class model for PatternSpell.
 *
 * A Class is an account-level entity owned by a teacher: a group of students
 * taught together (a homeroom, a reading group, a period). It is designed for
 * future expansion beyond the Sort game; for now its payload is the class's
 * spelling rules, one per pattern, accumulated across sorts and weeks.
 *
 * Rules are keyed by pattern text (e.g. "a_e"), not by list-specific pattern
 * IDs, so a class's understanding of a pattern persists across different
 * word lists. Selecting a class is always optional; sorts without a class
 * use the unscoped rule stored on the list's own patterns.
 */

import { z } from 'zod'

/**
 * A spelling rule the class declared, e.g. "ai comes in the middle of a
 * word, ay at the end. ai never ends a word." One active rule per pattern
 * (MVP); teacherNote and oddballs are optional extras.
 */
export const ClassRuleSchema = z.object({
  /** Kid-friendly rule text, written the way the class said it. */
  rule: z.string().min(1).max(300),
  /** Optional formal name for teacher reference. */
  teacherNote: z.string().min(1).max(200).optional(),
  /** Optional exceptions the class named. */
  oddballs: z.array(z.string().min(1).max(50)).max(50).optional(),
})
export type ClassRule = z.infer<typeof ClassRuleSchema>

/** A teacher's class. Rules map pattern text (e.g. "a_e") to the class rule. */
export const ClassSchema = z.object({
  id: z.string().min(1),
  /** Owner's database user ID (from c-shepherd-users) */
  userId: z.string().min(1),
  /** Display name, e.g. "Period 2" or "Blue reading group" */
  name: z.string().min(1).max(100),
  /** The class's rules, keyed by pattern text. Absent on legacy classes. */
  rules: z.record(z.string().min(1).max(20), ClassRuleSchema).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Class = z.infer<typeof ClassSchema>

/** Payload for creating a class (server fills in id, userId, timestamps). */
export const CreateClassSchema = z.object({
  name: z.string().min(1).max(100),
})
export type CreateClassInput = z.infer<typeof CreateClassSchema>

/** Payload for updating a class. All fields optional. */
export const UpdateClassSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rules: z.record(z.string().min(1).max(20), ClassRuleSchema).optional(),
})
export type UpdateClassInput = z.infer<typeof UpdateClassSchema>

/** Payload for saving rules: pattern text to rule, from the rule capture form. */
export const SaveClassRulesSchema = z.object({
  rules: z.record(z.string().min(1).max(20), ClassRuleSchema),
})
export type SaveClassRulesInput = z.infer<typeof SaveClassRulesSchema>

/** Payload for deleting one class rule: the pattern text, from the rule editor's Clear button. */
export const DeleteClassRuleSchema = z.object({
  patternText: z.string().min(1).max(20),
})
export type DeleteClassRuleInput = z.infer<typeof DeleteClassRuleSchema>

/**
 * DynamoDB key for a class item. Classes share the lists table
 * (single-table design); the SK prefix distinguishes them from lists.
 */
export function getClassKeys(userId: string, classId: string) {
  return {
    PK: `USER#${userId}`,
    SK: `CLASS#${classId}`,
  }
}

/** SK prefix for querying a user's classes. */
export const CLASS_SK_PREFIX = 'CLASS#'

/** Generate a unique class ID. */
export function generateClassId(): string {
  return `class_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Build a new Class from user input, filling in server-generated fields. */
export function createClassItem(userId: string, input: CreateClassInput): Class {
  const now = new Date().toISOString()
  return {
    id: generateClassId(),
    userId,
    name: input.name.trim(),
    rules: {},
    createdAt: now,
    updatedAt: now,
  }
}

/** Apply an update to a class, refreshing updatedAt. */
export function updateClassItem(cls: Class, input: UpdateClassInput): Class {
  return {
    ...cls,
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.rules !== undefined ? { rules: input.rules } : {}),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * What is attached to a classroom that blocks its deletion (issue #309).
 * Donray's decision (2026-10-15): a classroom with saved rules, assigned
 * lists, or students cannot be deleted. Only an empty, unassigned classroom
 * can be deleted.
 */
export interface ClassDeletionInfo {
  /** Number of saved spelling rules on the class. */
  ruleCount: number
  /** Number of word lists assigned to the class. */
  assignedListCount: number
  /**
   * Number of students in the class. The app stores no per-classroom
   * student roster, so this is always 0 today; it is part of the shape so
   * the deletion rule covers all three categories from the decision.
   */
  studentCount: number
  /** True when nothing is attached and the classroom may be deleted. */
  canDelete: boolean
}

/**
 * Deletion is blocked while anything is attached to the classroom
 * (Donray's decision, 2026-10-15).
 */
export function canDeleteClass(
  info: Pick<ClassDeletionInfo, 'ruleCount' | 'assignedListCount' | 'studentCount'>
): boolean {
  return info.ruleCount === 0 && info.assignedListCount === 0 && info.studentCount === 0
}

/**
 * Human-readable list of what is attached to the classroom, e.g.
 * "2 saved rules, assigned to 1 word list". Empty when nothing is attached.
 */
export function describeClassroomAttachments(info: ClassDeletionInfo): string {
  const parts: string[] = []
  if (info.ruleCount > 0) parts.push(`${info.ruleCount} saved ${info.ruleCount === 1 ? 'rule' : 'rules'}`)
  if (info.assignedListCount > 0) {
    parts.push(`assigned to ${info.assignedListCount} ${info.assignedListCount === 1 ? 'word list' : 'word lists'}`)
  }
  if (info.studentCount > 0) parts.push(`${info.studentCount} ${info.studentCount === 1 ? 'student' : 'students'}`)
  return parts.join(', ')
}

/**
 * Resolve the teacher's effective default classroom.
 *
 * An explicitly set default wins. Otherwise a teacher with exactly one
 * class gets that class as the default automatically (no migration, no
 * stored value): this is the common "one classroom" case from issue #263.
 * Teachers with zero or multiple classes and no explicit default get null,
 * which means "No class".
 *
 * Pure function (no server dependencies) so client components can use it.
 */
export function resolveDefaultClassId(
  user: { defaultClassId?: string | null } | null | undefined,
  classes: Pick<Class, 'id'>[]
): string | null {
  if (user?.defaultClassId) return user.defaultClassId
  if (classes.length === 1) return classes[0].id
  return null
}
