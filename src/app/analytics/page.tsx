import { getAnalyticsSummary, getEventCount } from '@/lib/analytics'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Analytics',
  description: 'Public, privacy-respecting usage statistics for Shepherd Speller.',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const STATS = [
  { key: 'views', label: 'Page views, 30 days', bar: 'bg-sky' },
  { key: 'lists', label: 'Lists created', bar: 'bg-leaf' },
  { key: 'sessions', label: 'Practice sessions', bar: 'bg-sun' },
  { key: 'words', label: 'Words practiced', bar: 'bg-plum' },
] as const

export default async function AnalyticsPage() {
  const [summary, listsCreated, practiceSessions, wordsPracticed] = await Promise.all([
    getAnalyticsSummary(30),
    getEventCount('list-created'),
    getEventCount('practice-session'),
    getEventCount('words-practiced'),
  ])

  const values: Record<(typeof STATS)[number]['key'], number> = {
    views: summary?.dailyTotals.reduce((sum, d) => sum + d.views, 0) ?? 0,
    lists: listsCreated ?? 0,
    sessions: practiceSessions ?? 0,
    words: wordsPracticed ?? 0,
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pt-24 pb-16 md:px-8">
      <div className="space-y-2 text-center">
        <h1 className="text-[32px] font-bold text-ink">Analytics</h1>
        <p className="text-[15px] text-muted">How the app is used. Counts update daily.</p>
      </div>

      {!summary ? (
        <Card>
          <CardContent className="py-12 text-center text-muted">
            Analytics isn&apos;t configured on this build yet. Check back soon.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <Card key={stat.key} className="overflow-hidden">
                <div className={cn('h-2 w-full', stat.bar)} aria-hidden="true" />
                <CardContent className="px-6 pt-6 pb-8 text-center">
                  <div className="text-4xl font-extrabold text-ink">{values[stat.key].toLocaleString()}</div>
                  <p className="mt-3 text-sm text-muted">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="space-y-3 p-8">
              <h2 className="text-[17px] font-bold text-ink">How these numbers are measured</h2>
              <p className="text-sm leading-6 text-muted">
                Page views count one page load per page per browsing session, and bots are filtered out. List and
                practice counts come from saved app data: a practice session counts when a student finishes a list, and
                words practiced counts the words in finished sessions. Numbers are estimates of usage, not exact
                headcounts. No cookies are set and no raw IP addresses are stored.
              </p>
              <p className="text-xs text-muted">Last updated {formatDateTime(summary.fetchedAt)}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
