import { describe, expect, it } from 'vitest'
import { ALLOWLIST, findUnallowlisted, ghsaIdsFromAudit, main, runAuditJson } from './audit-gate.mjs'

const GHSA_URL = (id) => `https://github.com/advisories/${id}`

describe('ghsaIdsFromAudit', () => {
  it('returns an empty set for missing or empty input', () => {
    expect(ghsaIdsFromAudit(undefined).size).toBe(0)
    expect(ghsaIdsFromAudit(null).size).toBe(0)
    expect(ghsaIdsFromAudit({}).size).toBe(0)
    expect(ghsaIdsFromAudit({ vulnerabilities: {} }).size).toBe(0)
  })

  it('extracts IDs from the npm v7+ vulnerabilities shape', () => {
    const ids = ghsaIdsFromAudit({
      vulnerabilities: {
        foo: {
          via: [
            { url: GHSA_URL('ghsa-aaaa-bbbb-cccc') },
            'foo', // plain package-name via entries carry no advisory
            null,
            { url: 'https://example.com/no-advisory-here' },
            {},
          ],
        },
        bar: null,
        baz: {},
      },
    })
    expect([...ids]).toEqual(['GHSA-AAAA-BBBB-CCCC'])
  })

  it('deduplicates repeated IDs', () => {
    const ids = ghsaIdsFromAudit({
      vulnerabilities: {
        a: { via: [{ url: GHSA_URL('GHSA-AAAA-BBBB-CCCC') }] },
        b: { via: [{ url: GHSA_URL('ghsa-aaaa-bbbb-cccc') }] },
      },
    })
    expect([...ids]).toEqual(['GHSA-AAAA-BBBB-CCCC'])
  })

  it('falls back to the legacy advisories shape', () => {
    const ids = ghsaIdsFromAudit({
      advisories: {
        123: { url: GHSA_URL('GHSA-dddd-eeee-ffff') },
        124: { url: 'https://example.com/nothing' },
        125: {},
      },
    })
    expect([...ids]).toEqual(['GHSA-DDDD-EEEE-FFFF'])
  })
})

describe('findUnallowlisted', () => {
  it('returns an empty array when everything is allowlisted', () => {
    expect(findUnallowlisted(new Set(['GHSA-7RQJ-J65F-68WH']))).toEqual([])
    expect(findUnallowlisted(new Set())).toEqual([])
  })

  it('compares case-insensitively', () => {
    expect(findUnallowlisted(new Set(['ghsa-7rqj-j65f-68wh']))).toEqual([])
  })

  it('returns unallowlisted IDs sorted, using the default allowlist', () => {
    expect(findUnallowlisted(new Set(['GHSA-zzzz-0000-1111', 'GHSA-7rqj-j65f-68wh', 'GHSA-aaaa-0000-2222']))).toEqual([
      'GHSA-AAAA-0000-2222',
      'GHSA-ZZZZ-0000-1111',
    ])
  })

  it('accepts a custom allowlist', () => {
    expect(findUnallowlisted(new Set(['B', 'A']), {})).toEqual(['A', 'B'])
  })
})

describe('runAuditJson', () => {
  it('returns stdout when npm audit succeeds', () => {
    const execFn = (cmd, args, opts) => {
      expect(cmd).toBe('npm')
      expect(args).toEqual(['audit', '--json'])
      expect(opts.encoding).toBe('utf8')
      return '{"ok":true}'
    }
    expect(runAuditJson(execFn)).toBe('{"ok":true}')
  })

  it('returns stdout even when npm audit exits non-zero (findings reported)', () => {
    const err = new Error('Command failed')
    err.stdout = Buffer.from('{"vulnerabilities":{}}')
    const execFn = () => {
      throw err
    }
    expect(runAuditJson(execFn)).toBe('{"vulnerabilities":{}}')
  })

  it('throws a clear error when there is no JSON output', () => {
    expect(() =>
      runAuditJson(() => {
        throw new Error('EAI_AGAIN')
      })
    ).toThrow(/produced no JSON output/)
    expect(() =>
      runAuditJson(() => {
        const e = new Error('proxy blocked')
        e.stdout = '   '
        throw e
      })
    ).toThrow(/produced no JSON output/)
  })
})

describe('main', () => {
  it('exits 2 when the audit output cannot be obtained or parsed', () => {
    expect(
      main(() => {
        throw new Error('EAI_AGAIN')
      }).code
    ).toBe(2)
    expect(main(() => 'not json').code).toBe(2)
  })

  it('exits 0 when no advisories are reported', () => {
    const result = main(() => JSON.stringify({ vulnerabilities: {} }))
    expect(result.code).toBe(0)
    expect(result.message).toMatch(/0 advisories/)
  })

  it('exits 0 when every advisory is allowlisted', () => {
    const result = main(() =>
      JSON.stringify({
        vulnerabilities: {
          dep: { via: [{ url: GHSA_URL('GHSA-7rqj-j65f-68wh') }] },
        },
      })
    )
    expect(result.code).toBe(0)
    expect(result.message).toMatch(/1 advisory reported, all allowlisted/)
  })

  it('exits 1 listing unallowlisted advisories (singular and plural)', () => {
    const one = main(() =>
      JSON.stringify({ vulnerabilities: { d: { via: [{ url: GHSA_URL('GHSA-new0-0000-0001') }] } } })
    )
    expect(one.code).toBe(1)
    expect(one.message).toMatch(/1 unallowlisted advisory:/)
    expect(one.message).toMatch(/GHSA-NEW0-0000-0001/)

    const two = main(() =>
      JSON.stringify({
        vulnerabilities: {
          d1: { via: [{ url: GHSA_URL('GHSA-new0-0000-0002') }] },
          d2: { via: [{ url: GHSA_URL('GHSA-new0-0000-0001') }] },
        },
      })
    )
    expect(two.code).toBe(1)
    expect(two.message).toMatch(/2 unallowlisted advisories:/)
    // listed in sorted order
    expect(two.message.indexOf('GHSA-NEW0-0000-0001')).toBeLessThan(two.message.indexOf('GHSA-NEW0-0000-0002'))
  })
})

describe('ALLOWLIST', () => {
  it('documents a reason for every entry and uses GHSA-shaped keys', () => {
    for (const [id, reason] of Object.entries(ALLOWLIST)) {
      expect(id).toMatch(/^GHSA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      expect(reason.length).toBeGreaterThan(20)
    }
  })
})
