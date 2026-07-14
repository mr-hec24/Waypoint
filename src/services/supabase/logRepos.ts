import { requireSupabase } from '../../lib/supabaseClient'
import type { ActivityLog, Course, SleepLog } from '../../domain/entities'
import type { ActivityLogRepo, CourseRepo, SleepLogRepo } from '../repositories'
import { baseFromRow, msToIso, throwIfError, tsToMs, type BaseRow } from './mapping'

// ---------- activity logs ----------

interface ActivityLogRow extends BaseRow {
  kind: ActivityLog['kind']
  pillar: ActivityLog['pillar']
  language: string
  session_id: string | null
  occurred_at: string
  duration_minutes: number
  notes: string
  title: string | null
  details: Record<string, unknown>
}

function rowToActivityLog(row: ActivityLogRow): ActivityLog {
  return {
    ...baseFromRow(row),
    kind: row.kind,
    pillar: row.pillar,
    language: row.language ?? '',
    sessionId: row.session_id,
    occurredAt: tsToMs(row.occurred_at),
    durationMinutes: row.duration_minutes,
    notes: row.notes,
    title: row.title ?? null,
    details: row.details,
  } as ActivityLog
}

export const activityLogRepo: ActivityLogRepo = {
  async get(userId, id) {
    const { data, error } = await requireSupabase()
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle()
    throwIfError(error)
    return data ? rowToActivityLog(data as ActivityLogRow) : null
  },

  async bySession(userId, sessionId) {
    const { data, error } = await requireSupabase()
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
    throwIfError(error)
    return (data as ActivityLogRow[]).map(rowToActivityLog)
  },

  async byDateRange(userId, language, fromMs, toMs) {
    const { data, error } = await requireSupabase()
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .gte('occurred_at', msToIso(fromMs))
      .lte('occurred_at', msToIso(toMs))
      .order('occurred_at', { ascending: false })
    throwIfError(error)
    return (data as ActivityLogRow[]).map(rowToActivityLog)
  },

  async put(log) {
    const { error } = await requireSupabase().from('activity_logs').upsert({
      id: log.id,
      user_id: log.userId,
      kind: log.kind,
      pillar: log.pillar,
      language: log.language,
      session_id: log.sessionId,
      occurred_at: msToIso(log.occurredAt),
      duration_minutes: log.durationMinutes,
      notes: log.notes,
      title: log.title,
      details: log.details,
    })
    throwIfError(error)
  },

  async setTitle(userId, ids, title) {
    if (ids.length === 0) return
    const { error } = await requireSupabase()
      .from('activity_logs')
      .update({ title })
      .eq('user_id', userId)
      .in('id', ids)
    throwIfError(error)
  },

  async remove(id) {
    const { error } = await requireSupabase().from('activity_logs').delete().eq('id', id)
    throwIfError(error)
  },
}

// ---------- sleep logs ----------

interface SleepLogRow extends BaseRow {
  date: string
  bed_time: string
  wake_time: string
  quality: SleepLog['quality']
  notes: string
}

function rowToSleepLog(row: SleepLogRow): SleepLog {
  return {
    ...baseFromRow(row),
    date: row.date,
    bedTime: row.bed_time,
    wakeTime: row.wake_time,
    quality: row.quality,
    notes: row.notes,
  }
}

export const sleepLogRepo: SleepLogRepo = {
  async byDate(userId, date) {
    const { data, error } = await requireSupabase()
      .from('sleep_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()
    throwIfError(error)
    return data ? rowToSleepLog(data as SleepLogRow) : null
  },

  async listRecent(userId, limit) {
    const { data, error } = await requireSupabase()
      .from('sleep_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit)
    throwIfError(error)
    return (data as SleepLogRow[]).map(rowToSleepLog)
  },

  async put(log) {
    const { error } = await requireSupabase().from('sleep_logs').upsert(
      {
        id: log.id,
        user_id: log.userId,
        date: log.date,
        bed_time: log.bedTime,
        wake_time: log.wakeTime,
        quality: log.quality,
        notes: log.notes,
      },
      { onConflict: 'user_id,date' },
    )
    throwIfError(error)
  },
}

// ---------- courses ----------

interface CourseRow extends BaseRow {
  language: string
  name: string
  platform: string
  total_units: number | null
  completed_units: number
  unit_label: string
}

function rowToCourse(row: CourseRow): Course {
  return {
    ...baseFromRow(row),
    language: row.language ?? '',
    name: row.name,
    platform: row.platform,
    totalUnits: row.total_units,
    completedUnits: row.completed_units,
    unitLabel: row.unit_label,
  }
}

export const courseRepo: CourseRepo = {
  async listAll(userId, language) {
    const { data, error } = await requireSupabase()
      .from('courses')
      .select('*')
      .eq('user_id', userId)
      .eq('language', language)
      .order('created_at')
    throwIfError(error)
    return (data as CourseRow[]).map(rowToCourse)
  },

  async put(course) {
    const { error } = await requireSupabase().from('courses').upsert({
      id: course.id,
      user_id: course.userId,
      language: course.language,
      name: course.name,
      platform: course.platform,
      total_units: course.totalUnits,
      completed_units: course.completedUnits,
      unit_label: course.unitLabel,
    })
    throwIfError(error)
  },

  async remove(id) {
    const { error } = await requireSupabase().from('courses').delete().eq('id', id)
    throwIfError(error)
  },
}
