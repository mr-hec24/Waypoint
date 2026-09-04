import { describe, expect, it } from 'vitest'
import { errorDetail, mergeGroups, type LemmaGroup } from './vocabBuild'

function group(lemma: string, surfaces: string[], drop = false): LemmaGroup {
  return { lemma, surfaces, partOfSpeech: 'verb', drop, dropReason: drop ? 'noise' : '' }
}

/** Normalize is chunked to stay inside the worker budget, so chunks must recombine. */
describe('mergeGroups', () => {
  it('unions surfaces when two chunks report the same lemma', () => {
    const merged = mergeGroups([group('go', ['go', 'goes']), group('go', ['going', 'went'])])
    expect(merged).toHaveLength(1)
    expect(merged[0].surfaces).toEqual(['go', 'goes', 'going', 'went'])
  })

  it('matches lemmas case-insensitively without duplicating surfaces', () => {
    const merged = mergeGroups([group('Work', ['work']), group('work', ['work', 'worked'])])
    expect(merged).toHaveLength(1)
    expect(merged[0].surfaces).toEqual(['work', 'worked'])
  })

  it('keeps a lemma when any chunk found it usable', () => {
    // One chunk seeing only a proper-noun sense shouldn't lose the common word.
    const merged = mergeGroups([group('mark', ['mark'], true), group('mark', ['marked'], false)])
    expect(merged[0].drop).toBe(false)
    expect(merged[0].dropReason).toBe('')
  })

  it('drops only when every chunk agreed', () => {
    const merged = mergeGroups([group('uhh', ['uhh'], true), group('uhh', ['uhhh'], true)])
    expect(merged[0].drop).toBe(true)
  })

  it('ignores blank lemmas rather than creating an empty entry', () => {
    expect(mergeGroups([group('', ['x']), group('   ', ['y'])])).toEqual([])
  })

  it('leaves distinct lemmas alone', () => {
    expect(mergeGroups([group('go', ['go']), group('eat', ['eat'])])).toHaveLength(2)
  })
})

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
