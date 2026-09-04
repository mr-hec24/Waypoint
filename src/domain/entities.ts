// Pure domain types mirroring the Postgres schema (supabase/migrations).
// This module must stay free of React and Supabase imports.

/** Fields shared by every persisted entity. Timestamps are epoch ms on the client. */
export interface BaseEntity {
  id: string // uuid, client-generated
  userId: string
  createdAt: number
  updatedAt: number
}

// ---------- Profile & intention ----------

export interface IntentionEntry {
  statement: string
  setAt: number
}

export interface Intention extends IntentionEntry {
  history: IntentionEntry[]
}

export interface ProfileSettings {
  blockMinutes: number // default 90
  breakMinutes: number // default 20
  newCardsPerDay: number // default 10
}

/** One language = one roadtrip: its own destination (intention) and start date. */
export interface LanguageJourney {
  language: string
  intention: Intention | null
  startedAt: number
}

/**
 * The learner's own language. Unlike the free-text target language, this carries an
 * ISO-639-1 code: Whisper wants one, and Intl.Segmenter wants it as a locale.
 */
export interface NativeLanguage {
  name: string
  code: string // ISO-639-1, or '' when the user picked "Other"
}

/** Progress through the guided first run. Stored as jsonb, so new fields need no migration. */
export interface OnboardingState {
  version: number
  step: number
  completedAt: number | null
  /** True when the learner deferred building their starter vocabulary. */
  corpusSkipped: boolean
  /** Life-domain slugs the learner says they talk about — drives prompts and the balance meter. */
  domains: string[]
}

export const ONBOARDING_VERSION = 1

export const EMPTY_ONBOARDING: OnboardingState = {
  version: ONBOARDING_VERSION,
  step: 0,
  completedAt: null,
  corpusSkipped: false,
  domains: [],
}

export interface Profile extends BaseEntity {
  displayName: string
  nativeLanguage: NativeLanguage // shared across journeys — the driver doesn't change
  languages: LanguageJourney[]
  activeLanguage: string
  intentionResurfaceEveryNSessions: number
  settings: ProfileSettings // shared across journeys — the body is the same driver
  onboarding: OnboardingState
}

/** Has the learner finished the guided first run? Drives the RequireOnboarded gate. */
export function isOnboarded(profile: Profile): boolean {
  return Boolean(profile.onboarding.completedAt) && Boolean(activeJourney(profile)?.intention)
}

/** The journey currently being driven; null until onboarding completes. */
export function activeJourney(profile: Profile): LanguageJourney | null {
  return profile.languages.find((j) => j.language === profile.activeLanguage) ?? null
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  blockMinutes: 90,
  breakMinutes: 20,
  newCardsPerDay: 10,
}

// ---------- Session ----------

export type ActivityKind =
  | 'flashcards'
  | 'course'
  | 'immersion' // Input
  | 'story_speaking'
  | 'writing'
  | 'conversation' // Output

export type Pillar = 'input' | 'output' | 'maintenance'

export const PILLAR_BY_KIND: Record<ActivityKind, Pillar> = {
  flashcards: 'input',
  course: 'input',
  immersion: 'input',
  story_speaking: 'output',
  writing: 'output',
  conversation: 'output',
}

export interface PlannedActivity {
  kind: ActivityKind
  plannedMinutes: number
}

export interface PlannedBlock {
  id: string
  activities: PlannedActivity[]
  plannedMinutes: number // ~90
}

export type SessionStatus = 'planned' | 'active' | 'break' | 'completed' | 'abandoned'

export interface BlockActual {
  blockId: string
  startedAt: number
  endedAt: number | null
  /** Set when the user ended this block's input leg early; output got the rest. */
  inputEndedAt?: number | null
}

export interface SessionRun {
  currentBlockIndex: number
  phase: 'block' | 'break' | null
  phaseStartedAt: number | null // timestamps, never countdowns — refresh-proof
  phaseEndsAt: number | null
  blockActuals: BlockActual[]
  breaksSkipped: number
}

export interface Session extends BaseEntity {
  language: string // which journey this session belongs to
  status: SessionStatus
  plan: { blocks: PlannedBlock[]; breakMinutes: number }
  run: SessionRun
  intentionShown: boolean
}

// ---------- Activity logs ----------

interface ActivityLogBase extends BaseEntity {
  kind: ActivityKind
  pillar: Pillar
  language: string // which journey this activity belongs to
  sessionId: string | null // null = logged outside a session
  occurredAt: number
  durationMinutes: number
  notes: string
  /** User-given name; null = untitled (UI falls back to kind label / prompt). */
  title: string | null
}

export interface FlashcardLog extends ActivityLogBase {
  kind: 'flashcards'
  details: { cardsReviewed: number; cardsCorrect: number }
}
export interface CourseLog extends ActivityLogBase {
  kind: 'course'
  details: { courseId: string; unitLabel: string }
}
export interface ImmersionLog extends ActivityLogBase {
  kind: 'immersion'
  details: { medium: 'video' | 'audio' | 'reading' | 'other'; title: string }
}
export interface StorySpeakingLog extends ActivityLogBase {
  kind: 'story_speaking'
  details: {
    promptText: string
    recordingId: string | null
    /** One sitting's loop on one prompt; absent on legacy logs. */
    attemptGroupId?: string
    /** 1-based take number within the group. */
    attemptNumber?: number
  }
}
export interface WritingLog extends ActivityLogBase {
  kind: 'writing'
  details: { promptText: string; text: string }
}
export interface ConversationLog extends ActivityLogBase {
  kind: 'conversation'
  details: { partnerType: 'tutor' | 'exchange' | 'self' | 'other' }
}

export type ActivityLog =
  | FlashcardLog
  | CourseLog
  | ImmersionLog
  | StorySpeakingLog
  | WritingLog
  | ConversationLog

// ---------- Maintenance ----------

export interface SleepLog extends BaseEntity {
  date: string // YYYY-MM-DD
  bedTime: string // HH:MM
  wakeTime: string // HH:MM
  quality: 1 | 2 | 3 | 4 | 5
  notes: string
}

export interface Course extends BaseEntity {
  language: string // which journey this course belongs to
  name: string
  platform: string
  totalUnits: number | null
  completedUnits: number
  unitLabel: string // "lesson", "chapter", …
}

// ---------- Flashcards / SRS ----------

export type SrsGrade = 0 | 1 | 2 | 3 // again / hard / good / easy

export interface SrsState {
  ease: number // SM-2 EF, starts at 2.5, floor 1.3
  intervalDays: number
  reps: number
  lapses: number
  due: number // epoch ms
  state: 'new' | 'learning' | 'review'
}

export function newSrsState(now: number): SrsState {
  return { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0, due: now, state: 'new' }
}

/** Where a word came from. import is a seam for the future pipeline. */
export type WordSource =
  | { type: 'manual' }
  | { type: 'voice_memo'; recordingId: string; transcriptSpan: [number, number] }
  | { type: 'writing'; logId: string }
  /** Mined from the learner's own native speech — see domain/corpus. */
  | { type: 'corpus' }
  | { type: 'import' }

export interface Word extends BaseEntity {
  deckId: string
  term: string
  reading: string | null
  definition: string
  exampleSentence: string | null
  srs: SrsState
  source: WordSource
  frequencyRank: number | null
  encounterCount: number
}

export interface Deck extends BaseEntity {
  name: string
  language: string
}

// ---------- Immersion library ----------

export type LibraryItemType = 'book' | 'show' | 'movie' | 'podcast' | 'music' | 'article'

/** A saved piece of immersion content for one journey. At most one starred per (userId, language). */
export interface LibraryItem extends BaseEntity {
  language: string // which journey this belongs to
  type: LibraryItemType
  title: string
  url: string | null // optional; source of in-app embed detection
  starred: boolean // the single "focus" item — DB enforces one per (userId, language)
  repetitions: number // how many times gone through — comprehensible input rewards repetition
  lastRepAt: number | null // epoch ms of the most recent pass
}

/** Gentle default target for passes through one piece of content — a finish line, not a cap. */
export const LIBRARY_REP_TARGET = 7

export const LIBRARY_ITEM_TYPES: { type: LibraryItemType; label: string }[] = [
  { type: 'book', label: 'Book' },
  { type: 'show', label: 'Show' },
  { type: 'movie', label: 'Movie' },
  { type: 'podcast', label: 'Podcast' },
  { type: 'music', label: 'Music' },
  { type: 'article', label: 'Article' },
]

export const LIBRARY_TYPE_LABEL: Record<LibraryItemType, string> = {
  book: 'Book',
  show: 'Show',
  movie: 'Movie',
  podcast: 'Podcast',
  music: 'Music',
  article: 'Article',
}

/** Append-only review history — replaying it enables future algorithm migration (e.g. FSRS). */
export interface ReviewLog extends BaseEntity {
  wordId: string
  reviewedAt: number
  grade: SrsGrade
  prevIntervalDays: number
  newIntervalDays: number
  ease: number
}

// ---------- Recordings ----------

export interface Recording extends BaseEntity {
  language: string // which journey this recording belongs to
  mimeType: string
  durationSec: number
  context: 'story_speaking' | 'voice_memo' | 'native_corpus'
  storagePath: string // {userId}/{id}.{ext} in the "recordings" bucket
}

// ---------- Personal corpus (starter vocabulary) ----------

export type CorpusSourceKind = 'recording' | 'upload' | 'transcript'

export type CorpusSourceStatus = 'pending' | 'transcribing' | 'ready' | 'failed'

/**
 * One chunk of the learner's own NATIVE speech. Counting these gives a personal
 * frequency list — the words they actually use — which becomes the starter deck.
 *
 * `speakers` matters because Whisper does no diarization: a two-way recording is
 * one blended transcript, so a 'mixed' source only half-counts toward the learner.
 */
export interface CorpusSource extends BaseEntity {
  language: string // the TARGET-language journey this corpus feeds
  kind: CorpusSourceKind
  label: string // prompt title, or the uploaded filename
  domain: string // life-domain slug; '' when freeform
  promptId: string | null
  recordingId: string | null // set for kind 'recording' | 'upload'; null once audio is discarded
  speakers: 'solo' | 'mixed'
  status: CorpusSourceStatus
  error: string | null
  transcript: string // editable — the learner can trim the other speaker
  tokenCount: number // denormalized so the source list renders without recounting
  durationSec: number
}

/** Own-speech tokens where the personal core is captured and the list is usable. */
export const CORPUS_CORE_TOKENS = 2000

/** Own-speech tokens for the recommended seed — roughly 250–350 entries. */
export const CORPUS_SEED_TOKENS = 4500

/** Tokens in one domain before its balance dot fills. */
export const CORPUS_DOMAIN_TOKENS = 400

/** The long-run goal the list grows into over weeks, not a signup requirement. */
export const CORPUS_LIST_TARGET = 1000

// ---------- Story review (three-column method) ----------

export interface StoryReviewRow {
  id: string
  transcript: string // column 1 — what was actually said
  intention: string // column 2 — what the learner meant to say
  translation: string // column 3 — the correct/natural phrasing
  note: string // short explanation of the gap
  wordIds: string[] // flashcards created from this row
  span: [number, number] | null // startSec/endSec in the recording
}

export interface StoryReview extends BaseEntity {
  /** Exactly one of the two sources is set (DB check constraint enforces it). */
  recordingId: string | null
  writingLogId: string | null
  status: 'draft' | 'reviewed'
  rows: StoryReviewRow[]
}
