import { requireSupabase } from '../../lib/supabaseClient'
import type { Session } from '../../domain/entities'
import type { SessionRepo } from '../repositories'
import { baseFromRow, throwIfError, type BaseRow } from './mapping'

interface SessionRow extends BaseRow {
  language: string
  status: Session['status']
  plan: Session['plan']
  run: Session['run']
  intention_shown: boolean
}

function rowToSession(row: SessionRow): Session {
  return {
    ...baseFromRow(row),
    language: row.language ?? '',
    status: row.status,
    plan: row.plan,
    run: row.run,
    intentionShown: row.intention_shown,
  }
}

export const sessionRepo: SessionRepo = {
  async get(id) {
    const { data, error } = await requireSupabase()
      .from('sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    throwIfError(error)
    return data ? rowToSession(data as SessionRow) : null
  },

  async getActive(userId, language) {
    const { data, error } = await requireSupabase()
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .in('status', ['planned', 'active', 'break'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    throwIfError(error)
    return data ? rowToSession(data as SessionRow) : null
  },

  async put(session) {
    const { error } = await requireSupabase().from('sessions').upsert({
      id: session.id,
      user_id: session.userId,
      language: session.language,
      status: session.status,
      plan: session.plan,
      run: session.run,
      intention_shown: session.intentionShown,
    })
    throwIfError(error)
  },

  async listRecent(userId, limit) {
    const { data, error } = await requireSupabase()
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    throwIfError(error)
    return (data as SessionRow[]).map(rowToSession)
  },
}
