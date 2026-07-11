import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useProfile, useUpdateProfile } from '../../services/queries/profile'
import { activeJourney } from '../../domain/entities'
import { exportAllData } from './exportData'

const inputClass =
  'rounded-lg border border-stone-300 bg-card px-3 py-2 text-sm outline-none focus:border-primary-500'

export function SettingsScreen() {
  const { session, userId, signOut } = useAuth()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const [blockMinutes, setBlockMinutes] = useState(90)
  const [breakMinutes, setBreakMinutes] = useState(20)
  const [newCardsPerDay, setNewCardsPerDay] = useState(10)
  const [statement, setStatement] = useState('')
  const [exporting, setExporting] = useState(false)

  const journey = profile ? activeJourney(profile) : null

  useEffect(() => {
    if (!profile) return
    setBlockMinutes(profile.settings.blockMinutes)
    setBreakMinutes(profile.settings.breakMinutes)
    setNewCardsPerDay(profile.settings.newCardsPerDay)
    setStatement((profile ? activeJourney(profile) : null)?.intention?.statement ?? '')
  }, [profile])

  function saveSettings(e: FormEvent) {
    e.preventDefault()
    updateProfile.mutate({ settings: { blockMinutes, breakMinutes, newCardsPerDay } })
  }

  function saveIntention(e: FormEvent) {
    e.preventDefault()
    if (!profile || !journey) return
    const prev = journey.intention
    updateProfile.mutate({
      languages: profile.languages.map((j) =>
        j.language === journey.language
          ? {
              ...j,
              intention: {
                statement: statement.trim(),
                setAt: Date.now(),
                history: prev
                  ? [...prev.history, { statement: prev.statement, setAt: prev.setAt }]
                  : [],
              },
            }
          : j,
      ),
    })
  }

  async function handleExport() {
    if (!userId) return
    setExporting(true)
    try {
      await exportAllData(userId)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-[27px] font-bold">Settings</h2>

      <form
        onSubmit={saveSettings}
        className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-card p-4"
      >
        <p className="text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">Session</p>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs text-stone-500">
            Block (min)
            <input
              type="number"
              min={15}
              max={120}
              value={blockMinutes}
              onChange={(e) => setBlockMinutes(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-stone-500">
            Break (min)
            <input
              type="number"
              min={5}
              max={60}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-stone-500">
            New cards/day
            <input
              type="number"
              min={0}
              max={100}
              value={newCardsPerDay}
              onChange={(e) => setNewCardsPerDay(Number(e.target.value))}
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="self-start rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-[#F7F2E8] hover:bg-primary-800 disabled:opacity-50"
        >
          Save
        </button>
      </form>

      <form
        onSubmit={saveIntention}
        className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-card p-4"
      >
        <p className="text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
          Your &quot;why&quot;{journey ? ` — ${journey.language}` : ''}
        </p>
        {profile && profile.languages.length > 1 && (
          <p className="text-xs text-stone-500">
            Each language has its own destination. Switch journeys from Today to edit another.
          </p>
        )}
        <div className="rounded-[10px] border-2 border-primary-700 bg-card p-[5px]">
          <div className="rounded-md border border-primary-700/45 p-2">
            <p className="pt-1 pb-2 text-center text-[10.5px] font-extrabold tracking-[.24em] text-primary-700 uppercase">
              ◆ Destination ◆
            </p>
            <textarea
              rows={3}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              className="font-display w-full resize-y rounded-md border-none bg-transparent px-2 py-1 text-center text-[15px] italic outline-none"
            />
          </div>
        </div>
        {journey?.intention && journey.intention.history.length > 0 && (
          <p className="text-xs text-stone-400">
            {journey.intention.history.length} previous version
            {journey.intention.history.length > 1 ? 's' : ''} kept in history.
          </p>
        )}
        <button
          type="submit"
          disabled={updateProfile.isPending || !statement.trim()}
          className="self-start rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-[#F7F2E8] hover:bg-primary-800 disabled:opacity-50"
        >
          Update intention
        </button>
      </form>

      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-card p-4">
        <p className="text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
          Languages
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {profile?.languages.map((j) => (
            <span
              key={j.language}
              className={`rounded-full px-3 pt-[5px] pb-[3px] text-[11px] font-extrabold tracking-[.08em] uppercase ${
                j.language === profile.activeLanguage
                  ? 'bg-primary-700 text-[#F7F2E8]'
                  : 'border border-stone-300 text-stone-600'
              }`}
            >
              {j.language}
            </span>
          ))}
        </div>
        <Link
          to="/languages/new"
          className="self-start rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          + Add another language
        </Link>
        <p className="text-xs text-stone-400">
          Switch the active journey from the chips on the Today screen.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-card p-4">
        <p className="text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">Data</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="self-start rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export all data (JSON)'}
        </button>
        <p className="text-xs text-stone-400">
          Everything except audio files: profile, sessions, decks, words, review history, logs.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-card p-4">
        <p className="text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">Account</p>
        <p className="text-sm text-stone-600">{session?.user.email}</p>
        <button
          onClick={() => void signOut()}
          className="self-start rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
