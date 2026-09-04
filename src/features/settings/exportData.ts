// Local-first insurance: dump every table the user owns to a JSON file,
// across all language journeys.

import { profileRepo } from '../../services/supabase/profileRepo'
import { sessionRepo } from '../../services/supabase/sessionRepo'
import { deckRepo } from '../../services/supabase/deckRepo'
import { wordRepo } from '../../services/supabase/wordRepo'
import { activityLogRepo, courseRepo, sleepLogRepo } from '../../services/supabase/logRepos'
import { recordingRepo } from '../../services/supabase/recordingRepo'
import { corpusRepo } from '../../services/supabase/corpusRepo'

export async function exportAllData(userId: string): Promise<void> {
  const profile = await profileRepo.get(userId)
  const languages = profile?.languages.map((j) => j.language) ?? []

  const activityLogs = (
    await Promise.all(
      languages.map((lang) => activityLogRepo.byDateRange(userId, lang, 0, Date.now())),
    )
  ).flat()
  const courses = (
    await Promise.all(languages.map((lang) => courseRepo.listAll(userId, lang)))
  ).flat()
  const corpusSources = (
    await Promise.all(languages.map((lang) => corpusRepo.listAll(userId, lang)))
  ).flat()

  const data = {
    exportedAt: new Date().toISOString(),
    profile,
    sessions: await sessionRepo.listRecent(userId, 1000),
    decks: await deckRepo.listAll(userId),
    words: await wordRepo.listAll(userId),
    activityLogs,
    sleepLogs: await sleepLogRepo.listRecent(userId, 1000),
    courses,
    recordings: await recordingRepo.list(userId), // metadata only, not audio
    corpusSources, // includes the transcripts of your own speech
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `waypoint-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
