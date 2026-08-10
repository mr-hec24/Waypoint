import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useProfile, useUpdateProfile } from '../../services/queries/profile'
import { activeJourney, ONBOARDING_VERSION, type NativeLanguage } from '../../domain/entities'
import { LIFE_DOMAINS } from '../corpus/domains'
import { VocabBuildScreen } from '../corpus/VocabBuildScreen'
import { MethodPrimer } from '../method/MethodPrimer'
import { NATIVE_LANGUAGES, OTHER_NATIVE_LANGUAGE } from './nativeLanguages'

// A phase union with conditional rendering, matching how the runner and the story-speaking
// loop already work — no stepper library, nothing new to learn.
const STEPS = [
  'welcome',
  'name',
  'languages',
  'destination',
  'domains',
  'corpus',
  'method',
] as const
type Step = (typeof STEPS)[number]

const inputClass =
  'rounded-lg border border-stone-300 bg-card px-3.5 py-2.5 text-sm outline-none focus:border-primary-500'

const primaryButton =
  'rounded-[10px] bg-primary-700 px-5 pt-[14px] pb-[12px] text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800 disabled:opacity-50'

export function OnboardingScreen() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const [step, setStep] = useState<Step>('welcome')
  const [displayName, setDisplayName] = useState('')
  const [nativeCode, setNativeCode] = useState('en')
  const [nativeOther, setNativeOther] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('')
  const [statement, setStatement] = useState('')
  const [domains, setDomains] = useState<string[]>([])
  const [journeyStarted, setJourneyStarted] = useState(false)
  const resumed = useRef(false)

  // The journey is written at the destination step, so a refresh mid-flow leaves a real
  // profile behind. Pick up where they left off instead of making them retype everything.
  useEffect(() => {
    if (resumed.current || !profile) return
    resumed.current = true
    const journey = activeJourney(profile)
    if (!journey?.intention) return
    setJourneyStarted(true)
    setDisplayName(profile.displayName)
    setTargetLanguage(journey.language)
    setStatement(journey.intention.statement)
    setDomains(profile.onboarding.domains)
    if (profile.nativeLanguage.code) setNativeCode(profile.nativeLanguage.code)
    else if (profile.nativeLanguage.name) {
      setNativeCode(OTHER_NATIVE_LANGUAGE)
      setNativeOther(profile.nativeLanguage.name)
    }
    setStep(STEPS[Math.min(profile.onboarding.step, STEPS.length - 1)] ?? 'domains')
  }, [profile])

  const index = STEPS.indexOf(step)
  const language = targetLanguage.trim()

  function nativeLanguage(): NativeLanguage {
    if (nativeCode === OTHER_NATIVE_LANGUAGE) return { name: nativeOther.trim(), code: '' }
    return NATIVE_LANGUAGES.find((l) => l.code === nativeCode) ?? { name: 'English', code: 'en' }
  }

  function go(next: Step) {
    setStep(next)
    window.scrollTo(0, 0)
  }

  /**
   * Written at the destination step rather than at the end: the corpus step that follows
   * needs a real journey to attach recordings to, and a half-finished onboarding that
   * survives a refresh is better than one that loses everything.
   */
  async function startJourney(e: FormEvent) {
    e.preventDefault()
    const now = Date.now()
    await updateProfile.mutateAsync({
      displayName: displayName.trim(),
      nativeLanguage: nativeLanguage(),
      languages: [
        {
          language,
          intention: { statement: statement.trim(), setAt: now, history: [] },
          startedAt: now,
        },
      ],
      activeLanguage: language,
      onboarding: {
        version: ONBOARDING_VERSION,
        step: STEPS.indexOf('domains'),
        completedAt: null,
        corpusSkipped: false,
        domains: [],
      },
    })
    setJourneyStarted(true)
    go('domains')
  }

  /** Persists progress so a refresh resumes here rather than restarting the flow. */
  async function advanceTo(next: Step, corpusSkipped: boolean) {
    await updateProfile.mutateAsync({
      onboarding: {
        version: ONBOARDING_VERSION,
        step: STEPS.indexOf(next),
        completedAt: null,
        corpusSkipped,
        domains,
      },
    })
    go(next)
  }

  async function finish() {
    await updateProfile.mutateAsync({
      onboarding: {
        version: ONBOARDING_VERSION,
        step: STEPS.length,
        completedAt: Date.now(),
        corpusSkipped: profile?.onboarding.corpusSkipped ?? false,
        domains,
      },
    })
    navigate('/', { replace: true })
  }

  // The corpus step needs the full width and its own scroll — it is a working screen,
  // not a form field.
  if (step === 'corpus') {
    return (
      <div className="mx-auto min-h-dvh max-w-2xl p-5 pb-20">
        <Progress index={index} />
        <h1 className="font-display mt-4 text-[27px] font-bold text-primary-900">
          Build your first deck
        </h1>
        <p className="mt-1 mb-5 max-w-prose text-sm text-stone-600">
          Instead of a generic top-1000 list full of words you will never say, talk about your own
          life for ten minutes in {nativeLanguage().name || 'your own language'}. The app counts
          what you actually use and translates that into {language}. Every card will be a word you
          already say most days.
        </p>
        <VocabBuildScreen embedded onDone={() => void advanceTo('method', false)} />
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4">
          <button
            type="button"
            disabled={updateProfile.isPending}
            onClick={() => void advanceTo('method', false)}
            className={primaryButton}
          >
            Continue
          </button>
          <button
            type="button"
            disabled={updateProfile.isPending}
            onClick={() => void advanceTo('method', true)}
            className="text-sm font-medium text-stone-500 hover:text-ink disabled:opacity-50"
          >
            I&apos;ll do this later
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Progress index={index} />

        {step === 'welcome' && (
          <Panel
            title="Welcome"
            lede="Before the roadtrip starts, a few things — it takes about two minutes."
          >
            <p className="text-sm leading-relaxed text-stone-600">
              This app will not teach you your language. There are no lessons in here and no
              grammar drills. What it does is structure the practice you do yourself, split between
              three things: <strong className="font-bold text-ink">input</strong> you understand,{' '}
              <strong className="font-bold text-ink">output</strong> you struggle through, and the{' '}
              <strong className="font-bold text-ink">rest</strong> that makes both stick.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              We&apos;ll set your destination, build you a starter deck out of your own vocabulary,
              and explain why the app nags you about the things it nags you about.
            </p>
            <button type="button" onClick={() => go('name')} className={`${primaryButton} mt-4`}>
              Start
            </button>
          </Panel>
        )}

        {step === 'name' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              go('languages')
            }}
          >
            <Panel title="First, your name" lede="Only used to say hello.">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                What should we call you?
                <input
                  required
                  autoFocus
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputClass}
                  placeholder="Your name"
                />
              </label>
              <Nav onBack={() => go('welcome')} submitLabel="Next" />
            </Panel>
          </form>
        )}

        {step === 'languages' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              go('destination')
            }}
          >
            <Panel title="Which languages?" lede="Where you're starting from, and where you're going.">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Your own language
                <select
                  value={nativeCode}
                  onChange={(e) => setNativeCode(e.target.value)}
                  className={inputClass}
                >
                  {NATIVE_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                  <option value={OTHER_NATIVE_LANGUAGE}>Other…</option>
                </select>
              </label>
              {nativeCode === OTHER_NATIVE_LANGUAGE && (
                <input
                  required
                  value={nativeOther}
                  onChange={(e) => setNativeOther(e.target.value)}
                  className={`${inputClass} mt-2`}
                  placeholder="Your language"
                />
              )}

              <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium">
                Which language are you learning?
                <input
                  required
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Spanish"
                />
                <span className="text-xs font-normal text-stone-500">
                  Be as specific as you like — &ldquo;Brazilian Portuguese&rdquo; is a different
                  destination from &ldquo;Portuguese&rdquo;.
                </span>
              </label>
              <Nav onBack={() => go('name')} submitLabel="Next" />
            </Panel>
          </form>
        )}

        {step === 'destination' && (
          <form onSubmit={startJourney}>
            <Panel title="Set your destination" lede="The reason you'll need on the bad days.">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Why are you learning {language || 'it'}?
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
                  Be honest and specific. The app resurfaces this at session starts and during
                  breaks.
                </span>
              </label>
              {updateProfile.isError && (
                <p className="mt-2 text-sm text-output-deep">
                  {(updateProfile.error as Error).message}
                </p>
              )}
              <Nav
                onBack={() => go('languages')}
                submitLabel={updateProfile.isPending ? 'Saving…' : 'Next'}
                disabled={updateProfile.isPending}
              />
            </Panel>
          </form>
        )}

        {step === 'domains' && (
          <Panel
            title="What do you talk about?"
            lede="Pick the parts of your life that come up most. Six or so is plenty."
          >
            <p className="text-sm leading-relaxed text-stone-600">
              Next you&apos;ll build a starter deck from your own speech. The most common few
              hundred words fall out of anyone&apos;s conversation — what makes the list{' '}
              <em>yours</em> is the topics. So tell us which ones matter, and we&apos;ll steer the
              prompts there.
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {LIFE_DOMAINS.map((domain) => {
                const on = domains.includes(domain.slug)
                return (
                  <li key={domain.slug}>
                    <button
                      type="button"
                      title={domain.hint}
                      onClick={() =>
                        setDomains((prev) =>
                          on ? prev.filter((d) => d !== domain.slug) : [...prev, domain.slug],
                        )
                      }
                      className={
                        on
                          ? 'rounded-full bg-primary-700 px-3 py-1.5 text-[13px] font-medium text-[#F7F2E8]'
                          : 'rounded-full border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-600 hover:border-stone-400'
                      }
                    >
                      {domain.label}
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                disabled={domains.length === 0 || updateProfile.isPending}
                onClick={() => void advanceTo('corpus', false)}
                className={primaryButton}
              >
                Next
              </button>
              <button
                type="button"
                disabled={updateProfile.isPending}
                onClick={() => void advanceTo('method', true)}
                className="text-sm font-medium text-stone-500 hover:text-ink disabled:opacity-50"
              >
                Skip for now
              </button>
            </div>
          </Panel>
        )}

        {step === 'method' && (
          <div className="w-full">
            <h1 className="font-display text-[27px] font-bold text-primary-900">
              How the roadtrip works
            </h1>
            <p className="mt-1 mb-4 text-sm text-stone-600">
              Seven things worth knowing before you start. They&apos;re kept in Settings if you
              want them again.
            </p>
            <MethodPrimer />
            <button
              type="button"
              disabled={updateProfile.isPending || !journeyStarted}
              onClick={() => void finish()}
              className={`${primaryButton} mt-5 w-full`}
            >
              {updateProfile.isPending ? 'Saving…' : 'Start the roadtrip'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Panel({
  title,
  lede,
  children,
}: {
  title: string
  lede: string
  children: ReactNode
}) {
  return (
    <div>
      <h1 className="font-display text-[27px] font-bold text-primary-900">{title}</h1>
      <p className="mt-1 mb-4 text-sm text-stone-600">{lede}</p>
      {children}
    </div>
  )
}

function Nav({
  onBack,
  submitLabel,
  disabled,
}: {
  onBack: () => void
  submitLabel: string
  disabled?: boolean
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <button type="submit" disabled={disabled} className={primaryButton}>
        {submitLabel}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-stone-500 hover:text-ink"
      >
        Back
      </button>
    </div>
  )
}

/** The same dotted route rail the Today screen uses for the week. */
function Progress({ index }: { index: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <li
          key={s}
          className={`h-1.5 flex-1 rounded-full ${
            i < index ? 'bg-primary-700' : i === index ? 'bg-input' : 'bg-stone-200'
          }`}
        />
      ))}
    </ol>
  )
}
