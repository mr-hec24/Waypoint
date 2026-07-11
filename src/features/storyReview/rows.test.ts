import { describe, expect, it } from 'vitest'
import { segmentsToRows, suggestionToWord, textToRows, emptyRow } from './rows'

let nextId = 0
const makeId = () => `row-${nextId++}`

describe('segmentsToRows', () => {
  it('maps one row per segment with transcript and span', () => {
    const rows = segmentsToRows(
      [
        { text: 'Ayer fui al mercado con mi hermana.', startSec: 0, endSec: 4.2 },
        { text: 'Compramos muchas frutas y verduras.', startSec: 4.2, endSec: 8 },
      ],
      makeId,
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]!.transcript).toBe('Ayer fui al mercado con mi hermana.')
    expect(rows[0]!.span).toEqual([0, 4.2])
    expect(rows[1]!.span).toEqual([4.2, 8])
    expect(rows[0]!.intention).toBe('')
    expect(rows[0]!.translation).toBe('')
  })

  it('merges short segments into the previous row and extends its span', () => {
    const rows = segmentsToRows(
      [
        { text: 'Fuimos a la playa el sábado.', startSec: 0, endSec: 3 },
        { text: 'Sí.', startSec: 3, endSec: 3.5 },
        { text: 'Eh...', startSec: 3.5, endSec: 4 },
        { text: 'Después comimos en un restaurante.', startSec: 4, endSec: 8 },
      ],
      makeId,
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]!.transcript).toBe('Fuimos a la playa el sábado. Sí. Eh...')
    expect(rows[0]!.span).toEqual([0, 4])
    expect(rows[1]!.transcript).toBe('Después comimos en un restaurante.')
  })

  it('keeps a short first segment as its own row (nothing to merge into)', () => {
    const rows = segmentsToRows([{ text: 'Hola.', startSec: 0, endSec: 1 }], makeId)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.transcript).toBe('Hola.')
  })

  it('skips empty/whitespace segments', () => {
    const rows = segmentsToRows(
      [
        { text: '   ', startSec: 0, endSec: 1 },
        { text: 'Una frase completa de verdad.', startSec: 1, endSec: 3 },
      ],
      makeId,
    )
    expect(rows).toHaveLength(1)
  })
})

describe('textToRows', () => {
  it('splits on sentence boundaries and newlines', () => {
    const rows = textToRows(
      'Ayer fui al mercado. ¡Compré muchas frutas!\n¿Qué más puedo decir? Nada más…',
      makeId,
    )
    expect(rows.map((r) => r.transcript)).toEqual([
      'Ayer fui al mercado.',
      '¡Compré muchas frutas!',
      '¿Qué más puedo decir? Nada más…',
    ])
    expect(rows[0]!.span).toBeNull()
    expect(rows[0]!.intention).toBe('')
  })

  it('merges short fragments into the previous row', () => {
    const rows = textToRows('Fuimos a la playa el sábado. Sí. Después comimos en casa.', makeId)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.transcript).toBe('Fuimos a la playa el sábado. Sí.')
  })

  it('handles blank and whitespace-only text', () => {
    expect(textToRows('', makeId)).toHaveLength(0)
    expect(textToRows('   \n\n  ', makeId)).toHaveLength(0)
  })
})

describe('suggestionToWord', () => {
  const NOW = Date.parse('2026-07-09T12:00:00Z')
  const row = {
    ...emptyRow('r1'),
    transcript: 'Yo estaba muy embarazada por mi error.',
    intention: 'I was very embarrassed about my mistake.',
    translation: 'Estaba muy avergonzado por mi error.',
    span: [10, 15] as [number, number],
  }

  it('builds a new-state word in the target deck with voice_memo source', () => {
    const word = suggestionToWord(
      { term: 'avergonzado', definition: 'embarrassed', isPhrase: false },
      row,
      { type: 'voice_memo', recordingId: 'rec-1', transcriptSpan: row.span },
      'deck-1',
      'user-1',
      NOW,
      'word-1',
    )
    expect(word).toMatchObject({
      id: 'word-1',
      userId: 'user-1',
      deckId: 'deck-1',
      term: 'avergonzado',
      definition: 'embarrassed',
      exampleSentence: 'Estaba muy avergonzado por mi error.',
      source: { type: 'voice_memo', recordingId: 'rec-1', transcriptSpan: [10, 15] },
      frequencyRank: null,
      encounterCount: 1,
    })
    expect(word.srs.state).toBe('new')
    expect(word.srs.due).toBe(NOW)
    expect(word.srs.ease).toBe(2.5)
  })

  it('supports the writing source and falls back to a null example', () => {
    const bare = { ...emptyRow('r2'), transcript: 'algo' }
    const word = suggestionToWord(
      { term: 'ponerse las pilas', definition: 'to get one’s act together', isPhrase: true },
      bare,
      { type: 'writing', logId: 'log-1' },
      'deck-1',
      'user-1',
      NOW,
    )
    expect(word.exampleSentence).toBeNull()
    expect(word.source).toEqual({ type: 'writing', logId: 'log-1' })
  })
})
