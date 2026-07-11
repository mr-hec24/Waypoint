# Manual verification checklist

Run through this on desktop and a mobile viewport (or a real phone) after changes.

## Setup
- [ ] `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] `supabase/migrations/0001_init.sql` applied to the project (SQL editor or `supabase db push`)
- [ ] `npm run dev` starts without console errors

## Auth & onboarding
- [ ] Sign up with a fresh email → profile row auto-created → redirected to onboarding
- [ ] Onboarding blocks the app until name, language, and intention are saved
- [ ] Sign out from Settings → redirected to /login
- [ ] RLS: with two accounts in two browsers, neither sees the other's decks/logs

## Flashcards
- [ ] Create a deck, add 3+ words
- [ ] Review: new cards appear, grading again/hard/good/easy advances the queue
- [ ] "Again" cards return at the end of the same sitting
- [ ] After grading, `review_logs` rows exist (Supabase table editor)

## Session engine
- [ ] Plan a session (2 short blocks for testing, e.g. 1-2 min via Settings) → Start
- [ ] Intention shown on the start screen
- [ ] Block timer counts down; hard-refresh mid-block → remaining time still correct
- [ ] Close the tab, reopen /session/:id → state restored
- [ ] Block elapses → break starts automatically (amber screen)
- [ ] Hold-to-skip: releasing early resets; holding 5s skips and increments the counter
- [ ] Break elapses → "Start next block" waits for the user
- [ ] Last block ends → completion screen → "Log activities & finish" writes activity_logs
- [ ] Cross-device: start on desktop, open on phone (same account) → Resume shows the session

## Logging
- [ ] Quick-log an immersion activity → appears in Logs and Today's pillar minutes
- [ ] Sleep log saves; Today's sleep prompt disappears
- [ ] Course +1 unit increments

## Audio
- [ ] Story-speaking block: record ~10s, stop → upload succeeds
- [ ] Logs → Recordings: playback works (signed URL)
- [ ] Test in Chrome and Safari (webm vs mp4 fallback)

## PWA
- [ ] Lighthouse: installable, no manifest errors
- [ ] Install on desktop Chrome and Android Chrome; standalone window with icon
- [ ] After a deploy/build change, the service worker picks up the new version
