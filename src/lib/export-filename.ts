/**
 * Sanitizes a string for safe use in a download filename.
 * Lowercases, converts spaces to hyphens, strips characters outside
 * [a-z0-9-_], and collapses repeated hyphens/underscores.
 */
export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Builds the bulk-export filename for all spelling lists.
 * Format: patternspell-lists-YYYY-MM-DD.json
 */
export function buildExportFilename(date: Date = new Date()): string {
  const isoDate = date.toISOString().slice(0, 10)
  return `patternspell-lists-${isoDate}.json`
}
