import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { useActiveLanguage } from './profile'
import { sessionRepo } from '../supabase/sessionRepo'

export function useActiveSession() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  return useQuery({
    queryKey: ['activeSession', userId, language],
    queryFn: () => sessionRepo.getActive(userId!, language!),
    enabled: Boolean(userId && language),
    staleTime: 0,
  })
}
