import { describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import { noStore, noStoreJson } from './no-store'

describe('no-store', () => {
  it('sets Cache-Control: no-store on an existing response', () => {
    const res = noStore(NextResponse.json({ a: 1 }))
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('preserves the response status and body', async () => {
    const res = noStore(NextResponse.json({ error: 'nope' }, { status: 404 }))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'nope' })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('noStoreJson builds a JSON response with no-store', async () => {
    const res = noStoreJson({ user: { id: 'u1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ user: { id: 'u1' } })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('noStoreJson passes through init status', async () => {
    const res = noStoreJson({ error: 'bad' }, { status: 400 })
    expect(res.status).toBe(400)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
