/**
 * Curated bank of phonics song videos per spelling pattern (issue #401).
 *
 * Every entry was verified via YouTube oEmbed: video IDs, titles, and
 * channel names are verbatim and never invented. The bank is local data;
 * the in-app search searches this bank plus the teacher's own attached
 * videos, never the live YouTube index.
 */
import type { PatternVideo } from '@/models/WordList'

/** One curated bank entry: a video plus the patterns it covers. */
export interface PatternVideoEntry {
  videoId: string
  title: string
  channel: string
  patterns: string[]
}

/**
 * The curated bank. Pattern keys are lowercase spelling-pattern text,
 * matching normalizePattern.
 */
export const PATTERN_VIDEOS: PatternVideoEntry[] = [
  {
    videoId: 'GdmcWQCbqY8',
    title: 'When Two Vowels Go Walking | Jack Hartmann Vowel Teams Song | Vowels Song',
    channel: 'Jack Hartmann Kids Music Channel',
    patterns: ['ai', 'ay', 'ea', 'ie', 'oa', 'ue'],
  },
  {
    videoId: 'mxVWScxsOsc',
    title: 'Silent E | Phonics Song for Kids | Jack Hartmann',
    channel: 'Jack Hartmann Kids Music Channel',
    patterns: ['a_e', 'i_e', 'o_e', 'u_e'],
  },
  {
    videoId: 'ZfbWOTCgRE0',
    title: 'The Vowel Teams Song  | The Long E Sound | Phonics Song',
    channel: 'Scratch Garden',
    patterns: ['ee', 'ea'],
  },
  {
    videoId: '5q65IDzLhds',
    title: 'Long E Teams | Phonics for Kids | Long E Words | English Reading Practice',
    channel: 'Bright Learning world',
    patterns: ['ee', 'ea'],
  },
  {
    videoId: 'Cm4OnFLl5Uw',
    title: 'Letter E Song',
    channel: 'Have Fun Teaching',
    patterns: ['ee', 'ea', 'e'],
  },
  {
    videoId: 'QSU9Y-NYJDk',
    title: 'Learn "EE" & "EA" Phonics! Spin the Wheel Reading Game for Kids (Lesson 1)',
    channel: 'Spin the Wheel',
    patterns: ['ee', 'ea'],
  },
  {
    videoId: 'NK8_Tvu6bJk',
    title: 'Digraphs | Phonics Song for Children | Phonemic Awareness | Jack Hartmann',
    channel: 'Jack Hartmann Kids Music Channel',
    patterns: ['sh', 'th', 'ch', 'wh'],
  },
  {
    videoId: 'vJWKudfRipc',
    title: 'SH Digraph Sound | SH Song and Practice | ABC Phonics Song with Sounds for Children',
    channel: "Rock 'N Learn",
    patterns: ['sh'],
  },
  {
    videoId: 'x5KapgWPxxE',
    title: 'ch sh th (PHONICS) | digraphs | LEARN ENGLISH | REVISION',
    channel: 'Auntie Ruth',
    patterns: ['ch', 'sh', 'th'],
  },
  {
    videoId: 'cXxn8UVLAH0',
    title: 'Phonics for Kids 🗣 The Voiceless TH Sound 👍 Phonics in English 🌊',
    channel: 'Smile and Learn - English',
    patterns: ['th'],
  },
  {
    videoId: 'Lep6kF_s8eQ',
    title: 'Digraph Rap | Phonics Digraph Song for Kids | Fun Kids English',
    channel: 'Fun Kids English',
    patterns: ['sh', 'ch', 'ou'],
  },
  {
    videoId: 'qEgggBAF_nw',
    title: 'Digraph CK - 4 Minute Phonics',
    channel: '4 Minute Phonics',
    patterns: ['ck'],
  },
  {
    videoId: 'Xi2gD3TsmTg',
    title: 'Bossy-R Pirate | AR | Phonics Garden',
    channel: 'Phonics Garden',
    patterns: ['ar'],
  },
  {
    videoId: 'DHC-GWFNSL0',
    title: 'The Rules of Bossy "R" | StoryBots: Learn to Read | Netflix Jr',
    channel: 'Netflix Jr.',
    patterns: ['ar', 'or', 'er', 'ir', 'ur'],
  },
  {
    videoId: 'mr6TitJodII',
    title: 'Bossy R! | ER, IR and UR Words | Jack Hartmann',
    channel: 'Jack Hartmann Kids Music Channel',
    patterns: ['er', 'ir', 'ur'],
  },
  {
    videoId: 'XSOVfpapSXA',
    title: 'The Diphthong Song | Jack Hartmann| How to Sing Diphthongs',
    channel: 'Jack Hartmann Kids Music Channel',
    patterns: ['oi', 'oy', 'ou', 'ow', 'au', 'aw'],
  },
  {
    videoId: '8vAd5qEGqdM',
    title: 'The Sound of aw - au / Phonics Mix! Paw, draw, yawn, pawn, August, launch, applaud and sauce.',
    channel: 'English4abc',
    patterns: ['au', 'aw'],
  },
  {
    videoId: 'KGZFmW3uPJE',
    title: "Letter A | Alphabet Song for Kids | Let's Learn About The Alphabet | Phonics Song | Jack Hartmann",
    channel: 'Jack Hartmann Kids Music Channel',
    patterns: ['a'],
  },
  {
    videoId: '0Au0bE0WxBc',
    title: 'Vowel Sound Workout | Phonics Song for Kids | Exercise and Movement Song | Jack Hartmann',
    channel: 'Jack Hartmann Kids Music Channel',
    patterns: ['a', 'e', 'i', 'o', 'u'],
  },
]

/** Normalize a pattern string for bank lookup: lowercase, trimmed. */
export function normalizePattern(pattern: string): string {
  return pattern.trim().toLowerCase()
}

function toPatternVideo(entry: PatternVideoEntry): PatternVideo {
  return { videoId: entry.videoId, title: entry.title, channel: entry.channel, source: 'curated' }
}

/**
 * Curated videos covering the given spelling pattern text. Matching is on
 * the normalized pattern; unknown patterns get an empty list, never a guess.
 */
export function getVideosForPattern(pattern: string): PatternVideo[] {
  const normalized = normalizePattern(pattern)
  return PATTERN_VIDEOS.filter((entry) => entry.patterns.includes(normalized)).map(toPatternVideo)
}

function matchesQuery(video: PatternVideo, query: string): boolean {
  return video.title.toLowerCase().includes(query) || (video.channel?.toLowerCase().includes(query) ?? false)
}

/**
 * Search the curated bank plus the teacher's own attached videos
 * (the `extra` list) by title or channel, case-insensitive. Never touches
 * the live YouTube index: there is no YouTube Data API key. Results are
 * de-duplicated by video ID; the bank entry wins on a clash.
 */
export function searchVideos(query: string, extra: PatternVideo[] = []): PatternVideo[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const seen = new Set<string>()
  const results: PatternVideo[] = []
  for (const video of [...PATTERN_VIDEOS.map(toPatternVideo), ...extra]) {
    if (seen.has(video.videoId) || !matchesQuery(video, q)) continue
    seen.add(video.videoId)
    results.push(video)
  }
  return results
}

/**
 * Every spelling pattern covered by the bank, sorted alphabetically.
 * Drives the home page's browse filter chips.
 */
export function getAllPatternGroups(): string[] {
  const groups = new Set<string>()
  for (const entry of PATTERN_VIDEOS) {
    for (const pattern of entry.patterns) groups.add(pattern)
  }
  return [...groups].sort()
}
