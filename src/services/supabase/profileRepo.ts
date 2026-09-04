import { requireSupabase } from '../../lib/supabaseClient'
import type { Profile } from '../../domain/entities'
import { DEFAULT_SETTINGS, EMPTY_ONBOARDING } from '../../domain/entities'
import type { ProfileRepo } from '../repositories'
import { throwIfError, tsToMs } from './mapping'

interface ProfileRow {
  id: string
  display_name: string
  native_language: Profile['nativeLanguage'] | null
  languages: Profile['languages'] | null
  active_language: string
  intention_resurface_every_n_sessions: number
  settings: Profile['settings'] | null
  onboarding: Partial<Profile['onboarding']> | null
  created_at: string
  updated_at: string
}

function rowToProfile(row: ProfileRow): Profile {
  const journeys = row.languages ?? []
  return {
    id: row.id,
    userId: row.id, // profiles PK is the auth user id
    createdAt: tsToMs(row.created_at),
    updatedAt: tsToMs(row.updated_at),
    displayName: row.display_name,
    nativeLanguage: row.native_language ?? { name: '', code: '' },
    languages: journeys,
    activeLanguage: row.active_language ?? '',
    intentionResurfaceEveryNSessions: row.intention_resurface_every_n_sessions,
    settings: { ...DEFAULT_SETTINGS, ...row.settings },
    // Default when the 0008 column isn't present yet (deploy can precede the dashboard
    // migration). Treat a pre-0008 profile that already has a journey as onboarded so
    // existing users aren't bounced back through the flow.
    onboarding: {
      ...EMPTY_ONBOARDING,
      completedAt: journeys.length > 0 ? tsToMs(row.created_at) : null,
      ...row.onboarding,
    },
  }
}

export const profileRepo: ProfileRepo = {
  async get(userId) {
    const { data, error } = await requireSupabase()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    throwIfError(error)
    return data ? rowToProfile(data as ProfileRow) : null
  },

  async update(userId, patch) {
    const row: Record<string, unknown> = {}
    if (patch.displayName !== undefined) row.display_name = patch.displayName
    if (patch.nativeLanguage !== undefined) row.native_language = patch.nativeLanguage
    if (patch.onboarding !== undefined) row.onboarding = patch.onboarding
    if (patch.languages !== undefined) row.languages = patch.languages
    if (patch.activeLanguage !== undefined) row.active_language = patch.activeLanguage
    if (patch.intentionResurfaceEveryNSessions !== undefined)
      row.intention_resurface_every_n_sessions = patch.intentionResurfaceEveryNSessions
    if (patch.settings !== undefined) row.settings = patch.settings
    const { error } = await requireSupabase().from('profiles').update(row).eq('id', userId)
    throwIfError(error)
  },
}
