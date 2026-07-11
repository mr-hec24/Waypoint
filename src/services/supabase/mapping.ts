// Helpers shared by the Supabase repository implementations.

export function tsToMs(ts: string | null): number {
  return ts ? Date.parse(ts) : 0
}

export function msToIso(ms: number): string {
  return new Date(ms).toISOString()
}

export interface BaseRow {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

export function baseFromRow(row: BaseRow) {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: tsToMs(row.created_at),
    updatedAt: tsToMs(row.updated_at),
  }
}

export function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}
