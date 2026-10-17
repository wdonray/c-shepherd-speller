/**
 * Server-side loader for the generated sentence bank
 * (src/data/generated-sentences.json): 100k words with two example
 * sentences each, written offline by a batch generation script
 * (~/workspace/sentence-gen/generate.py). The file is read once per
 * server process and cached in memory; a missing or corrupt file
 * resolves to an empty bank so callers fall through to the next
 * sentence source instead of failing the request.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type SentenceBank = Record<string, string[]>

const BANK_PATH = join(process.cwd(), 'src/data/generated-sentences.json')

let bankPromise: Promise<SentenceBank> | null = null

async function readBankFile(read: typeof readFile): Promise<SentenceBank> {
  try {
    const raw = await read(BANK_PATH, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SentenceBank
    }
    return {}
  } catch {
    // Missing file, unreadable file, or invalid JSON: treat as empty.
    return {}
  }
}

/** Load the generated bank, cached for the life of the server process. */
export function loadGeneratedBank(read: typeof readFile = readFile): Promise<SentenceBank> {
  if (!bankPromise) {
    bankPromise = readBankFile(read)
  }
  return bankPromise
}

/** Look up sentences for a word in the generated bank. Never throws. */
export async function generatedSentencesFor(word: string, read: typeof readFile = readFile): Promise<string[]> {
  const bank = await loadGeneratedBank(read)
  return bank[word.toLowerCase()] ?? []
}

/** Drop the in-memory cache. Test-only; the server never calls this. */
export function resetBankCacheForTesting(): void {
  bankPromise = null
}
