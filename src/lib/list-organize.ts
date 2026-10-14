/**
 * Pure helpers for organizing the lists overview page (issue #275):
 * favorites, favorite order, and the All/Favorites views.
 *
 * These compute new state; the caller persists it through the lists API.
 */

import { isListFavorite, type WordList } from '@/models/WordList'
import { reorderById } from './list-order'

/** Favorites sorted by their manual order; unordered favorites sort last. */
export function sortFavorites(lists: WordList[]): WordList[] {
  return [...lists]
    .filter(isListFavorite)
    .sort((a, b) => (a.favoriteOrder ?? Number.MAX_SAFE_INTEGER) - (b.favoriteOrder ?? Number.MAX_SAFE_INTEGER))
}

/** Whether any list is starred (drives the All/Favorites segmented control). */
export function hasFavorites(lists: WordList[]): boolean {
  return lists.some(isListFavorite)
}

export interface FavoriteToggle {
  /** The lists with the toggle applied. */
  lists: WordList[]
  /** The API update payload for the toggled list. */
  update: { isFavorite: boolean; favoriteOrder: number }
}

/**
 * Toggle a list's favorite state. Starring assigns the next favoriteOrder
 * (one past the current max); unstarring keeps the stored order so a
 * re-star lands in a sane spot. Returns null when the list is unknown.
 */
export function toggleFavorite(lists: WordList[], listId: string): FavoriteToggle | null {
  const list = lists.find((l) => l.id === listId)
  if (!list) return null
  const starring = !isListFavorite(list)
  const favoriteOrder = starring
    ? lists.reduce((max, l) => Math.max(max, l.favoriteOrder ?? -1), -1) + 1
    : (list.favoriteOrder ?? 0)
  return {
    lists: lists.map((l) => (l.id === listId ? { ...l, isFavorite: starring, favoriteOrder } : l)),
    update: { isFavorite: starring, favoriteOrder },
  }
}

/**
 * Reorder favorites by drag: move `activeId` to `overId`'s position and
 * reassign favoriteOrder 0..n-1 across the favorites. Returns the original
 * array reference when nothing changes.
 */
export function reorderFavorites(lists: WordList[], activeId: string, overId: string): WordList[] {
  const favorites = sortFavorites(lists)
  const reordered = reorderById(favorites, activeId, overId)
  // reorderById returns its input unchanged when the drag changes nothing.
  if (reordered === favorites) return lists
  const order = new Map(reordered.map((l, i) => [l.id, i] as const))
  return lists.map((l) => (order.has(l.id) ? { ...l, favoriteOrder: order.get(l.id)! } : l))
}
