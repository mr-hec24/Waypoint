// Transcribes a story-speaking recording with OpenAI Whisper.
// The OPENAI_API_KEY secret stays server-side; the client sends only a
// recordingId and gets back { text, segments }.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_BYTES = 25 * 1024 * 1024 // OpenAI transcription upload limit

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const body = await req.json().catch(() => ({}))

  // Availability probe — lets the client hide the Transcribe button when unconfigured.
  if (body.ping) return json({ available: Boolean(openaiKey) })

  if (!openaiKey) return json({ error: 'Transcription is not configured' }, 503)
  const { recordingId, language } = body as { recordingId?: string; language?: string }
  if (!recordingId) return json({ error: 'recordingId is required' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization') ?? ''

  // User-scoped client: RLS proves the caller owns the recording.
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: recording, error: recError } = await userClient
    .from('recordings')
    .select('storage_path, mime_type')
    .eq('id', recordingId)
    .maybeSingle()
  if (recError) return json({ error: recError.message }, 500)
  if (!recording) return json({ error: 'Recording not found' }, 404)

  // Service client for storage (bucket is private).
  const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: blob, error: dlError } = await serviceClient.storage
    .from('recordings')
    .download(recording.storage_path)
  if (dlError || !blob) return json({ error: `Could not download audio: ${dlError?.message}` }, 500)
  if (blob.size > MAX_BYTES) {
    return json({ error: 'Recording is too large to transcribe (25MB limit)' }, 413)
  }

  const ext = recording.mime_type?.includes('mp4') ? 'm4a' : 'webm'
  const form = new FormData()
  form.append('file', blob, `recording.${ext}`)
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json')
  // Whisper wants an ISO-639-1 code; the app stores free-text language names,
  // so only pass it through when it already looks like a code — otherwise
  // Whisper's auto-detection handles it.
  if (language && /^[a-z]{2}$/i.test(language.trim())) {
    form.append('language', language.trim().toLowerCase())
  }

  const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  })
  if (!openaiRes.ok) {
    const detail = await openaiRes.text()
    return json({ error: `OpenAI transcription failed (${openaiRes.status}): ${detail}` }, 502)
  }

  const result = (await openaiRes.json()) as {
    text: string
    segments?: { text: string; start: number; end: number }[]
  }

  return json({
    text: result.text,
    segments: (result.segments ?? []).map((s) => ({
      text: s.text,
      startSec: s.start,
      endSec: s.end,
    })),
  })
})
