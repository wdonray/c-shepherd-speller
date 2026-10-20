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
  // Added for issue #495 (Oct 2026 research pass): every pattern group now
  // has at least two videos. Each entry verified via YouTube oEmbed;
  // titles and channels are verbatim and never invented.
  {
    videoId: '94eOpBrVmwY',
    title: 'Digraphs/Final Sound/The Engma Sound /ng/Phonics Song',
    channel: 'English4abc',
    patterns: ['ng'],
  },
  {
    videoId: 'd272ehgASnI',
    title: '-NG Sound Song - Phonics Song For Kids | Smiley Rhymes',
    channel: 'Smiley Rhymes',
    patterns: ['ng'],
  },
  {
    videoId: '9K70YXyyJ_M',
    title: "How To Use 'NG' in Words | StoryBots: Learn to Read | Netflix Jr",
    channel: 'Netflix Jr.',
    patterns: ['ng'],
  },
  {
    videoId: 'yqVqNaIZHOw',
    title: 'Digraphs / Consonant Digraphs / The Letters C+K+CK / Phonics Song',
    channel: 'English4abc',
    patterns: ['ck'],
  },
  {
    videoId: 'rGOtW405L1o',
    title: 'WH Digraph Sound | WH Song and Practice | ABC Phonics Song with Sounds for Children',
    channel: "Rock 'N Learn",
    patterns: ['wh'],
  },
  {
    videoId: 'atUdWa0UqAM',
    title: 'Digraphs/ The Sound of "wh" /  Phonics Song',
    channel: 'English4abc',
    patterns: ['wh'],
  },
  {
    videoId: 'bp8arskkcXg',
    title: 'Look Out for Bossy R | Fun Phonics Song for Kids | English Song for Children | Jack Hartmann',
    channel: 'Jack Hartmann Kids Music Channel',
    patterns: ['ar', 'or', 'er', 'ir', 'ur'],
  },
  {
    videoId: 'Eq2pUspQo0g',
    title: 'Digraph Rap #2 | Phonics Digraph Song for Kids | Fun Kids English',
    channel: 'Fun Kids English',
    patterns: ['ar', 'ir', 'or', 'ow'],
  },
  {
    videoId: 'HILiE1m1rP0',
    title: 'How Do "OI" & "OY" Sound? | StoryBots: Learn to Read | Netflix Jr',
    channel: 'Netflix Jr.',
    patterns: ['oi', 'oy'],
  },
  {
    videoId: 'p63GORjHBN0',
    title: 'Long vowel pair OY Sound Song l Phonics for English Education',
    channel: 'Hello Carrie',
    patterns: ['oy'],
  },
  {
    videoId: '1ZZ6mVwuvRE',
    title: 'Digraph Rap #3 | Phonics Digraph Song for Kids | Fun Kids English',
    channel: 'Fun Kids English',
    patterns: ['oy', 'ai', 'ow', 'ay'],
  },
  {
    videoId: 'fR-BLFZyAWs',
    title: 'The Vowel Song (a e i o u)',
    channel: 'Maple Leaf Learning',
    patterns: ['a', 'e', 'i', 'o', 'u'],
  },
  {
    videoId: '4TjcT7Gto3U',
    title: 'The Vowel Song: Long and Short Vowel Sounds | English Songs | Scratch Garden',
    channel: 'Scratch Garden',
    patterns: ['i', 'o', 'u'],
  },
  {
    videoId: 'd-fjJBdXR0E',
    title: "Between the Lions:  What's Cooking? - Hot Chop Drop Soup",
    channel: 'BTLfanatic',
    patterns: ['o'],
  },
  {
    videoId: 'lhikrG4PJfQ',
    title: 'Phonics Songs - Group 4 (ai,Jj,oa,ie,ee,or) #primaryworld #jollyphonics #phonics',
    channel: 'Primary World',
    patterns: ['ai', 'oa', 'ie', 'ee', 'or'],
  },
  {
    videoId: 'eoy1JXYPn6w',
    title: 'ay | Fun Phonics | How to Read | Made by Kids vs Phonics',
    channel: 'Kids vs Life',
    patterns: ['ay'],
  },
  {
    videoId: 'ozEKeEN5uKc',
    title: 'Word Families Song | A Y AY! | Hip-Hop Action Song for Kids | Learning Song',
    channel: 'Miss Nina - Music & Movement for Preschool',
    patterns: ['ay'],
  },
  {
    videoId: 'OPGs-RdA6dM',
    title: 'Long Vowel Sounds | ue, ew | Phonics Songs and Stories | Learn to Read',
    channel: 'Little Fox - Kids Stories and Songs',
    patterns: ['ue'],
  },
  {
    videoId: 'QxhF1RZdAIc',
    title: 'ue | Fun Phonics | How to Read | Made by Kids vs Phonics',
    channel: 'Kids vs Life',
    patterns: ['ue'],
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
 * Plain-language pattern groups for the browse filter (issue #439). The
 * bank's 30+ raw pattern tags collapsed into one dropdown would still be a
 * 30-choice decision behind a click; these six teacher-friendly groups keep
 * the choice small. Every bank pattern belongs to exactly one group (pinned
 * by test).
 */
export interface PatternVideoGroup {
  /** Teacher-facing label, e.g. "Bossy r". */
  label: string
  /** Bank pattern tags in this group. */
  patterns: string[]
}

export const PATTERN_GROUPS: PatternVideoGroup[] = [
  { label: 'Short vowels', patterns: ['a', 'e', 'i', 'o', 'u'] },
  { label: 'Long vowel teams', patterns: ['ai', 'ay', 'ea', 'ee', 'ie', 'oa', 'ue'] },
  { label: 'Silent e', patterns: ['a_e', 'i_e', 'o_e', 'u_e'] },
  { label: 'Digraphs', patterns: ['sh', 'th', 'ch', 'wh', 'ck', 'ng'] },
  { label: 'Bossy r', patterns: ['ar', 'or', 'er', 'ir', 'ur'] },
  { label: 'Diphthongs', patterns: ['oi', 'oy', 'ou', 'ow', 'au', 'aw'] },
]

/** The plain-language pattern groups driving the browse page filter. */
export function getPatternGroups(): PatternVideoGroup[] {
  return PATTERN_GROUPS
}

/**
 * The homepage spotlight (issue #439): three featured picks from the
 * curated bank, chosen for diverse coverage (vowel teams, silent e,
 * digraphs). Explicit IDs, not bank order, so reordering the bank never
 * silently changes the homepage.
 */
const FEATURED_VIDEO_IDS = ['GdmcWQCbqY8', 'mxVWScxsOsc', 'NK8_Tvu6bJk']

export function getFeaturedVideos(): PatternVideoEntry[] {
  const byId = new Map(PATTERN_VIDEOS.map((entry) => [entry.videoId, entry]))
  return FEATURED_VIDEO_IDS.map((id) => byId.get(id)).filter((entry) => entry !== undefined)
}

/**
 * Search the curated bank by title, channel, or pattern tag,
 * case-insensitive, in bank order. Blank query returns no matches; callers
 * show featured picks or the full bank instead.
 */
export function searchSongVideos(query: string): PatternVideoEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return PATTERN_VIDEOS.filter(
    (entry) =>
      entry.title.toLowerCase().includes(q) ||
      entry.channel.toLowerCase().includes(q) ||
      entry.patterns.some((pattern) => pattern.includes(q))
  )
}

/**
 * Whether the video ID is in the curated bank (issue #458). Pasted links
 * that match a bank video are already in every teacher's collection by
 * definition, so they are never stored in her personal library.
 */
export function isCuratedVideo(videoId: string): boolean {
  return PATTERN_VIDEOS.some((entry) => entry.videoId === videoId)
}

/**
 * The teacher's full song-video collection (issue #458): the curated bank
 * plus everything she added by pasting links, in the order added. Her
 * videos append after the bank so the familiar curated layout stays
 * stable. De-duplicated by video ID with the bank winning on a clash, so a
 * bank video stored in her library by mistake still renders once.
 */
export function getCollectionVideos(library: PatternVideo[]): PatternVideo[] {
  const bankIds = new Set(PATTERN_VIDEOS.map((entry) => entry.videoId))
  const mine = library.filter((video) => !bankIds.has(video.videoId))
  return [...PATTERN_VIDEOS.map(toPatternVideo), ...mine]
}
