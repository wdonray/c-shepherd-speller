import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { getUserSpellingData } from '@/lib/db-utils'
import { createList } from '@/lib/lists-db'
import { migrateFlatToPatternList } from '@/lib/migrate'
import { reportError } from '@/lib/report-error'

/**
 * POST /api/migrate
 * Migrate the current user's flat Words/Sounds/Spelling Patterns to a
 * single pattern-based list. No data is lost; old words go into an
 * "Unsorted" pattern for the teacher to organize.
 */
export async function POST(_request: NextRequest) {
  try {
    const auth = await requireUser()
    if (!auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = auth.user.id
    const flatData = await getUserSpellingData(userId)

    if (!flatData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if there's anything to migrate
    const hasData = flatData.words.length > 0 || flatData.sounds.length > 0 || flatData.spelling.length > 0
    if (!hasData) {
      return NextResponse.json({ error: 'No data to migrate' }, { status: 400 })
    }

    const listInput = migrateFlatToPatternList(flatData, userId)
    const list = await createList(userId, listInput)

    return NextResponse.json({ list }, { status: 201 })
  } catch (error: unknown) {
    reportError(error, { location: 'POST /api/migrate', extra: { status: 500 } })
    console.error('Error migrating data:', error)
    return NextResponse.json({ error: 'Failed to migrate data' }, { status: 500 })
  }
}
