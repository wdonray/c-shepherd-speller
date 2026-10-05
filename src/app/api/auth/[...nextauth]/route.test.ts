import { describe, it, expect } from 'vitest'

// Importing the module constructs NextAuth(authOptions) once with the real
// (undefined-in-test) env vars and real DynamoDB clients. No network happens
// at construction, so all we can sanely assert here is the handler shape.
import { GET, POST } from './route'

describe('GET/POST /api/auth/[...nextauth]', () => {
  it('exports a GET handler function', () => {
    expect(typeof GET).toBe('function')
  })

  it('exports a POST handler function', () => {
    expect(typeof POST).toBe('function')
  })
})
