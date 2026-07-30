import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { useActiveLanguage } from './profile'
import { libraryRepo } from '../supabase/libraryRepo'
import type { LibraryItem } from '../../domain/entities'

/** Every library item in the active journey, oldest first. */
export function useLibraryItems() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  return useQuery({
    queryKey: ['library', userId, language],
    queryFn: () => libraryRepo.listAll(userId!, language!),
    enabled: Boolean(userId && language),
  })
}

/** The single starred "focus" item for the active journey, or undefined if none. */
export function useStarredLibraryItem() {
  const { data: items, ...rest } = useLibraryItems()
  return { data: items?.find((i) => i.starred), ...rest }
}

export function useSaveLibraryItem() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: LibraryItem) => libraryRepo.put(item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library', userId] }),
  })
}

export function useDeleteLibraryItem() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => libraryRepo.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library', userId] }),
  })
}

/** Records one more pass through an item (manual "log a rewatch"): bumps the counter + timestamp. */
export function useLogLibraryRepetition() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: LibraryItem) =>
      libraryRepo.put({
        ...item,
        repetitions: item.repetitions + 1,
        lastRepAt: Date.now(),
        updatedAt: Date.now(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library', userId] }),
  })
}

/** Stars exactly one item for the active journey, clearing any previous star. */
export function useSetStarredLibraryItem() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => libraryRepo.setStarred(userId!, language!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['library', userId] }),
  })
}
