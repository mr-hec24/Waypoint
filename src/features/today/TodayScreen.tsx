import { Link } from 'react-router'
import { useProfile, useUpdateProfile } from '../../services/queries/profile'
import { useActiveSession } from '../../services/queries/sessions'
import { useStarredLibraryItem } from '../../services/queries/library'
import { DestinationPlaque } from '../../components/DestinationPlaque'
import { RepProgress } from '../library/RepProgress'
import { repMessage } from '../library/reps'
import { activeJourney } from '../../domain/entities'
import {
  localDateString,
  todayBounds,
  useActivityLogs,
  useSleepLogs,
} from '../../services/queries/logs'
import type { Pillar } from '../../domain/entities'

const PILLARS: { pillar: Pillar; label: string; text: string; border: string }[] = [
  { pillar: 'input', label: 'Input', text: 'text-input', border: 'border-t-input' },
  { pillar: 'output', label: 'Output', text: 'text-output', border: 'border-t-output' },
]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Monday 00:00 of the current week (local time). */
function weekStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Mon = 0
  d.setDate(d.getDate() - day)
  return d
}

export function TodayScreen() {
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const journey = profile ? activeJourney(profile) : null
  const { data: activeSession } = useActiveSession()
  const { data: focusItem } = useStarredLibraryItem()
  const bounds = todayBounds()
  const { data: todayLogs } = useActivityLogs(bounds.from, bounds.to)
  const { data: sleepLogs } = useSleepLogs(1)

  const monday = weekStart()
  const weekEnd = monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1
  const { data: weekLogs } = useActivityLogs(monday.getTime(), weekEnd)

  const minutesByPillar = (pillar: Pillar) =>
    todayLogs?.filter((l) => l.pillar === pillar).reduce((s, l) => s + l.durationMinutes, 0) ?? 0
  const sleepLoggedToday = sleepLogs?.[0]?.date === localDateString()

  const todayIndex = (new Date().getDay() + 6) % 7
  const daysWithWork = new Set(
    weekLogs?.map((l) => Math.floor((l.occurredAt - monday.getTime()) / 86400000)) ?? [],
  )
  const dayOnRoad = journey
    ? Math.max(1, Math.floor((Date.now() - journey.startedAt) / 86400000) + 1)
    : null

  return (
    <div>
      <h2 className="font-display text-[27px] font-bold">
        {profile?.displayName ? `Hi, ${profile.displayName}` : 'Today'}
      </h2>
      <p className="text-[13px] text-stone-600">
        {journey
          ? `Your ${journey.language} roadtrip${dayOnRoad ? ` · day ${dayOnRoad} on the road` : ''}`
          : 'One session at a time.'}
      </p>

      {/* Journey switcher — one chip per language, plus the on-ramp to a new one */}
      {profile && profile.languages.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {profile.languages.map((j) => {
            const active = j.language === profile.activeLanguage
            return (
              <button
                key={j.language}
                disabled={active || updateProfile.isPending}
                onClick={() => updateProfile.mutate({ activeLanguage: j.language })}
                className={`rounded-full px-3.5 pt-[6px] pb-[4px] text-[11px] font-extrabold tracking-[.08em] uppercase transition-colors ${
                  active
                    ? 'bg-primary-700 text-[#F7F2E8]'
                    : 'border border-stone-300 bg-card text-stone-600 hover:border-primary-700 hover:text-primary-700'
                }`}
              >
                {j.language}
              </button>
            )
          })}
          <Link
            to="/languages/new"
            className="rounded-full border border-dashed border-stone-300 px-3.5 pt-[6px] pb-[4px] text-[11px] font-extrabold tracking-[.08em] text-stone-500 uppercase hover:border-primary-700 hover:text-primary-700"
          >
            + New language
          </Link>
        </div>
      )}

      {journey?.intention && (
        <div className="mt-4">
          <DestinationPlaque statement={journey.intention.statement} />
        </div>
      )}

      {focusItem && (
        <Link
          to="/library"
          className="mt-4 block rounded-xl border border-stone-200 bg-card px-4 py-3 hover:border-primary-700"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10.5px] font-extrabold tracking-[.18em] text-stone-500 uppercase">
                ★ Current focus
              </p>
              <p className="truncate text-sm font-bold">{focusItem.title}</p>
            </div>
            <RepProgress reps={focusItem.repetitions} />
          </div>
          <p className="mt-1.5 text-xs text-stone-500 italic">{repMessage(focusItem.repetitions)}</p>
        </Link>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {PILLARS.map(({ pillar, label, text, border }) => (
          <div
            key={pillar}
            className={`rounded-lg border border-stone-200 border-t-[3px] bg-card px-3 py-3 text-center ${border}`}
          >
            <p className={`text-[10.5px] font-extrabold tracking-[.18em] uppercase ${text}`}>
              {label}
            </p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums">{minutesByPillar(pillar)}</p>
            <p className="text-[10.5px] text-stone-500">min today</p>
          </div>
        ))}
      </div>

      {!sleepLoggedToday && (
        <Link
          to="/logs"
          className="mt-3 block rounded-lg border border-rest-border bg-rest-bg px-3.5 py-3 text-[13px] text-rest-text hover:brightness-[.98]"
        >
          No sleep logged yet — rest is fuel for the roadtrip.
        </Link>
      )}

      {/* This week's route */}
      <div className="mt-6">
        <p className="mb-3 text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
          This week&apos;s route
        </p>
        <div className="relative px-1">
          <div className="absolute top-[7px] right-2 left-2 border-t-2 border-dashed border-[#CFC2A6]" />
          <div className="relative flex justify-between">
            {DAY_LABELS.map((label, i) => {
              const isToday = i === todayIndex
              const done = daysWithWork.has(i)
              const missed = i < todayIndex && !done
              return (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`h-4 w-4 rounded-full ${
                      isToday
                        ? 'border-2 border-output bg-paper'
                        : done
                          ? 'bg-primary-700'
                          : missed
                            ? 'border-2 border-stone-300 bg-stone-100'
                            : 'bg-stone-100'
                    }`}
                  />
                  <span
                    className={`text-[9.5px] font-extrabold tracking-[.08em] uppercase ${
                      isToday ? 'text-output' : done ? 'text-stone-600' : 'text-stone-400'
                    }`}
                  >
                    {isToday ? 'Today' : label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {activeSession ? (
          <Link
            to={`/session/${activeSession.id}`}
            className="rounded-[10px] bg-output px-5 pt-[16px] pb-[14px] text-center text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-output-deep"
          >
            Resume session in progress
          </Link>
        ) : (
          <Link
            to="/plan"
            className="rounded-[10px] bg-primary-700 px-5 pt-[16px] pb-[14px] text-center text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800"
          >
            Plan a session
          </Link>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/review"
            className="rounded-[10px] border border-stone-300 bg-card px-5 pt-[13px] pb-[11px] text-center text-sm font-bold text-stone-700 transition-colors hover:bg-stone-100"
          >
            Review cards
          </Link>
          <Link
            to="/decks"
            className="rounded-[10px] border border-stone-300 bg-card px-5 pt-[13px] pb-[11px] text-center text-sm font-bold text-stone-700 transition-colors hover:bg-stone-100"
          >
            Manage decks
          </Link>
        </div>
      </div>
    </div>
  )
}
