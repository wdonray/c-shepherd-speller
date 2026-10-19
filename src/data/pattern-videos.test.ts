import { describe, it, expect } from 'vitest'
import {
  PATTERN_VIDEOS,
  getAllPatternGroups,
  getCollectionVideos,
  getVideosForPattern,
  isCuratedVideo,
  normalizePattern,
  searchVideos,
} from './pattern-videos'

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

describe('PATTERN_VIDEOS data invariants', () => {
  it('has 19 verified entries', () => {
    expect(PATTERN_VIDEOS).toHaveLength(19)
  })

  it('uses real 11-char video IDs, never invented placeholders', () => {
    for (const entry of PATTERN_VIDEOS) {
      expect(entry.videoId, `ID for "${entry.title}"`).toMatch(YOUTUBE_ID_PATTERN)
    }
  })

  it('has no duplicate video IDs', () => {
    const ids = PATTERN_VIDEOS.map((e) => e.videoId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a title, channel, and at least one pattern per entry', () => {
    for (const entry of PATTERN_VIDEOS) {
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.channel.length).toBeGreaterThan(0)
      expect(entry.patterns.length).toBeGreaterThan(0)
      for (const pattern of entry.patterns) {
        expect(pattern, `pattern key for "${entry.title}"`).toBe(pattern.toLowerCase().trim())
      }
    }
  })

  it('spot-checks known pattern coverage', () => {
    expect(getVideosForPattern('ai').map((v) => v.videoId)).toContain('GdmcWQCbqY8')
    expect(getVideosForPattern('ee').map((v) => v.videoId)).toEqual(
      expect.arrayContaining(['ZfbWOTCgRE0', '5q65IDzLhds', 'Cm4OnFLl5Uw', 'QSU9Y-NYJDk'])
    )
    expect(getVideosForPattern('ar').map((v) => v.videoId)).toEqual(
      expect.arrayContaining(['Xi2gD3TsmTg', 'DHC-GWFNSL0'])
    )
  })
})

describe('normalizePattern', () => {
  it('lowercases and trims', () => {
    expect(normalizePattern('  AI ')).toBe('ai')
    expect(normalizePattern('a_e')).toBe('a_e')
  })
})

describe('getVideosForPattern', () => {
  it('matches case-insensitively', () => {
    expect(getVideosForPattern('EE').map((v) => v.videoId)).toEqual(getVideosForPattern('ee').map((v) => v.videoId))
  })

  it('marks every result as a curated source with its channel', () => {
    for (const video of getVideosForPattern('sh')) {
      expect(video.source).toBe('curated')
      expect(video.channel).toBeTruthy()
    }
  })

  it('returns an empty list for an unknown pattern, never a guess', () => {
    expect(getVideosForPattern('xyz')).toEqual([])
  })
})

describe('searchVideos', () => {
  it('finds bank videos by title', () => {
    const results = searchVideos('diphthong')
    expect(results.map((v) => v.videoId)).toEqual(['XSOVfpapSXA'])
  })

  it('finds bank videos by channel, case-insensitively', () => {
    const results = searchVideos('scratch garden')
    expect(results.map((v) => v.videoId)).toEqual(['ZfbWOTCgRE0'])
  })

  it('returns nothing for a blank query', () => {
    expect(searchVideos('   ')).toEqual([])
  })

  it('returns nothing when nothing matches', () => {
    expect(searchVideos('quokka')).toEqual([])
  })

  it('skips channel-less attached videos when neither title nor channel matches', () => {
    const custom = {
      videoId: 'dQw4w9WgXcQ',
      title: 'My classroom song',
      source: 'custom' as const,
    }
    expect(searchVideos('quokka', [custom])).toEqual([])
  })

  it('also searches the extra attached videos', () => {
    const custom = {
      videoId: 'dQw4w9WgXcQ',
      title: 'My classroom long a song',
      source: 'custom' as const,
    }
    const results = searchVideos('classroom', [custom])
    expect(results).toEqual([custom])
  })

  it('de-duplicates by video ID, bank entry wins', () => {
    const duplicate = {
      videoId: 'ZfbWOTCgRE0',
      title: 'Scratch Garden',
      source: 'custom' as const,
    }
    const results = searchVideos('scratch garden', [duplicate])
    expect(results).toHaveLength(1)
    expect(results[0].source).toBe('curated')
  })
})

describe('getAllPatternGroups', () => {
  it('returns every covered pattern, sorted', () => {
    const groups = getAllPatternGroups()
    expect(groups).toEqual([...groups].sort())
    expect(groups).toEqual(expect.arrayContaining(['ai', 'a_e', 'ee', 'sh', 'ar', 'er', 'oi', 'au', 'a']))
    expect(new Set(groups).size).toBe(groups.length)
  })
})

describe('isCuratedVideo (issue #458)', () => {
  it('recognizes bank video IDs', () => {
    expect(isCuratedVideo(PATTERN_VIDEOS[0].videoId)).toBe(true)
  })

  it('rejects unknown video IDs', () => {
    expect(isCuratedVideo('dQw4w9WgXcQ')).toBe(false)
  })
})

describe('getCollectionVideos (issue #458)', () => {
  const mine = { videoId: 'dQw4w9WgXcQ', title: 'My pasted song', channel: 'Me', source: 'custom' as const }

  it('returns just the bank when the library is empty', () => {
    const collection = getCollectionVideos([])
    expect(collection).toHaveLength(19)
    expect(collection.every((video) => video.source === 'curated')).toBe(true)
  })

  it('appends her videos after the bank, in order added', () => {
    const second = { videoId: '9bZkp7q19f0', title: 'Second song', source: 'custom' as const }
    const collection = getCollectionVideos([mine, second])
    expect(collection).toHaveLength(21)
    expect(collection[19]).toEqual(mine)
    expect(collection[20]).toEqual(second)
    expect(collection.slice(0, 19).map((video) => video.videoId)).toEqual(PATTERN_VIDEOS.map((entry) => entry.videoId))
  })

  it('lets the bank win when a library entry clashes with a bank ID', () => {
    const clash = { ...mine, videoId: PATTERN_VIDEOS[0].videoId }
    const collection = getCollectionVideos([clash])
    expect(collection).toHaveLength(19)
    expect(collection[0]).toEqual({
      videoId: PATTERN_VIDEOS[0].videoId,
      title: PATTERN_VIDEOS[0].title,
      channel: PATTERN_VIDEOS[0].channel,
      source: 'curated',
    })
  })
})
