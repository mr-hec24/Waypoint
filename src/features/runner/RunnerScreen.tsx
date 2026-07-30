import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useProfile } from '../../services/queries/profile'
import { useSessionStore } from './sessionStore'
import { useSessionTicker } from './useSessionTicker'
import { HoldToConfirm } from '../../components/HoldToConfirm'
import { TimerRing, formatRemaining } from '../../components/TimerRing'
import { DestinationPlaque } from '../../components/DestinationPlaque'
import { blockActivityMinutes, currentBlock } from '../../domain/session/machine'
import { useQueryClient } from '@tanstack/react-query'
import { activityLogRepo } from '../../services/supabase/logRepos'
import { libraryRepo } from '../../services/supabase/libraryRepo'
import { StorySpeaking } from './StorySpeaking'
import { WritingExercise } from './WritingExercise'
import { StarredImmersionPanel } from '../library/StarredImmersionPanel'
import { RepProgress } from '../library/RepProgress'
import { useStarredLibraryItem } from '../../services/queries/library'
import { PILLAR_BY_KIND, type ActivityKind, type ActivityLog, type Session } from '../../domain/entities'

/** One log per activity per block that actually ran, credited by the real time each leg got.
 *  `focusTitle` names the starred library item so immersion logs record what was watched. */
function buildSessionLogs(session: Session, focusTitle: string | null = null): ActivityLog[] {
  const emptyDetails: Record<ActivityKind, ActivityLog['details']> = {
    flashcards: { cardsReviewed: 0, cardsCorrect: 0 },
    course: { courseId: '', unitLabel: '' },
    immersion: { medium: 'other', title: focusTitle ?? '' },
    story_speaking: { promptText: '', recordingId: null },
    writing: { promptText: '', text: '' },
    conversation: { partnerType: 'other' },
  }
  const logs: ActivityLog[] = []
  for (const actual of session.run.blockActuals) {
    const block = session.plan.blocks.find((b) => b.id === actual.blockId)
    if (!block) continue
    for (const { kind, minutes } of blockActivityMinutes(block, actual)) {
      // Story speaking and writing log themselves in-session (with recording /
      // text attached) — logging them again here would double-count.
      if (kind === 'story_speaking' || kind === 'writing') continue
      if (minutes <= 0) continue
      logs.push({
        id: crypto.randomUUID(),
        userId: session.userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        kind,
        pillar: PILLAR_BY_KIND[kind],
        language: session.language,
        sessionId: session.id,
        occurredAt: actual.startedAt,
        durationMinutes: minutes,
        notes: '',
        title: kind === 'immersion' ? focusTitle : null,
        details: emptyDetails[kind],
      } as ActivityLog)
    }
  }
  return logs
}

const KIND_LABELS: Record<ActivityKind, string> = {
  flashcards: 'Flashcards',
  course: 'Course',
  immersion: 'Immersion',
  story_speaking: 'Story speaking',
  writing: 'Writing',
  conversation: 'Conversation',
}

export function RunnerScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const session = useSessionStore((s) => s.session)
  const dispatch = useSessionStore((s) => s.dispatch)
  const clear = useSessionStore((s) => s.clear)
  const hydrate = useSessionStore((s) => s.hydrate)
  const now = useSessionTicker()
  const { data: focusItem } = useStarredLibraryItem()
  const [hydrating, setHydrating] = useState(true)

  useEffect(() => {
    if (!id) return
    void hydrate(id).finally(() => setHydrating(false))
  }, [id, hydrate])

  if (hydrating && session?.id !== id) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-stone-400">
        Loading session…
      </div>
    )
  }

  if (!session || session.id !== id) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6">
        <p className="font-medium">Session not found.</p>
        <Link to="/" className="text-sm text-primary-700 underline">
          Back to Today
        </Link>
      </div>
    )
  }

  const { status, run, plan } = session
  const remaining = run.phaseEndsAt !== null ? run.phaseEndsAt - now : 0
  const phaseTotal =
    run.phaseEndsAt !== null && run.phaseStartedAt !== null
      ? run.phaseEndsAt - run.phaseStartedAt
      : 1

  // ---- planned: intention gate + start ----
  if (status === 'planned') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-paper p-6 text-center">
        <div className="w-full max-w-md">
          <DestinationPlaque
            statement={
              profile?.languages.find((j) => j.language === session.language)?.intention
                ?.statement ?? 'Set your intention in Settings.'
            }
          />
        </div>
        <p className="text-[13px] text-stone-600">
          {plan.blocks.length} block{plan.blocks.length > 1 ? 's' : ''} ·{' '}
          {plan.blocks.reduce((s, b) => s + b.plannedMinutes, 0)} min total ·{' '}
          {plan.breakMinutes}-min breaks
        </p>
        <button
          onClick={() => dispatch({ type: 'START', now: Date.now() })}
          className="rounded-[10px] bg-primary-700 px-8 pt-[17px] pb-[15px] text-lg font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800"
        >
          Start block 1
        </button>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          Not now
        </button>
      </div>
    )
  }

  // ---- active block ----
  if (status === 'active') {
    const block = currentBlock(session)
    const inputActivity = block.activities.find((a) => PILLAR_BY_KIND[a.kind] === 'input')
    const outputActivity = block.activities.find((a) => PILLAR_BY_KIND[a.kind] === 'output')
    const portioned = Boolean(inputActivity && outputActivity && run.phaseStartedAt !== null)
    const openActual = run.blockActuals[run.blockActuals.length - 1]
    const inputEndsAt = portioned
      ? Math.min(
          openActual?.inputEndedAt ?? Number.POSITIVE_INFINITY,
          run.phaseStartedAt! + inputActivity!.plannedMinutes * 60000,
        )
      : null
    const portion: 'input' | 'output' =
      portioned && inputEndsAt !== null && now < inputEndsAt ? 'input' : 'output'
    const portionRemaining = portion === 'input' && inputEndsAt !== null ? inputEndsAt - now : remaining
    const nudgeKey = `waypoint.inputOver.${session.id}.${run.currentBlockIndex}`

    function startOutputNow() {
      // Voluntary switch — don't show the fork-in-the-road interruption.
      sessionStorage.setItem(nudgeKey, '1')
      dispatch({ type: 'END_INPUT', now: Date.now() })
    }

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-[22px] bg-night p-6 text-night-text">
        {portioned && portion === 'output' && (
          <InputOverNudge storageKey={nudgeKey} outputLabel={KIND_LABELS[outputActivity!.kind]} />
        )}

        <p className="text-[11px] font-extrabold tracking-[.24em] text-night-sage uppercase">
          Block {run.currentBlockIndex + 1} of {plan.blocks.length} · Night drive
        </p>
        <TimerRing
          fraction={remaining / phaseTotal}
          label={formatRemaining(remaining)}
          sublabel="to the next stop"
        />

        {portioned ? (
          <div className="flex w-full max-w-2xl flex-col items-center gap-4">
            {/* Input → Output leg pills */}
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3.5 pt-[6px] pb-[4px] text-[11.5px] font-extrabold uppercase ${
                  portion === 'input'
                    ? 'bg-input text-night-text'
                    : 'border border-night-border text-[#7C8F7F] line-through'
                }`}
              >
                Input · {KIND_LABELS[inputActivity!.kind]} {inputActivity!.plannedMinutes}m
              </span>
              <span className="text-[#3A5142]">···</span>
              <span
                className={`rounded-full px-3.5 pt-[6px] pb-[4px] text-[11.5px] font-extrabold uppercase ${
                  portion === 'output'
                    ? 'bg-output text-night-text'
                    : 'border border-night-border text-[#7C8F7F]'
                }`}
              >
                Output · {KIND_LABELS[outputActivity!.kind]} {outputActivity!.plannedMinutes}m
              </span>
            </div>
            {portion === 'input' && (
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-xs text-night-sage">
                  {formatRemaining(portionRemaining)} of input left — then the fork to output.
                </p>
                <button
                  onClick={startOutputNow}
                  className="text-xs font-bold text-[#D9A084] underline decoration-dotted underline-offset-2 hover:text-[#E8B598]"
                >
                  Done with input? Start output now →
                </button>
              </div>
            )}
            {portion === 'input' ? (
              <InputPanel kind={inputActivity!.kind} />
            ) : (
              <OutputPanel
                kind={outputActivity!.kind}
                userId={session.userId}
                sessionId={session.id}
                language={session.language}
              />
            )}
          </div>
        ) : (
          // Fallback for sessions planned before the input/output split.
          <div className="w-full max-w-sm">
            <ul className="flex flex-col gap-1.5">
              {block.activities.map((a, i) => (
                <li
                  key={i}
                  className="flex justify-between rounded-xl border border-night-border bg-night-panel px-4 py-2.5 text-sm text-[#C9D3C6]"
                >
                  <span>{KIND_LABELS[a.kind]}</span>
                  <span className="text-night-sage">{a.plannedMinutes} min</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-4">
          <HoldToConfirm
            holdMs={1500}
            onConfirm={() => dispatch({ type: 'END_BLOCK', now: Date.now() })}
            className="rounded-[10px] border border-[#3A5142] px-5 pt-[11px] pb-[9px] text-sm font-bold text-[#A9BCA9] hover:bg-night-panel"
          >
            Hold to end block early
          </HoldToConfirm>
          <HoldToConfirm
            holdMs={2500}
            onConfirm={() => dispatch({ type: 'ABANDON', now: Date.now() })}
            className="px-3 pt-[7px] pb-[5px] text-[13px] text-[#6E8272] hover:text-night-sage"
          >
            Hold to abandon
          </HoldToConfirm>
        </div>
      </div>
    )
  }

  // ---- break: the scenic overlook ----
  if (status === 'break') {
    const breakRunning = run.phase === 'break'
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center gap-7 overflow-hidden bg-dusk p-6 text-center">
        {/* Scene: setting sun + ground band */}
        <div
          aria-hidden
          className="absolute bottom-[34%] left-1/2 h-[170px] w-[170px] -translate-x-1/2 rounded-full bg-sun"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[40%] bg-dusk-deep" />

        <div className="relative flex flex-col items-center gap-7">
          <p className="text-[11px] font-extrabold tracking-[.28em] text-[#C7D6C8] uppercase">
            Scenic overlook · Break
          </p>
          {breakRunning ? (
            <>
              <div>
                <p className="text-[68px] leading-none font-light tabular-nums text-[#F7F2E8]">
                  {formatRemaining(remaining)}
                </p>
                <p className="mt-3 text-[10.5px] font-extrabold tracking-[.28em] text-[#9DB5A8] uppercase">
                  Step away from the screen
                </p>
              </div>
              {(() => {
                const intention = profile?.languages.find(
                  (j) => j.language === session.language,
                )?.intention
                return intention ? (
                  <div className="w-full max-w-md">
                    <DestinationPlaque
                      statement={intention.statement}
                      label="Your destination"
                      compact
                    />
                  </div>
                ) : null
              })()}
              <div className="flex flex-col items-center gap-2">
                <HoldToConfirm
                  holdMs={5000}
                  onConfirm={() => dispatch({ type: 'SKIP_BREAK', now: Date.now() })}
                >
                  Hold 5s to skip the break
                </HoldToConfirm>
                {run.breaksSkipped > 0 && (
                  <p className="text-[11px] text-sun">
                    {run.breaksSkipped} break{run.breaksSkipped > 1 ? 's' : ''} skipped this
                    session — it shows on your trip log.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-3xl font-bold text-[#F7F2E8]">Break&apos;s over.</p>
              <p className="text-sm text-[#C7D6C8]">Ready for the next leg when you are.</p>
              <button
                onClick={() => dispatch({ type: 'END_BREAK', now: Date.now() })}
                className="rounded-[10px] bg-[#F7F2E8] px-8 pt-[17px] pb-[15px] text-lg font-extrabold text-primary-800 transition-colors hover:bg-card"
              >
                Start block {run.currentBlockIndex + 2}
              </button>
            </>
          )}
          <HoldToConfirm
            holdMs={2500}
            onConfirm={() => dispatch({ type: 'ABANDON', now: Date.now() })}
            className="px-3 pt-[6px] pb-[4px] text-xs text-[#7E958A] hover:text-[#C7D6C8]"
          >
            Hold to abandon session
          </HoldToConfirm>
        </div>
      </div>
    )
  }

  // ---- completed / abandoned: waypoint reached ----
  const totalMinutes = Math.round(
    run.blockActuals.reduce((sum, a) => sum + ((a.endedAt ?? a.startedAt) - a.startedAt), 0) /
      60000,
  )
  const digits = String(totalMinutes).padStart(3, '0').split('')
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper p-6 text-center">
      {/* Logo mark: location ring with rust center */}
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-primary-700">
        <span className="h-3 w-3 rounded-full bg-output" />
      </span>
      <div>
        <p className="text-[11px] font-extrabold tracking-[.28em] text-primary-700 uppercase">
          {status === 'completed' ? 'Waypoint reached' : 'Pulled over'}
        </p>
        <h2 className="font-display mt-1 text-[28px] font-bold">
          {status === 'completed' ? 'Session complete' : 'Session abandoned'}
        </h2>
      </div>

      <div>
        <div className="flex justify-center gap-1.5">
          {digits.map((d, i) => (
            <span
              key={i}
              className={`flex h-[58px] w-11 items-center justify-center rounded-md bg-ink text-[30px] font-extrabold tabular-nums ${
                i === digits.length - 1 ? 'text-sun' : 'text-[#F7F2E8]'
              }`}
            >
              {d}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
          Focused minutes on the odometer
        </p>
      </div>

      <p className="text-[13px] text-stone-600">
        {run.blockActuals.length} block{run.blockActuals.length !== 1 ? 's' : ''} driven
        {run.breaksSkipped > 0 && ` · ${run.breaksSkipped} break${run.breaksSkipped > 1 ? 's' : ''} skipped`}
      </p>

      {status === 'completed' &&
        plan.blocks.some((b) => b.activities.some((a) => a.kind === 'immersion')) &&
        focusItem && (
          <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-card px-4 py-4">
            <p className="text-[10.5px] font-extrabold tracking-[.18em] text-stone-500 uppercase">
              ★ Your focus
            </p>
            <p className="font-display mt-1 text-lg font-bold">{focusItem.title}</p>
            <div className="mt-2 flex justify-center">
              <RepProgress reps={focusItem.repetitions} />
            </div>
            <p className="mt-3 text-[13px] text-stone-600">
              Repetition is where comprehension locks in — keep it starred for another pass next time,
              or{' '}
              <Link to="/library" className="font-bold text-primary-700 underline">
                pick something new
              </Link>
              .
            </p>
          </div>
        )}

      <FinishButton session={session} onDone={() => { clear(); navigate('/') }} />
    </div>
  )
}

/**
 * Auto-logs the session's activities once (idempotent: skips kinds already
 * logged for this session), so closing the tab on this screen loses nothing.
 */
function FinishButton({ session, onDone }: { session: Session; onDone: () => void }) {
  const hasWork = session.run.blockActuals.length > 0
  const [state, setState] = useState<'logging' | 'logged' | 'error'>(hasWork ? 'logging' : 'logged')
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)
  const queryClient = useQueryClient()

  async function runLog() {
    setState('logging')
    setError(null)
    try {
      // If immersion was planned, credit the starred focus item — name its logs and count a rep.
      const plannedImmersion = session.plan.blocks.some((b) =>
        b.activities.some((a) => a.kind === 'immersion'),
      )
      const focus = plannedImmersion
        ? (await libraryRepo.listAll(session.userId, session.language)).find((i) => i.starred) ?? null
        : null

      const existing = await activityLogRepo.bySession(session.userId, session.id)
      const alreadyLogged = new Set(existing.map((l) => l.kind))
      const logs = buildSessionLogs(session, focus?.title ?? null).filter(
        (l) => !alreadyLogged.has(l.kind),
      )
      await Promise.all(logs.map((log) => activityLogRepo.put(log)))

      // Count one pass only when a *new* immersion log was written this run (idempotent on re-finish).
      if (focus && logs.some((l) => l.kind === 'immersion')) {
        await libraryRepo.put({
          ...focus,
          repetitions: focus.repetitions + 1,
          lastRepAt: Date.now(),
          updatedAt: Date.now(),
        })
        void queryClient.invalidateQueries({ queryKey: ['library', session.userId] })
      }
      setState('logged')
    } catch (e) {
      setError((e as Error).message)
      setState('error')
    }
  }

  useEffect(() => {
    if (!hasWork || ran.current) return
    ran.current = true
    void runLog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWork])

  return (
    <div className="flex flex-col items-center gap-2">
      {hasWork && state === 'logging' && (
        <p className="text-xs text-stone-500">Logging activities…</p>
      )}
      {hasWork && state === 'logged' && (
        <p className="text-[11px] font-extrabold tracking-[.14em] text-primary-700 uppercase">
          Activities logged ✓
        </p>
      )}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-output-deep">Logging failed: {error}</p>
          <button onClick={runLog} className="text-xs font-bold text-primary-700 underline">
            Try again
          </button>
        </div>
      )}
      <button
        onClick={onDone}
        className="mt-1 rounded-[10px] bg-primary-700 px-6 pt-[14px] pb-[12px] text-[15px] font-bold text-[#F7F2E8] transition-colors hover:bg-primary-800"
      >
        Back to Today
      </button>
    </div>
  )
}

/** Full-screen "fork in the road" shown once when the input portion elapses. */
function InputOverNudge({ storageKey, outputLabel }: { storageKey: string; outputLabel: string }) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(storageKey) === '1')
  if (dismissed) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-output-deep p-6 text-center text-[#F7F2E8]">
      <p className="text-[11px] font-extrabold tracking-[.28em] text-[#F3D9C5] uppercase">
        ◆ Fork in the road ◆
      </p>
      <h3 className="font-display max-w-xs text-[32px] leading-tight font-bold">
        Input time is over.
      </h3>
      <span aria-hidden className="w-14 border-t-2 border-white/50" />
      <p className="max-w-sm text-[15px] leading-relaxed text-[#F8E7D9]">
        Input fills the tank, but output is what moves you down the road. Don&apos;t linger.
      </p>
      <button
        onClick={() => {
          sessionStorage.setItem(storageKey, '1')
          setDismissed(true)
        }}
        className="rounded-[10px] bg-[#F7F2E8] px-6 pt-[14px] pb-[12px] font-extrabold text-output-deep hover:bg-card"
      >
        Switch to {outputLabel} →
      </button>
    </div>
  )
}

function HintCard({
  title,
  tint,
  children,
}: {
  title: string
  tint: string
  children: React.ReactNode
}) {
  return (
    <div className="w-full rounded-xl border border-night-border bg-night-panel p-4">
      <p className={`text-[10.5px] font-extrabold tracking-[.18em] uppercase ${tint}`}>{title}</p>
      <div className="mt-1.5 text-[13.5px] text-[#C9D3C6]">{children}</div>
    </div>
  )
}

function InputPanel({ kind }: { kind: ActivityKind }) {
  if (kind === 'immersion') {
    return (
      <div className="flex w-full flex-col items-stretch gap-4">
        <StarredImmersionPanel />
        <HintCard title="Input · Immersion" tint="text-[#7FA8C2]">
          Watch, listen, or read in your target language — pick something you actually enjoy.
          It&apos;ll be logged automatically when the session ends.
        </HintCard>
      </div>
    )
  }
  if (kind === 'flashcards') {
    return (
      <HintCard title="Input · Flashcards" tint="text-[#7FA8C2]">
        Work through your due cards, then come back here.
        <Link
          to="/review"
          className="mt-2.5 block rounded-lg bg-primary-700 px-4 pt-[11px] pb-[9px] text-center text-sm font-bold text-[#F7F2E8] hover:bg-primary-800"
        >
          Open flashcard review → the session keeps running
        </Link>
      </HintCard>
    )
  }
  if (kind === 'course') {
    return (
      <HintCard title="Input · Course" tint="text-[#7FA8C2]">
        Continue your external course from where you left off. Log the units you finish under
        Logs → Input afterwards.
      </HintCard>
    )
  }
  return null
}

function OutputPanel({
  kind,
  userId,
  sessionId,
  language,
}: {
  kind: ActivityKind
  userId: string
  sessionId: string
  language: string
}) {
  if (kind === 'story_speaking')
    return <StorySpeaking userId={userId} sessionId={sessionId} language={language} />
  if (kind === 'writing')
    return <WritingExercise userId={userId} sessionId={sessionId} language={language} />
  return (
    <HintCard title="Output · Conversation" tint="text-[#D9A084]">
      Time to talk — call your tutor or exchange partner and stay in the target language.
      It&apos;ll be logged automatically when the session ends.
    </HintCard>
  )
}
