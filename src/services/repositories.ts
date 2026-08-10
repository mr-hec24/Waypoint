// Repository interfaces — features depend on these, never on supabase-js directly.
// Implementations live in src/services/supabase/.

import type {
  ActivityKind,
  ActivityLog,
  CorpusSource,
  Course,
  Deck,
  LibraryItem,
  Profile,
  Recording,
  ReviewLog,
  Session,
  SleepLog,
  StoryReview,
  Word,
} from '../domain/entities'

export interface ProfileRepo {
  get(userId: string): Promise<Profile | null>
  update(
    userId: string,
    patch: Partial<
      Pick<
        Profile,
        | 'displayName'
        | 'nativeLanguage'
        | 'languages'
        | 'activeLanguage'
        | 'intentionResurfaceEveryNSessions'
        | 'settings'
        | 'onboarding'
      >
    >,
  ): Promise<void>
}

export interface CorpusRepo {
  listAll(userId: string, language: string): Promise<CorpusSource[]>
  put(source: CorpusSource): Promise<void>
  remove(id: string): Promise<void>
}

export interface DeckRepo {
  listAll(userId: string, language?: string): Promise<Deck[]>
  put(deck: Deck): Promise<void>
  remove(id: string): Promise<void>
}

export interface LibraryRepo {
  listAll(userId: string, language?: string): Promise<LibraryItem[]>
  put(item: LibraryItem): Promise<void>
  remove(id: string): Promise<void>
  /** Stars exactly one item: clears any existing star for (userId, language), then stars id. */
  setStarred(userId: string, language: string, id: string): Promise<void>
}

export interface WordRepo {
  /** deckId narrows to one deck; otherwise language narrows across decks. */
  listAll(userId: string, opts?: { deckId?: string; language?: string }): Promise<Word[]>
  listByDeck(userId: string, deckId: string): Promise<Word[]>
  dueForReview(userId: string, language: string, now: number, limit: number): Promise<Word[]>
  newCards(userId: string, language: string, limit: number): Promise<Word[]>
  put(word: Word): Promise<void>
  remove(id: string): Promise<void>
}

export interface ReviewLogRepo {
  append(log: ReviewLog): Promise<void>
}

export interface SessionRepo {
  get(id: string): Promise<Session | null>
  getActive(userId: string, language: string): Promise<Session | null>
  put(session: Session): Promise<void>
  listRecent(userId: string, limit: number): Promise<Session[]>
}

export interface ActivityLogRepo {
  get(userId: string, id: string): Promise<ActivityLog | null>
  byDateRange(
    userId: string,
    language: string,
    fromMs: number,
    toMs: number,
  ): Promise<ActivityLog[]>
  bySession(userId: string, sessionId: string): Promise<ActivityLog[]>
  /** Full history of one activity kind for a journey, newest first. */
  byKind(userId: string, language: string, kind: ActivityKind): Promise<ActivityLog[]>
  put(log: ActivityLog): Promise<void>
  /** Batch title update — one id for a single log, all attempt ids for a group. */
  setTitle(userId: string, ids: string[], title: string | null): Promise<void>
  remove(id: string): Promise<void>
}

export interface SleepLogRepo {
  byDate(userId: string, date: string): Promise<SleepLog | null>
  listRecent(userId: string, limit: number): Promise<SleepLog[]>
  put(log: SleepLog): Promise<void>
}

export interface CourseRepo {
  listAll(userId: string, language: string): Promise<Course[]>
  put(course: Course): Promise<void>
  remove(id: string): Promise<void>
}

export interface StoryReviewRepo {
  getByRecording(userId: string, recordingId: string): Promise<StoryReview | null>
  getByWritingLog(userId: string, writingLogId: string): Promise<StoryReview | null>
  listAll(userId: string): Promise<StoryReview[]>
  put(review: StoryReview): Promise<void>
}

export interface RecordingRepo {
  get(userId: string, id: string): Promise<Recording | null>
  list(userId: string, language?: string): Promise<Recording[]>
  /** Uploads the blob to storage and inserts the metadata row. */
  create(recording: Recording, blob: Blob): Promise<void>
  /** Signed URL for playback of a private recording. */
  getPlaybackUrl(recording: Recording): Promise<string>
  remove(recording: Recording): Promise<void>
}
