import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { saveClassRules, deleteClassRule } from '@/lib/classes-db'
import { SaveClassRulesSchema, DeleteClassRuleSchema } from '@/models/Class'
import { reportError } from '@/lib/report-error'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/classes/[id]/rules — save spelling rules for a class.
 * Merges the given pattern-text-to-rule map into the class's existing
 * rules. Used by the post-win rule capture form.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (auth.response) return auth.response
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    reportError(error, { location: 'PUT /api/classes/[id]/rules', extra: { status: 400 } })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SaveClassRulesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid rules data', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const rules = await saveClassRules(auth.user.id, id, parsed.data.rules)
    return NextResponse.json({ rules })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Class not found')) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }
    reportError(error, { location: 'PUT /api/classes/[id]/rules', extra: { status: 500 } })
    console.error('Error saving class rules:', error)
    return NextResponse.json({ error: 'Failed to save class rules' }, { status: 500 })
  }
}

/**
 * DELETE /api/classes/[id]/rules — remove one pattern's rule from a class.
 * Body: { patternText }. Idempotent. Used by the per-pattern rule editor's
 * Clear button (issue #307): an empty rule is not valid to save, so clearing
 * deletes the rule instead.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (auth.response) return auth.response
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    reportError(error, { location: 'DELETE /api/classes/[id]/rules', extra: { status: 400 } })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = DeleteClassRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid delete data', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const rules = await deleteClassRule(auth.user.id, id, parsed.data.patternText)
    return NextResponse.json({ rules })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Class not found')) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }
    reportError(error, { location: 'DELETE /api/classes/[id]/rules', extra: { status: 500 } })
    console.error('Error deleting class rule:', error)
    return NextResponse.json({ error: 'Failed to delete class rule' }, { status: 500 })
  }
}
