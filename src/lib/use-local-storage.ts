'use client'

import { useState, useCallback } from 'react'

/**
 * useState persisted to localStorage. Reads the stored value lazily on
 * mount; falls back to the default when storage is unavailable, blocked, or
 * holds nothing. Writes through on every set; a failed write keeps the
 * in-memory value working.
 */
export function useLocalStorage<T extends string>(key: string, defaultValue: T): readonly [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return (window.localStorage.getItem(key) as T | null) ?? defaultValue
    } catch {
      return defaultValue
    }
  })

  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, next)
      } catch {
        // Storage full or blocked; the in-memory value still works.
      }
    },
    [key]
  )

  return [value, set] as const
}
