import type { Metadata } from 'next'
import PrintPage from '@/components/PrintPage'

export const metadata: Metadata = {
  title: 'Print pattern chart | PatternSpell',
  description: 'Print a black-and-white friendly pattern chart poster to hang on the classroom wall.',
}

/** Print route: loads the list and opens the print dialog once the chart renders. */
export default async function PrintListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PrintPage listId={id} />
}
