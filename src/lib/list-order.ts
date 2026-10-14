/**
 * Pure ordering helpers for the lists overview page (issue #275).
 *
 * Favorites and custom list order are both manual orderings stored per list
 * (favoriteOrder / sortOrder). These helpers compute the new order; the
 * caller persists it.
 */

/**
 * Move the item with `activeId` to the position of the item with `overId`,
 * shifting the items between them. Returns the original array unchanged when
 * either id is missing or both ids match.
 */
export function reorderById<T extends { id: string }>(items: T[], activeId: string, overId: string): T[] {
  const from = items.findIndex((item) => item.id === activeId)
  const to = items.findIndex((item) => item.id === overId)
  if (from === -1 || to === -1 || from === to) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
