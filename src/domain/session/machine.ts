// Pure session state machine. Stores timestamps, never countdowns, so a
// refresh, tab close, or device switch can always resolve the current state
// from the persisted session plus the current time.

import type { PlannedBlock, Session, SessionRun } from '../entities'

const MIN_MS = 60 * 1000

export type SessionEvent =
  | { type: 'START'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'END_INPUT'; now: number } // user ends the input leg early; output starts now
  | { type: 'END_BLOCK'; now: number } // user ends the block early
  | { type: 'SKIP_BREAK'; now: number } // only reachable through the hold-to-skip UI
  | { type: 'END_BREAK'; now: number } // user starts the next block after a full break
  | { type: 'ABANDON'; now: number }

export function createSession(input: {
  id: string
  userId: string
  language: string
  blocks: PlannedBlock[]
  breakMinutes: number
  now: number
}): Session {
  return {
    id: input.id,
    userId: input.userId,
    language: input.language,
    createdAt: input.now,
    updatedAt: input.now,
    status: 'planned',
    plan: { blocks: input.blocks, breakMinutes: input.breakMinutes },
    run: {
      currentBlockIndex: 0,
      phase: null,
      phaseStartedAt: null,
      phaseEndsAt: null,
      blockActuals: [],
      breaksSkipped: 0,
    },
    intentionShown: false,
  }
}

function currentBlock(session: Session): PlannedBlock {
  const block = session.plan.blocks[session.run.currentBlockIndex]
  if (!block) throw new Error(`No block at index ${session.run.currentBlockIndex}`)
  return block
}

function startBlock(session: Session, index: number, now: number): Session {
  const block = session.plan.blocks[index]
  if (!block) throw new Error(`No block at index ${index}`)
  const run: SessionRun = {
    ...session.run,
    currentBlockIndex: index,
    phase: 'block',
    phaseStartedAt: now,
    phaseEndsAt: now + block.plannedMinutes * MIN_MS,
    blockActuals: [
      ...session.run.blockActuals,
      { blockId: block.id, startedAt: now, endedAt: null },
    ],
  }
  return { ...session, status: 'active', run, updatedAt: now }
}

/** Close the running block at `endedAt`; enter break, or complete after the last block. */
function endBlock(session: Session, endedAt: number): Session {
  const blockActuals = session.run.blockActuals.map((a, i) =>
    i === session.run.blockActuals.length - 1 && a.endedAt === null
      ? { ...a, endedAt }
      : a,
  )
  const isLast = session.run.currentBlockIndex >= session.plan.blocks.length - 1

  if (isLast) {
    return {
      ...session,
      status: 'completed',
      run: { ...session.run, phase: null, phaseStartedAt: null, phaseEndsAt: null, blockActuals },
      updatedAt: endedAt,
    }
  }

  return {
    ...session,
    status: 'break',
    run: {
      ...session.run,
      phase: 'break',
      phaseStartedAt: endedAt,
      phaseEndsAt: endedAt + session.plan.breakMinutes * MIN_MS,
      blockActuals,
    },
    updatedAt: endedAt,
  }
}

/** Break timer elapsed: stay in 'break' status, waiting for the user to start the next block. */
function finishBreak(session: Session, now: number): Session {
  return {
    ...session,
    run: { ...session.run, phase: null, phaseStartedAt: null, phaseEndsAt: null },
    updatedAt: now,
  }
}

export function reduce(session: Session, event: SessionEvent): Session {
  const { now } = event
  const { status, run } = session

  switch (event.type) {
    case 'START': {
      if (status !== 'planned') return session
      return { ...startBlock(session, 0, now), intentionShown: true }
    }

    case 'TICK': {
      // Resolve elapsed phases; a single TICK after a long absence may cross
      // block-end AND break-end, so cascade until nothing more elapses.
      let s = session
      for (;;) {
        const { phase, phaseEndsAt } = s.run
        if (phase === null || phaseEndsAt === null || now < phaseEndsAt) return s
        s = phase === 'block' ? endBlock(s, phaseEndsAt) : finishBreak(s, now)
      }
    }

    case 'END_INPUT': {
      // Only meaningful mid-block, once per block. The block's end time is
      // unchanged — the output leg simply gets the remaining time from `now`.
      const open = run.blockActuals[run.blockActuals.length - 1]
      if (status !== 'active' || run.phase !== 'block' || !open || open.inputEndedAt != null) {
        return session
      }
      const blockActuals = run.blockActuals.map((a, i) =>
        i === run.blockActuals.length - 1 ? { ...a, inputEndedAt: now } : a,
      )
      return { ...session, run: { ...run, blockActuals }, updatedAt: now }
    }

    case 'END_BLOCK': {
      if (status !== 'active' || run.phase !== 'block') return session
      return endBlock(session, now)
    }

    case 'SKIP_BREAK': {
      // Only valid while the break timer is still running.
      if (status !== 'break' || run.phase !== 'break') return session
      const skipped = {
        ...session,
        run: { ...run, breaksSkipped: run.breaksSkipped + 1 },
      }
      return startBlock(skipped, run.currentBlockIndex + 1, now)
    }

    case 'END_BREAK': {
      // Only valid once the break has fully elapsed.
      if (status !== 'break' || run.phase !== null) return session
      return startBlock(session, run.currentBlockIndex + 1, now)
    }

    case 'ABANDON': {
      if (status === 'completed' || status === 'abandoned') return session
      const blockActuals = run.blockActuals.map((a) =>
        a.endedAt === null ? { ...a, endedAt: now } : a,
      )
      return {
        ...session,
        status: 'abandoned',
        run: { ...run, phase: null, phaseStartedAt: null, phaseEndsAt: null, blockActuals },
        updatedAt: now,
      }
    }
  }
}

export { currentBlock }
