import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/AuthProvider'
import { useActiveLanguage } from './profile'
import { activityLogRepo, courseRepo, sleepLogRepo } from '../supabase/logRepos'
import type { ActivityLog, Course, SleepLog } from '../../domain/entities'

export function todayBounds(): { from: number; to: number } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return { from: start.getTime(), to: start.getTime() + 24 * 60 * 60 * 1000 - 1 }
}

export function localDateString(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useActivityLogs(fromMs: number, toMs: number) {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  return useQuery({
    queryKey: ['activityLogs', userId, language, fromMs, toMs],
    queryFn: () => activityLogRepo.byDateRange(userId!, language!, fromMs, toMs),
    enabled: Boolean(userId && language),
  })
}

export function useSaveActivityLog() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (log: ActivityLog) => activityLogRepo.put(log),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activityLogs', userId] }),
  })
}

export function useDeleteActivityLog() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => activityLogRepo.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activityLogs', userId] }),
  })
}

export function useSleepLogs(limit = 14) {
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['sleepLogs', userId, limit],
    queryFn: () => sleepLogRepo.listRecent(userId!, limit),
    enabled: Boolean(userId),
  })
}

export function useSaveSleepLog() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (log: SleepLog) => sleepLogRepo.put(log),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sleepLogs', userId] }),
  })
}

export function useCourses() {
  const { userId } = useAuth()
  const language = useActiveLanguage()
  return useQuery({
    queryKey: ['courses', userId, language],
    queryFn: () => courseRepo.listAll(userId!, language!),
    enabled: Boolean(userId && language),
  })
}

export function useSaveCourse() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (course: Course) => courseRepo.put(course),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses', userId] }),
  })
}

export function useDeleteCourse() {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => courseRepo.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses', userId] }),
  })
}
