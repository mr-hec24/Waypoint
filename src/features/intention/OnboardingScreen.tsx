import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useUpdateProfile } from '../../services/queries/profile'

export function OnboardingScreen() {
  const navigate = useNavigate()
  const updateProfile = useUpdateProfile()
  const [displayName, setDisplayName] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('')
  const [statement, setStatement] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const now = Date.now()
    const language = targetLanguage.trim()
    await updateProfile.mutateAsync({
      displayName: displayName.trim(),
      languages: [
        {
          language,
          intention: { statement: statement.trim(), setAt: now, history: [] },
          startedAt: now,
        },
      ],
      activeLanguage: language,
    })
    navigate('/', { replace: true })
  }

  const inputClass =
    'rounded-lg border border-stone-300 bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary-500'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-4">
        <div className="mb-2">
          <h1 className="font-display text-[27px] font-bold text-primary-900">Welcome</h1>
          <p className="text-sm text-stone-600">
            Before the roadtrip starts, set your destination.
          </p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          What should we call you?
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
            placeholder="Your name"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Which language are you learning?
          <input
            required
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            className={inputClass}
            placeholder="e.g. Spanish"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Why are you learning it?
          {/* The intention is written inside its own plaque frame — it's the destination. */}
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
                placeholder="Your personal why — this will be shown to you when motivation dips."
              />
            </span>
          </span>
          <span className="text-xs font-normal text-stone-500">
            Be honest and specific. The app resurfaces this at session starts and during breaks.
          </span>
        </label>

        {updateProfile.isError && (
          <p className="text-sm text-output-deep">{(updateProfile.error as Error).message}</p>
        )}

        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="mt-2 rounded-[10px] bg-primary-700 px-5 pt-[14px] pb-[12px] text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          {updateProfile.isPending ? 'Saving…' : 'Start the roadtrip'}
        </button>
      </form>
    </div>
  )
}
