import { describe, expect, it } from 'vitest'
import { errorDetail } from './vocabBuild'

/**
 * supabase-js reports every non-2xx as the same opaque FunctionsHttpError. These cover
 * the unwrapping that turns it back into the function's own message.
 */
describe('errorDetail', () => {
  it('pulls the error field out of a JSON response body', async () => {
    const error = {
      message: 'Edge Function returned a non-2xx status code',
      context: new Response(JSON.stringify({ error: 'Claude call failed (400): bad param' }), {
        status: 502,
      }),
    }
    expect(await errorDetail(error)).toBe('Claude call failed (400): bad param')
  })

  it('falls back to raw text when the body is not JSON', async () => {
    const error = { context: new Response('upstream timeout', { status: 504 }) }
    expect(await errorDetail(error)).toBe('upstream timeout')
  })

  it('returns null when the body is JSON without an error field', async () => {
    const error = { context: new Response(JSON.stringify({ ok: true }), { status: 500 }) }
    expect(await errorDetail(error)).toBeNull()
  })

  it('returns null when there is no response to read', async () => {
    expect(await errorDetail({ message: 'network down' })).toBeNull()
    expect(await errorDetail(new Error('boom'))).toBeNull()
  })

  it('does not consume the body, so the response stays readable', async () => {
    const response = new Response(JSON.stringify({ error: 'first read' }), { status: 502 })
    expect(await errorDetail({ context: response })).toBe('first read')
    // A consumed stream here would throw and mask the real error.
    expect(await errorDetail({ context: response })).toBe('first read')
  })
})
