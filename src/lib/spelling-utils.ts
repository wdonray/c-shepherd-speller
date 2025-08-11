export interface SpellingData {
  words: string[]
  sounds: string[]
  spelling: string[]
}

/**
 * Export spelling data to JSON format and trigger download
 */
export function exportSpellingData(data: SpellingData, filename: string = 'spelling-data.json'): void {
  const jsonData = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonData], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Import spelling data from JSON file
 */
export function importSpellingData(file: File): Promise<SpellingData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const data = JSON.parse(content) as SpellingData

        // Validate the data structure
        if (!isValidSpellingData(data)) {
          reject(new Error('Invalid spelling data format'))
          return
        }

        resolve(data)
      } catch (error) {
        reject(new Error('Failed to parse JSON file'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}

/**
 * Validate spelling data structure
 */
function isValidSpellingData(data: any): data is SpellingData {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray(data.words) &&
    Array.isArray(data.sounds) &&
    Array.isArray(data.spelling) &&
    data.words.every((item: any) => typeof item === 'string') &&
    data.sounds.every((item: any) => typeof item === 'string') &&
    data.spelling.every((item: any) => typeof item === 'string')
  )
}

/**
 * Check if spelling data has any content
 */
export function hasSpellingData(data: SpellingData): boolean {
  return data.words.length > 0 || data.sounds.length > 0 || data.spelling.length > 0
}

/**
 * Get total count of spelling items
 */
export function getSpellingDataCount(data: SpellingData): number {
  return data.words.length + data.sounds.length + data.spelling.length
}
