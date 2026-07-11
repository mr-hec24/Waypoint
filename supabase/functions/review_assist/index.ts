// Fills the "correct way to say it" column of a story review with Claude:
// compares what the learner said vs meant, returns the natural phrasing,
// a short gap explanation, and flashcard suggestions (words and phrases).
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

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rowId: { type: 'string' },
          corrected: {
            type: 'string',
            description: 'The natural, native-speaker phrasing of what the learner meant, in the target language.',
          },
          explanation: {
            type: 'string',
            description: 'One short sentence on the gap between what was said and what was meant. Empty string if the learner already said it correctly.',
          },
          flashcards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                term: { type: 'string', description: 'Target-language word or phrase to memorize.' },
                definition: { type: 'string', description: "Meaning in the learner's language." },
                isPhrase: { type: 'boolean', description: 'True for multi-word phrases, idioms, and sayings.' },
              },
              required: ['term', 'definition', 'isPhrase'],
              additionalProperties: false,
            },
          },
        },
        required: ['rowId', 'corrected', 'explanation', 'flashcards'],
        additionalProperties: false,
      },
    },
  },
  required: ['rows'],
  additionalProperties: false,
} as const

function systemPrompt(targetLanguage: string): string {
  return `You are an experienced tutor of ${targetLanguage} helping a learner review a recording of themselves speaking (the "three-column method"). For each row you receive:
- "transcript" is what the learner actually said (may contain errors, mixed languages, or fillers).
- "intention" is what they wanted to say (may be in their native language or broken ${targetLanguage}).

For each row, return:
- "corrected": how a native ${targetLanguage} speaker would naturally express the intention. Match the learner's register (casual spoken language unless the intention suggests otherwise).
- "explanation": ONE short sentence naming the key gap (wrong word, false friend, grammar, missing idiom). Use the learner's own language for the explanation when the intention is written in it. If the transcript already expressed the intention correctly, return an empty string.
- "flashcards": ONLY genuinely useful cards — words the learner misused or lacked, and whole phrases/idioms/sayings worth memorizing as a unit. The term is in ${targetLanguage}; the definition is a concise meaning in the language the learner wrote their intention in. Return an empty array when the row was already correct or nothing is worth a card. Never suggest words the learner clearly already knows.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const body = await req.json().catch(() => ({}))

  if (body.ping) return json({ available: Boolean(anthropicKey) })

  if (!anthropicKey) return json({ error: 'Corrections are not configured' }, 503)
  const { targetLanguage, rows } = body as {
    targetLanguage?: string
    rows?: { id: string; transcript: string; intention: string }[]
  }
  if (!targetLanguage || !Array.isArray(rows) || rows.length === 0) {
    return json({ error: 'targetLanguage and a non-empty rows array are required' }, 400)
  }

  // Confirm the caller is an authenticated user of this project.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: userData, error: authError } = await userClient.auth.getUser()
  if (authError || !userData.user) return json({ error: 'Not authenticated' }, 401)

  const anthropic = new Anthropic({ apiKey: anthropicKey })
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: systemPrompt(targetLanguage),
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          rows: rows.map((r) => ({ rowId: r.id, transcript: r.transcript, intention: r.intention })),
        }),
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    return json({ error: 'Model returned no usable output' }, 502)
  }

  const parsed = JSON.parse(textBlock.text) as {
    rows: { rowId: string; corrected: string; explanation: string; flashcards: unknown[] }[]
  }
  return json({ rows: parsed.rows })
})
