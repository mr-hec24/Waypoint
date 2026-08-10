import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { useActiveLanguage } from './profile'
import { corpusRepo } from '../supabase/corpusRepo'
import { recordingRepo } from '../supabase/recordingRepo'
import type { CorpusSource } from '../../domain/entities'

/** Every corpus source in the active journey, oldest first — saturation depends on that order. */
export function useCorpusSources() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  return useQuery({
    queryKey: ['corpus', userId, language],
    queryFn: () => corpusRepo.listAll(userId!, language!),
    enabled: Boolean(userId && language),
  })
}

export function useSaveCorpusSource() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (source: CorpusSource) => corpusRepo.put(source),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['corpus', userId] }),
  })
}

/** Deletes the source and any audio behind it — nothing is left orphaned in storage. */
export function useDeleteCorpusSource() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (source: CorpusSource) => {
      if (source.recordingId) await removeRecording(userId!, source.recordingId)
      await corpusRepo.remove(source.id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['corpus', userId] })
      void queryClient.invalidateQueries({ queryKey: ['recordings', userId] })
    },
  })
}

/**
 * Drops the audio but keeps the transcript. These are recordings of the learner's
 * private life; once the words are counted the audio has served its purpose.
 */
export function useDiscardCorpusAudio() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (source: CorpusSource) => {
      if (source.recordingId) await removeRecording(userId!, source.recordingId)
      await corpusRepo.put({ ...source, recordingId: null, updatedAt: Date.now() })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['corpus', userId] })
      void queryClient.invalidateQueries({ queryKey: ['recordings', userId] })
    },
  })
}

/** recordingRepo.remove needs the row (for its storage path), not just the id. */
async function removeRecording(userId: string, recordingId: string): Promise<void> {
  const recording = await recordingRepo.get(userId, recordingId)
  if (recording) await recordingRepo.remove(recording)
}
