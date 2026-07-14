import type { ActivityLog, StorySpeakingLog } from '../../domain/entities'

/**
 * A history list item: either a lone log, or one sitting's story-speaking
 * attempts on the same prompt collapsed into a group.
 */
export type HistoryItem =
  | { type: 'single'; log: ActivityLog }
  | { type: 'group'; groupId: string; attempts: StorySpeakingLog[] }

/**
 * Collapse story-speaking logs that share an attemptGroupId. Input is sorted
 * by occurredAt desc; each group is anchored at its latest attempt and keeps
 * that order inside. Legacy story-speaking logs (no group id) pass through
 * as singles.
 */
export function groupHistory(logs: ActivityLog[]): HistoryItem[] {
  const items: HistoryItem[] = []
  const groups = new Map<string, StorySpeakingLog[]>()
  for (const log of logs) {
    if (log.kind === 'story_speaking' && log.details.attemptGroupId) {
      const existing = groups.get(log.details.attemptGroupId)
      if (existing) {
        existing.push(log)
      } else {
        const attempts = [log]
        groups.set(log.details.attemptGroupId, attempts)
        items.push({ type: 'group', groupId: log.details.attemptGroupId, attempts })
      }
    } else {
      items.push({ type: 'single', log })
    }
  }
  return items
}

/** Display name for a group: the user's title if any attempt has one, else the prompt. */
export function groupTitle(attempts: StorySpeakingLog[]): string {
  return (
    attempts.find((a) => a.title)?.title ||
    attempts[0]?.details.promptText ||
    'Story speaking'
  )
}
