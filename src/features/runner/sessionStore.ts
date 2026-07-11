// Zustand store for the running session. Every reducer transition is
// mirrored to localStorage (instant, offline-safe) and pushed to Supabase
// (cross-device). Timestamps in the machine make both refresh-proof.

import { create } from 'zustand'
import type { Session } from '../../domain/entities'
import { reduce, type SessionEvent } from '../../domain/session/machine'
import { sessionRepo } from '../../services/supabase/sessionRepo'

const MIRROR_KEY = 'roadtrip.activeSession'

function readMirror(): Session | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function writeMirror(session: Session | null) {
  try {
    if (session && ['planned', 'active', 'break'].includes(session.status)) {
      localStorage.setItem(MIRROR_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(MIRROR_KEY)
    }
  } catch {
    // localStorage unavailable (private mode quota etc.) — Supabase still has it
  }
}

interface SessionStore {
  session: Session | null
  /** Load a session into the store (from planner, mirror, or server). */
  load: (session: Session) => void
  dispatch: (event: SessionEvent) => void
  clear: () => void
  /** Resolve the session for an id: store → localStorage mirror → server, newest wins. */
  hydrate: (id: string) => Promise<Session | null>
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,

  load: (session) => {
    set({ session })
    writeMirror(session)
  },

  dispatch: (event) => {
    const prev = get().session
    if (!prev) return
    const next = reduce(prev, event)
    if (next === prev) return
    set({ session: next })
    writeMirror(next)
    sessionRepo.put(next).catch(() => {
      // Offline blip: the mirror holds the truth; the next transition retries.
    })
  },

  clear: () => {
    set({ session: null })
    writeMirror(null)
  },

  hydrate: async (id) => {
    const inStore = get().session
    if (inStore?.id === id) return inStore

    const mirror = readMirror()
    let server: Session | null = null
    try {
      server = await sessionRepo.get(id)
    } catch {
      // offline — fall back to the mirror alone
    }

    const candidates = [mirror, server].filter((s): s is Session => s?.id === id)
    if (candidates.length === 0) return null
    const winner = candidates.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b))
    get().load(winner)
    return winner
  },
}))
