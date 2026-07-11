// Voice → text via the "transcribe" Supabase Edge Function (OpenAI Whisper
// server-side; the API key never reaches the client). isAvailable() pings the
// function, which reports whether the secret is configured — when it isn't
// (or the function isn't deployed), the UI hides transcribe affordances and
// the workbench stays fully manual.

import { supabase } from '../lib/supabaseClient'
import type { Recording } from '../domain/entities'

export interface TranscriptSegment {
  text: string
  startSec: number
  endSec: number
}

export interface TranscriptionService {
  isAvailable(): Promise<boolean>
  transcribe(
    recording: Recording,
    language: string,
  ): Promise<{ text: string; segments: TranscriptSegment[] }>
}

class EdgeTranscription implements TranscriptionService {
  private availability: Promise<boolean> | null = null

  isAvailable(): Promise<boolean> {
    this.availability ??= (async () => {
      if (!supabase) return false
      try {
        const { data, error } = await supabase.functions.invoke('transcribe', {
          body: { ping: true },
        })
        if (error) return false
        return Boolean((data as { available?: boolean })?.available)
      } catch {
        return false
      }
    })()
    return this.availability
  }

  async transcribe(recording: Recording, language: string) {
    if (!supabase) throw new Error('Supabase is not configured')
    const { data, error } = await supabase.functions.invoke('transcribe', {
      body: { recordingId: recording.id, language },
    })
    if (error) throw new Error(`Transcription failed: ${error.message}`)
    const result = data as { text: string; segments: TranscriptSegment[]; error?: string }
    if (result.error) throw new Error(result.error)
    return { text: result.text, segments: result.segments }
  }
}

export const transcription: TranscriptionService = new EdgeTranscription()
