/**
 * Pure helpers for organizing the lists overview page (issue #275):
 * favorites, favorite order, sorting, and the All/Favorites views.
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

/** Sort modes for the lists overview. */
export type ListSort = 'recent' | 'name' | 'created' | 'custom'

export const LIST_SORT_OPTIONS: { value: ListSort; label: string }[] = [
  { value: 'recent', label: 'Recently modified' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'created', label: 'Recently created' },
  { value: 'custom', label: 'Custom order' },
]

/** Storage key for the teacher's sort choice. */
export const LIST_SORT_STORAGE_KEY = 'patternspell:lists-sort'

/**
 * Sort lists for the All view. The Favorites view always uses favoriteOrder.
 * Custom order falls back to load order for lists without a stored sortOrder.
 */
export function sortLists(lists: WordList[], sort: ListSort): WordList[] {
  const sorted = [...lists]
  switch (sort) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'created':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'custom':
      return sorted.sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
    case 'recent':
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    default:
      // An unrecognized stored value falls back to the default sort.
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
}

/**
 * Assign sortOrder 0..n-1 following the given order. Used when the teacher
 * switches to custom order: the custom arrangement starts as the order
 * they were just looking at.
 */
export function initializeCustomOrder(lists: WordList[]): WordList[] {
  return lists.map((l, i) => ({ ...l, sortOrder: i }))
}

/**
 * Reorder the All view by drag when custom sort is active: move `activeId`
 * to `overId`'s position and reassign sortOrder 0..n-1. Returns the original
 * array reference when nothing changes.
 */
export function reorderCustom(lists: WordList[], activeId: string, overId: string): WordList[] {
  const ordered = sortLists(lists, 'custom')
  const reordered = reorderById(ordered, activeId, overId)
  // reorderById returns its input unchanged when the drag changes nothing.
  if (reordered === ordered) return lists
  const order = new Map(reordered.map((l, i) => [l.id, i] as const))
  // Every list id is in the map: ordered covers all lists.
  return lists.map((l) => ({ ...l, sortOrder: order.get(l.id)! }))
}
