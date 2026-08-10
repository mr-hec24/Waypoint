// Turns a learner's personal frequency list into flashcard-ready vocabulary.
//
// Two modes, because the two jobs have different shapes:
//  - "normalize" merges inflected surface forms into lemmas and drops junk. One call
//    with every candidate, so merging decisions are made with the whole list in view.
//  - "translate" renders ranked lemmas into the target language, in batches.
//
// Only the word list is ever sent here — never the transcripts. These come from
// recordings of the learner's private life, and they stay in their own database.
// The ANTHROPIC_API_KEY secret stays server-side.

import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const NORMALIZE_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lemma: {
            type: 'string',
            description: 'The dictionary form the surfaces collapse to.',
          },
          surfaces: {
            type: 'array',
            items: { type: 'string' },
            description: 'Every input surface form belonging to this lemma.',
          },
          partOfSpeech: {
            type: 'string',
            description: 'noun, verb, adjective, adverb, pronoun, preposition, conjunction, determiner, interjection, phrase, or other.',
          },
          drop: {
            type: 'boolean',
            description: 'True when this is not worth learning as vocabulary.',
          },
          dropReason: {
            type: 'string',
            description: 'Short reason when drop is true; empty string otherwise.',
          },
        },
        required: ['lemma', 'surfaces', 'partOfSpeech', 'drop', 'dropReason'],
        additionalProperties: false,
      },
    },
  },
  required: ['groups'],
  additionalProperties: false,
} as const

const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lemma: { type: 'string', description: 'Echo of the input lemma, unchanged.' },
          translation: {
            type: 'string',
            description: 'The target-language word or phrase. Include the article/particle a learner needs.',
          },
          reading: {
            type: 'string',
            description: 'Pronunciation aid where the script needs one (furigana, pinyin). Empty string otherwise.',
          },
          exampleTarget: {
            type: 'string',
            description: 'One short, natural, spoken-register sentence in the target language.',
          },
          exampleNative: {
            type: 'string',
            description: "The same sentence in the learner's language.",
          },
        },
        required: ['lemma', 'translation', 'reading', 'exampleTarget', 'exampleNative'],
        additionalProperties: false,
      },
    },
  },
  required: ['entries'],
  additionalProperties: false,
} as const

function normalizeSystem(nativeLanguage: string): string {
  return `You are a corpus linguist preparing a personal vocabulary list. The input is a frequency-ranked list of word forms taken from transcripts of one person speaking ${nativeLanguage} about their everyday life, with how often each form appeared.

Group the surface forms into lemmas:
- Collapse inflections of the same word into one lemma ("go/goes/going/went" → "go"; "casa/casas" → "casa"). Every input surface must appear in exactly one group.
- Use the plain dictionary form as the lemma, in ${nativeLanguage}.
- Keep genuinely different words apart even when they look alike. Do not merge homographs with unrelated meanings.

Set drop=true for anything not worth a flashcard:
- Proper nouns: names of people, brands, and places specific to this speaker.
- Transcription noise, half-words, and non-words.
- Fragments of a larger word that the transcriber split.
Do NOT drop a word merely because it is common or grammatical. Function words — pronouns, auxiliaries, prepositions, connectives — are the single most valuable thing on this list, because they are what the learner will say most. Keep them.

Return one group per lemma. Preserve the speaker's own register: if they say the colloquial form, the lemma is the colloquial word, not a formal synonym.`
}

function translateSystem(nativeLanguage: string, targetLanguage: string): string {
  return `You are an experienced tutor of ${targetLanguage}. You are given lemmas in ${nativeLanguage}, taken from transcripts of a learner talking about their own daily life, ranked by how often they actually say them. These become the learner's first flashcards, so they are a complete beginner in ${targetLanguage}.

For each lemma return:
- "translation": the ${targetLanguage} word or phrase a native speaker would use in everyday spoken conversation. Where the word has several senses, pick the one an ordinary person means in daily conversation, not the rarest or most literary. Include whatever a beginner needs to use it: the article for nouns in gendered languages, the infinitive marker for verbs, the measure word where one is obligatory.
- "reading": a pronunciation aid only where the writing system needs one (furigana for Japanese, pinyin for Chinese). Empty string for languages written in a familiar alphabet.
- "exampleTarget": ONE short sentence in ${targetLanguage} using the word, in casual spoken register — the kind of thing this person would actually say about their own life, not a textbook sentence.
- "exampleNative": the same sentence in ${nativeLanguage}.

Return exactly one entry per input lemma, echoing the lemma unchanged so the caller can match them up.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const body = await req.json().catch(() => ({}))

  // Availability probe — lets the client hide the build affordance when unconfigured.
  if (body.ping) return json({ available: Boolean(anthropicKey) })

  if (!anthropicKey) return json({ error: 'Vocabulary building is not configured' }, 503)

  const { mode, nativeLanguage, targetLanguage, candidates, lemmas } = body as {
    mode?: 'normalize' | 'translate'
    nativeLanguage?: string
    targetLanguage?: string
    candidates?: { surface: string; count: number }[]
    lemmas?: string[]
  }

  if (mode !== 'normalize' && mode !== 'translate') {
    return json({ error: "mode must be 'normalize' or 'translate'" }, 400)
  }
  if (!nativeLanguage) return json({ error: 'nativeLanguage is required' }, 400)
  if (mode === 'translate' && !targetLanguage) {
    return json({ error: 'targetLanguage is required to translate' }, 400)
  }
  const payload =
    mode === 'normalize' ? { candidates: candidates ?? [] } : { lemmas: lemmas ?? [] }
  const itemCount = mode === 'normalize' ? (candidates ?? []).length : (lemmas ?? []).length
  if (itemCount === 0) return json({ error: 'Nothing to process' }, 400)

  // Confirm the caller is an authenticated user of this project.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: userData, error: authError } = await userClient.auth.getUser()
  if (authError || !userData.user) return json({ error: 'Not authenticated' }, 401)

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  try {
    // Streaming: max_tokens this large risks an HTTP timeout on a non-streaming call.
    const stream = anthropic.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      output_config: {
        format: {
          type: 'json_schema',
          schema: mode === 'normalize' ? NORMALIZE_SCHEMA : TRANSLATE_SCHEMA,
        },
        // Normalizing is mechanical; choosing a beginner's sense of a word is not.
        effort: mode === 'normalize' ? 'low' : 'medium',
      },
      system:
        mode === 'normalize'
          ? normalizeSystem(nativeLanguage)
          : translateSystem(nativeLanguage, targetLanguage!),
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    })

    const response = await stream.finalMessage()
    if (response.stop_reason === 'refusal') {
      return json({ error: 'The model declined this request' }, 502)
    }
    // Hitting the cap mid-object leaves unparseable JSON; say so rather than
    // failing on a syntax error the caller can't interpret.
    if (response.stop_reason === 'max_tokens') {
      return json(
        { error: `Ran out of output room on ${itemCount} items. Try again with fewer.` },
        502,
      )
    }
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return json({ error: 'Model returned no usable output' }, 502)
    }

    return json(JSON.parse(textBlock.text))
  } catch (e) {
    // Without this the real cause (bad model id, unsupported parameter, rate limit,
    // timeout) is swallowed into a generic 500 and the client just sees "non-2xx".
    const err = e as { status?: number; message?: string; error?: unknown }
    console.error('vocab_build failed', mode, itemCount, JSON.stringify(err.error ?? err.message))
    return json(
      {
        error: `Claude call failed (${err.status ?? 'no status'}): ${err.message ?? String(e)}`,
      },
      502,
    )
  }
})
