import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useProfile, useUpdateProfile } from '../../services/queries/profile'

/** Start a new journey: a second (or third…) language with its own destination. */
export function AddLanguageScreen() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [language, setLanguage] = useState('')
  const [statement, setStatement] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    const name = language.trim()
    if (profile.languages.some((j) => j.language.toLowerCase() === name.toLowerCase())) {
      setError(`You already have a ${name} journey — switch to it from Today.`)
      return
    }
    const now = Date.now()
    await updateProfile.mutateAsync({
      languages: [
        ...profile.languages,
        { language: name, intention: { statement: statement.trim(), setAt: now, history: [] }, startedAt: now },
      ],
      activeLanguage: name, // a new journey starts right away
    })
    navigate('/', { replace: true })
  }

  const inputClass =
    'rounded-lg border border-stone-300 bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-700/40'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper p-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-4">
        <div className="mb-2">
          <Link to="/" className="text-xs text-stone-500 hover:text-stone-700">
            ← Today
          </Link>
          <h1 className="font-display text-[27px] font-bold text-primary-900">A new road</h1>
          <p className="text-sm text-stone-600">
            Every language is its own roadtrip — with its own destination.
          </p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Which language?
          <input
            required
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={inputClass}
            placeholder="e.g. Japanese"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Why are you learning it?
          <span className="block rounded-[10px] border-2 border-primary-700 bg-card p-[5px]">
            <span className="block rounded-md border border-primary-700/45 p-2">
              <span className="block pt-1 pb-2 text-center text-[10.5px] font-extrabold tracking-[.24em] text-primary-700 uppercase">
                ◆ Destination ◆
              </span>
              <textarea
                required
                minLength={10}
                rows={4}
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                className="font-display w-full resize-y rounded-md border-none bg-transparent px-2 py-1 text-center text-[15px] italic outline-none placeholder:not-italic placeholder:font-sans placeholder:text-[13px] placeholder:text-[#B0A48C]"
                placeholder="This journey's why — different road, different reason."
              />
            </span>
          </span>
        </label>

        {error && <p className="text-sm text-output-deep">{error}</p>}
        {updateProfile.isError && (
          <p className="text-sm text-output-deep">{(updateProfile.error as Error).message}</p>
        )}

        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="mt-2 rounded-[10px] bg-primary-700 px-5 pt-[14px] pb-[12px] text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          {updateProfile.isPending ? 'Saving…' : 'Start this roadtrip'}
        </button>
      </form>
    </div>
  )
}
