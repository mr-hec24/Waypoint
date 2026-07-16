import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { useActiveLanguage } from './profile'
import { deckRepo } from '../supabase/deckRepo'
import { wordRepo, reviewLogRepo } from '../supabase/wordRepo'
import { sm2 } from '../../domain/srs/sm2'
import type { Deck, SrsGrade, Word } from '../../domain/entities'

export function useDecks() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  return useQuery({
    queryKey: ['decks', userId, language],
    queryFn: () => deckRepo.listAll(userId!, language!),
    enabled: Boolean(userId && language),
  })
}

export function useSaveDeck() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deck: Deck) => deckRepo.put(deck),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['decks', userId] }),
  })
}

export function useDeleteDeck() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deckRepo.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['decks', userId] }),
  })
}

export function useDeckWords(deckId: string | undefined) {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['words', userId, deckId],
    queryFn: () => wordRepo.listByDeck(userId!, deckId!),
    enabled: Boolean(userId && deckId),
  })
}

/** Every word in the active journey, across decks — for source-based filtering. */
export function useLanguageWords() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  return useQuery({
    queryKey: ['words', userId, 'language', language],
    queryFn: () => wordRepo.listAll(userId!, { language: language! }),
    enabled: Boolean(userId && language),
  })
}

export function useSaveWord() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (word: Word) => wordRepo.put(word),
    onSuccess: (_, word) => {
      void queryClient.invalidateQueries({ queryKey: ['words', userId, word.deckId] })
      void queryClient.invalidateQueries({ queryKey: ['reviewQueue', userId] })
    },
  })
}

export function useDeleteWord() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (word: Word) => wordRepo.remove(word.id),
    onSuccess: (_, word) => {
      void queryClient.invalidateQueries({ queryKey: ['words', userId, word.deckId] })
      void queryClient.invalidateQueries({ queryKey: ['reviewQueue', userId] })
    },
  })
}

/** Due reviews first, then new cards up to the daily allowance — for the active journey. */
export function useReviewQueue(newCardsPerDay: number) {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  return useQuery({
    queryKey: ['reviewQueue', userId, language],
    queryFn: async () => {
      const due = await wordRepo.dueForReview(userId!, language!, Date.now(), 200)
      const fresh = await wordRepo.newCards(userId!, language!, newCardsPerDay)
      return [...due, ...fresh]
    },
    enabled: Boolean(userId && language),
    staleTime: 0,
  })
}

/** Applies SM-2, persists the word, and appends to the review log. */
export function useGradeWord() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ word, grade }: { word: Word; grade: SrsGrade }) => {
      const now = Date.now()
      const next = sm2(word.srs, grade, now)
      const updated: Word = { ...word, srs: next, updatedAt: now }
      await wordRepo.put(updated)
      await reviewLogRepo.append({
        id: crypto.randomUUID(),
        userId: userId!,
        createdAt: now,
        updatedAt: now,
        wordId: word.id,
        reviewedAt: now,
        grade,
        prevIntervalDays: word.srs.intervalDays,
        newIntervalDays: next.intervalDays,
        ease: next.ease,
      })
      return updated
    },
    onSettled: () => {
      // The active review screen manages its own queue; refresh counts elsewhere.
      void queryClient.invalidateQueries({ queryKey: ['reviewQueue', userId], refetchType: 'none' })
    },
  })
}
