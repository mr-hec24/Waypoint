import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

/** Null when env vars are missing — the app shows a setup notice instead of crashing. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null

/** For code paths that only run behind the auth guard, where config is guaranteed. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured (see .env.example)')
  return supabase
}
