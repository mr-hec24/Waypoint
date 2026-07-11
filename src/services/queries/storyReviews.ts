import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { storyReviewRepo } from '../supabase/storyReviewRepo'
import type { StoryReview } from '../../domain/entities'

export function useStoryReview(recordingId: string | undefined) {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['storyReview', userId, recordingId],
    queryFn: () => storyReviewRepo.getByRecording(userId!, recordingId!),
    enabled: Boolean(userId && recordingId),
  })
}

export function useWritingReview(writingLogId: string | undefined) {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['storyReview', userId, writingLogId],
    queryFn: () => storyReviewRepo.getByWritingLog(userId!, writingLogId!),
    enabled: Boolean(userId && writingLogId),
  })
}

/** All reviews for the user — drives the draft/reviewed badges on the recordings list. */
export function useStoryReviews() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['storyReviews', userId],
    queryFn: () => storyReviewRepo.listAll(userId!),
    enabled: Boolean(userId),
  })
}

export function useSaveStoryReview() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (review: StoryReview) => storyReviewRepo.put(review),
    onSuccess: (_, review) => {
      // Reviews are keyed by their source id (recording OR writing log).
      queryClient.setQueryData(
        ['storyReview', userId, review.recordingId ?? review.writingLogId],
        review,
      )
      void queryClient.invalidateQueries({ queryKey: ['storyReviews', userId] })
    },
  })
}
