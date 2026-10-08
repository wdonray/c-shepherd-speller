import { describe, expect, it } from 'vitest'
import { version as packageVersion } from '../../../../package.json'
import { GET, dynamic } from './route'

describe('GET /api/version', () => {
  it('is force-dynamic so deploys are never served a stale version', () => {
    expect(dynamic).toBe('force-dynamic')
  })

  it('returns the package.json version with a no-store cache header', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ version: packageVersion })
    expect(typeof packageVersion).toBe('string')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
