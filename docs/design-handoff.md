# Waypoint — Design Handoff

A brief for redesigning Waypoint's visual identity and UI. The app is functional and feature-complete for its MVP; what it needs now is a visual language worthy of its concept.

---

## 1. What Waypoint is

**Waypoint is a language-learning session planner and accountability companion** built on Ameer Corro's "Roadtrip Method." It deliberately teaches nothing itself — no lessons, no grammar drills, no tutors. Instead it structures, times, and tracks the learner's own practice, and keeps them honest about the two things that actually move the needle: doing **output** (speaking, writing) and not just comfortable **input** (watching, reading), and taking real **breaks**.

The method's three pillars, which structure everything in the app:

| Pillar | Meaning | In the app |
|---|---|---|
| **Input** | Comprehensible exposure: immersion media, courses, flashcards | Flashcard SRS, immersion/course logging |
| **Output** | Producing the language: speaking, writing, conversation | Story-speaking recorder + review workbench, writing editor, conversation logging |
| **Maintenance** | The human machine: rest, breaks, motivation | Enforced break timers, sleep log, the user's personal "why" resurfaced at key moments |

**The name:** a waypoint is a stop on a route — you know where you're going (fluency), and the app marks and paces the stops along the way. The learner's personal "why" (their intention, written at onboarding) is the destination entered into the GPS.

**Platform:** responsive web app (PWA, installable), mobile-first but heavily used on desktop during study sessions. Users are self-directed language learners, typically solo, studying in 90-minute sessions.

---

## 2. Core user flows

### First run
1. Sign up (email/password or magic link) → forced onboarding: name, target language, and their **intention** — a personal "why I'm learning this," written in their own words. The app won't proceed without it. This text is sacred: it reappears at session starts and during breaks.

### The daily loop (the heart of the app)
1. **Today screen** — greeting, intention card, minutes-per-pillar for today, sleep-log nag if missing, "Plan a session" CTA (or "Resume session" if one is live).
2. **Plan a session** — each ~90-minute block is exactly **30 min of one Input activity + 60 min of one Output activity** (user picks each from 3 options; output gets double time because output is what matters). One or more blocks per session.
3. **Session runner** (full-screen, no navigation chrome — protecting focus):
   - Start screen shows the user's intention before the timer starts.
   - Block timer ring counts down; the block has two "legs": Input first, then Output. A leg indicator (Input → Output pills) shows where you are.
   - When the input leg ends, a **full-screen interruption** demands the switch to output ("Input fills the tank, output moves you down the road").
   - The output leg embeds the actual exercise:
     - **Story speaking**: record yourself telling a story (~10 min) → then, still in-session, the **three-column review workbench**: transcribe what you said (auto-drafted by Whisper), write what you *meant* to say, get AI corrections of the natural phrasing, and mint flashcards from your mistakes (misused words, missing idioms).
     - **Writing**: a minimal prompted editor (suggested prompt, shuffle, or your own topic).
     - **Conversation**: a nudge to call your tutor/partner.
   - Between blocks: **enforced break** — full-screen amber view, countdown, the user's intention shown, and the only escape is holding a button for 5 seconds ("skips" are counted and shown back to the user).
   - Completion screen: blocks done, focused minutes, breaks skipped → activities are logged.
4. **Flashcard review** (`/review`) — classic SRS flow: due + new cards, grade again/hard/good/easy. Cards born from story reviews carry their origin.
5. **Logs** — three tabs mirroring the pillars: **Input** (quick-log immersion/course, course tracker, history), **Output** (quick-log conversation/writing, story recordings with review status badges, history), **Rest** (sleep log).
6. **Settings** — block/break durations, cards per day, edit intention (history kept), data export, sign out.

### The review workbench (signature feature)
Route `/recordings/:id/review`, also embedded in the runner. Three editable columns per utterance — **What you said / What you meant / The right way** — with an audio player, AI-assist buttons, and one-tap flashcard chips. This is the app's most distinctive surface and deserves distinctive design treatment: it's where mistakes become material.

---

## 3. Screen inventory

| Route | Screen | Notes |
|---|---|---|
| `/login` | Auth | Email/password + magic link |
| `/onboarding` | Intention setup | Blocking first-run |
| `/` | Today | Dashboard: intention, pillar minutes, CTAs |
| `/plan` | Session builder | Input picker + Output picker per block |
| `/session/:id` | Runner | Full-screen; planned/active/break/complete states; embeds exercises |
| `/review` | Flashcards | Card flip + 4 grade buttons |
| `/decks`, `/decks/:id` | Deck management | Manual word entry |
| `/recordings/:id/review` | Story review workbench | Three columns + audio + AI assists |
| `/logs` | Logs | Input / Output / Rest tabs |
| `/settings` | Settings | Forms |

Navigation: bottom tab bar (mobile) / sidebar (desktop) with Today, Review, Logs, Settings. Runner and workbench intentionally sit outside the tab chrome.

---

## 4. Current visual state (what you're replacing)

- **Stack:** Tailwind CSS 4 (tokens via `@theme` in `src/index.css`), React. No component library — everything is hand-rolled utility classes, so restyling is unconstrained.
- **Current look:** functional but generic. Teal (`#0f766e` family) primary on stone/off-white; sky-blue = input, violet = output, emerald/amber = maintenance/breaks; rounded-xl cards everywhere; emoji as icons (🏠 🃏 📓 ⚙️ 🏁 📢); system font stack.
- **Icons/logo:** placeholder — a rough teal SVG squiggle-road favicon and solid-color PWA icons ([public/favicon.svg](../public/favicon.svg), `pwa-192x192.png`, `pwa-512x512.png` — both need real artwork).

## 5. Design direction (the ask)

**Lean into the roadtrip.** The metaphor is baked into the product's DNA but invisible in the UI. Ideas the design should explore (not prescriptions):

- **Journey/route motifs:** session blocks as legs of a route; the block timer as distance-to-next-stop; the Input → Output transition as a fork or a highway interchange; completion as arriving at a waypoint marker. A session summary could read like a trip odometer (focused minutes = miles).
- **Waypoint identity:** a mark that reads as a map pin / route node / milestone. The name should feel like navigation, not gamification.
- **Breaks as rest stops:** the enforced break screen is a "scenic overlook / rest area" — it's the one screen that should feel expansive and calm rather than urgent.
- **The intention as destination:** wherever the user's "why" appears (session start, breaks, Today), treat it typographically like a destination plaque — it's the emotional core of the app.
- **Streaks/progress as an atlas**, not a to-do list: days studied could accumulate like stamps or route segments on a map.
- **Tone:** warm, encouraging, a little adventurous. Not corporate LMS, not Duolingo-cute. Think vintage road atlas, national-park signage, highway typography (think: route shields, mile markers) — filtered through a clean modern UI.

**Constraints:**
- Must stay Tailwind-token friendly (colors/fonts land in `@theme`); no heavy illustration dependencies per screen.
- Mobile-first; the runner and break screens are used at arm's length — big type, high contrast.
- The workbench is dense (3 columns of editable text on desktop, stacked on mobile) — clarity beats decoration there.
- Keep the pillar color-coding concept (input vs output vs rest need instant visual distinction), but the specific hues are open.
- PWA icon set + favicon needed (192/512 + maskable).
- Existing semantics to preserve: enforced-break friction must *feel* like friction; the input→output interruption must be impossible to miss.

## 6. Voice & copy notes

Current copy already leans on the metaphor in places — keep or improve: "Set your destination" (onboarding), "fuel for the roadtrip" (sleep), "Input fills the tank, but output is what moves you down the road" (transition nudge), "Break's over 🎒". The intention resurfacing should always feel personal, never nagging.

## 7. What design should NOT change

- The flow structure (input before output, 1/3–2/3 time split, enforced breaks, hold-to-skip friction).
- The three-column workbench's column order and editability.
- Self-review philosophy: no scores, no grades on speaking — the user judges their own recordings.
