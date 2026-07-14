import { createBrowserRouter } from 'react-router'
import { Layout } from './Layout'
import { RequireAuth } from '../features/auth/RequireAuth'
import { RequireOnboarded } from '../features/intention/RequireOnboarded'
import { TodayScreen } from '../features/today/TodayScreen'
import { PlannerScreen } from '../features/planner/PlannerScreen'
import { RunnerScreen } from '../features/runner/RunnerScreen'
import { ReviewScreen } from '../features/flashcards/ReviewScreen'
import { DecksScreen } from '../features/flashcards/DecksScreen'
import { DeckDetailScreen } from '../features/flashcards/DeckDetailScreen'
import { LogsScreen } from '../features/logging/LogsScreen'
import { SpeakingScreen } from '../features/speaking/SpeakingScreen'
import { WritingScreen } from '../features/writing/WritingScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { LoginScreen } from '../features/auth/LoginScreen'
import { OnboardingScreen } from '../features/intention/OnboardingScreen'
import { AddLanguageScreen } from '../features/intention/AddLanguageScreen'
import { StoryReviewScreen, WritingReviewScreen } from '../features/storyReview/StoryReviewScreen'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginScreen /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <OnboardingScreen /> },
      { path: '/languages/new', element: <AddLanguageScreen /> },
      {
        element: <RequireOnboarded />,
        children: [
          // Runner is deliberately outside the tab layout: full-screen focus, no navigation.
          { path: '/session/:id', element: <RunnerScreen /> },
          // Review workbenches: focused work surfaces, also outside the tabs.
          { path: '/recordings/:recordingId/review', element: <StoryReviewScreen /> },
          { path: '/writing/:logId/review', element: <WritingReviewScreen /> },
          {
            element: <Layout />,
            children: [
              { path: '/', element: <TodayScreen /> },
              { path: '/plan', element: <PlannerScreen /> },
              { path: '/review', element: <ReviewScreen /> },
              { path: '/decks', element: <DecksScreen /> },
              { path: '/decks/:deckId', element: <DeckDetailScreen /> },
              { path: '/speaking', element: <SpeakingScreen /> },
              { path: '/writing', element: <WritingScreen /> },
              { path: '/logs', element: <LogsScreen /> },
              { path: '/settings', element: <SettingsScreen /> },
            ],
          },
        ],
      },
    ],
  },
])
