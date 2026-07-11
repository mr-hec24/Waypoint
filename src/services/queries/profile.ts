import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { profileRepo } from '../supabase/profileRepo'
import { activeJourney, type LanguageJourney, type Profile } from '../../domain/entities'

export function useProfile() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepo.get(userId!),
    enabled: Boolean(userId),
  })
}

/** The language currently being driven — undefined until the profile loads. */
export function useActiveLanguage(): string | undefined {
  const { data: profile } = useProfile()
  return profile?.activeLanguage || undefined
}

export function useActiveJourney(): LanguageJourney | null {
  const { data: profile } = useProfile()
  return profile ? activeJourney(profile) : null
}

export function useUpdateProfile() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Parameters<typeof profileRepo.update>[1]) =>
      profileRepo.update(userId!, patch),
    onSuccess: (_, patch) => {
      queryClient.setQueryData<Profile | null>(['profile', userId], (prev) =>
        prev ? { ...prev, ...patch, updatedAt: Date.now() } : prev,
      )
      void queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    },
  })
}
