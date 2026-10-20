import { describe, it, expect } from 'vitest'
import {
  PATTERN_VIDEOS,
  getCollectionVideos,
  getFeaturedVideos,
  getPatternGroups,
  getVideosForPattern,
  isCuratedVideo,
  normalizePattern,
  searchSongVideos,
  searchVideos,
} from './pattern-videos'

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

describe('PATTERN_VIDEOS data invariants', () => {
  it('has 39 verified entries', () => {
    expect(PATTERN_VIDEOS).toHaveLength(39)
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

  it('covers the ng pattern added in issue #495', () => {
    expect(getVideosForPattern('ng').map((v) => v.videoId)).toEqual(
      expect.arrayContaining(['94eOpBrVmwY', 'd272ehgASnI', '9K70YXyyJ_M'])
    )
    for (const video of getVideosForPattern('ng')) {
      expect(video.source).toBe('curated')
    }
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
    expect(results.map((v) => v.videoId)).toEqual(['ZfbWOTCgRE0', '4TjcT7Gto3U'])
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
    // Both bank videos match; the pasted duplicate of ZfbWOTCgRE0 is dropped.
    expect(results.map((v) => v.videoId)).toEqual(['ZfbWOTCgRE0', '4TjcT7Gto3U'])
    expect(results.every((v) => v.source === 'curated')).toBe(true)
  })
})

describe('getPatternGroups', () => {
  it('returns six plain-language groups', () => {
    const groups = getPatternGroups()
    expect(groups.map((g) => g.label)).toEqual([
      'Short vowels',
      'Long vowel teams',
      'Silent e',
      'Digraphs',
      'Bossy r',
      'Diphthongs',
    ])
  })

  it('covers every bank pattern exactly once', () => {
    const grouped = getPatternGroups().flatMap((g) => g.patterns)
    const bank = [...new Set(PATTERN_VIDEOS.flatMap((e) => e.patterns))].sort()
    expect([...grouped].sort()).toEqual(bank)
    expect(new Set(grouped).size).toBe(grouped.length)
  })
})

describe('getFeaturedVideos', () => {
  it('returns three bank entries in spotlight order', () => {
    const featured = getFeaturedVideos()
    expect(featured).toHaveLength(3)
    expect(featured.map((e) => e.videoId)).toEqual(['GdmcWQCbqY8', 'mxVWScxsOsc', 'NK8_Tvu6bJk'])
    for (const entry of featured) {
      expect(PATTERN_VIDEOS).toContainEqual(entry)
    }
  })
})

describe('searchSongVideos', () => {
  it('matches titles case-insensitively', () => {
    const results = searchSongVideos('silent e')
    expect(results.map((e) => e.videoId)).toContain('mxVWScxsOsc')
  })

  it('matches channels case-insensitively', () => {
    const results = searchSongVideos('jack hartmann')
    expect(results.length).toBeGreaterThan(1)
    for (const entry of results) {
      expect(entry.channel.toLowerCase()).toContain('jack hartmann')
    }
  })

  it('matches pattern tags', () => {
    const results = searchSongVideos('ck')
    expect(results.map((e) => e.videoId)).toContain('qEgggBAF_nw')
  })

  it('returns bank order and no matches for a blank query', () => {
    expect(searchSongVideos('   ')).toEqual([])
    const results = searchSongVideos('phonics')
    const ids = results.map((e) => e.videoId)
    expect(ids).toEqual(
      [...ids].sort(
        (a, b) => PATTERN_VIDEOS.findIndex((e) => e.videoId === a) - PATTERN_VIDEOS.findIndex((e) => e.videoId === b)
      )
    )
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
    expect(collection).toHaveLength(39)
    expect(collection.every((video) => video.source === 'curated')).toBe(true)
  })

  it('appends her videos after the bank, in order added', () => {
    const second = { videoId: '9bZkp7q19f0', title: 'Second song', source: 'custom' as const }
    const collection = getCollectionVideos([mine, second])
    expect(collection).toHaveLength(41)
    expect(collection[39]).toEqual(mine)
    expect(collection[40]).toEqual(second)
    expect(collection.slice(0, 39).map((video) => video.videoId)).toEqual(PATTERN_VIDEOS.map((entry) => entry.videoId))
  })

  it('lets the bank win when a library entry clashes with a bank ID', () => {
    const clash = { ...mine, videoId: PATTERN_VIDEOS[0].videoId }
    const collection = getCollectionVideos([clash])
    expect(collection).toHaveLength(39)
    expect(collection[0]).toEqual({
      videoId: PATTERN_VIDEOS[0].videoId,
      title: PATTERN_VIDEOS[0].title,
      channel: PATTERN_VIDEOS[0].channel,
      source: 'curated',
    })
  })
})
