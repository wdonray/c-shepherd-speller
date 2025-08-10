/**
 * Client-side API functions for spelling operations
 * These functions make HTTP requests to the API routes
 */

export interface SpellingData {
  words: string[]
  sounds: string[]
  spelling: string[]
}

export async function getUserByEmail(email: string): Promise<string> {
  const response = await fetch(`/api/users?email=${encodeURIComponent(email)}`)
  if (!response.ok) {
    throw new Error('Failed to fetch user by email')
  }
  const data = await response.json()
  return data.user.id
}

/**
 * Get spelling data for a user
 */
export async function getSpelling(userId: string): Promise<SpellingData> {
  const response = await fetch(`/api/users/${userId}/spelling`)
  if (!response.ok) {
    throw new Error('Failed to fetch spelling data')
  }
  const data = await response.json()
  return data.spellingData
}

/**
 * Add a word to user's spelling data
 */
export async function addWord(userId: string, word: string, currentWords: string[]): Promise<void> {
  const response = await fetch(`/api/users/${userId}/spelling`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      words: [...currentWords, word],
    }),
  })
  if (!response.ok) {
    throw new Error('Failed to add word')
  }
}

/**
 * Add a sound to user's spelling data
 */
export async function addSound(userId: string, sound: string, currentSounds: string[]): Promise<void> {
  const response = await fetch(`/api/users/${userId}/spelling`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sounds: [...currentSounds, sound],
    }),
  })
  if (!response.ok) {
    throw new Error('Failed to add sound')
  }
}

/**
 * Add a spelling to user's spelling data
 */
export async function addSpelling(userId: string, spelling: string, currentSpelling: string[]): Promise<void> {
  const response = await fetch(`/api/users/${userId}/spelling`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spelling: [...currentSpelling, spelling],
    }),
  })
  if (!response.ok) {
    throw new Error('Failed to add spelling')
  }
}

/**
 * Remove an item from user's spelling data
 */
export async function removeItem(
  userId: string,
  type: 'words' | 'sounds' | 'spelling',
  index: number,
  currentItems: string[]
): Promise<void> {
  const updatedItems = currentItems.filter((_, i) => i !== index)
  const response = await fetch(`/api/users/${userId}/spelling`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      [type]: updatedItems,
    }),
  })
  if (!response.ok) {
    throw new Error(`Failed to remove ${type}`)
  }
}

/**
 * Update user's last active timestamp
 */
export async function updateLastActive(userId: string): Promise<void> {
  const response = await fetch(`/api/users/${userId}/last-active`, {
    method: 'PUT',
  })
  if (!response.ok) {
    console.warn('Failed to update last active timestamp')
  }
}
