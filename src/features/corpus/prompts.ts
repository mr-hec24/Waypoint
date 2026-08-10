// Conversation starters for the corpus recorder, in the learner's NATIVE language.
//
// Two deliberate choices:
//  - Static and curated, not generated. No latency, no cost, and prompt quality is the
//    whole game — a vague prompt produces thirty seconds of "um, well, I guess".
//  - Each domain mixes past narrative, present habitual, and hypothetical, so the
//    transcript contains varied verb forms and modals instead of one flat tense. A list
//    built only from "what I do every day" has no past tense in it at all.
//
// They are written for one speaker. That is not a limitation: Whisper does no speaker
// diarization, so a solo answer is clean data, twice as dense per minute as two-way
// conversation, and involves nobody who hasn't agreed to be recorded.

export interface CorpusPrompt {
  id: string
  domain: string
  text: string
}

export const CORPUS_PROMPTS: CorpusPrompt[] = [
  // ---------- work ----------
  { id: 'work-1', domain: 'work', text: 'Walk me through yesterday, from waking up to going to bed.' },
  { id: 'work-2', domain: 'work', text: "Explain what you actually do all day to someone who's never heard of your job." },
  { id: 'work-3', domain: 'work', text: 'Tell me about a time something went badly wrong at work and how you sorted it out.' },
  { id: 'work-4', domain: 'work', text: 'If you could change one thing about your job tomorrow, what would it be and why?' },
  { id: 'work-5', domain: 'work', text: 'Describe the people you work with — who you like, who you avoid, who you go to for help.' },
  { id: 'work-6', domain: 'work', text: 'How did you end up in this job? Start from your first ever paid work.' },
  { id: 'work-7', domain: 'work', text: 'Talk through what a really good day at work looks like versus a really bad one.' },

  // ---------- family ----------
  { id: 'family-1', domain: 'family', text: 'Describe the people in your family — who they are, what they are like.' },
  { id: 'family-2', domain: 'family', text: 'Tell me about the last time your whole family was in one room.' },
  { id: 'family-3', domain: 'family', text: 'What did your family do differently from other families you knew growing up?' },
  { id: 'family-4', domain: 'family', text: 'Talk about someone in your family you argue with, and what you argue about.' },
  { id: 'family-5', domain: 'family', text: 'How do you usually keep in touch? Who calls who, and how often?' },
  { id: 'family-6', domain: 'family', text: 'If you could ask a relative who has passed away one question, what would it be?' },

  // ---------- kids ----------
  { id: 'kids-1', domain: 'kids', text: 'Talk me through a weekday morning with the kids, minute by minute.' },
  { id: 'kids-2', domain: 'kids', text: 'What is the hardest part of the day, and what makes it hard?' },
  { id: 'kids-3', domain: 'kids', text: 'Tell me about something one of them said or did recently that surprised you.' },
  { id: 'kids-4', domain: 'kids', text: 'What do bedtime and mealtimes normally look like in your house?' },
  { id: 'kids-5', domain: 'kids', text: 'What do you hope will be different for them than it was for you?' },
  { id: 'kids-6', domain: 'kids', text: 'Describe a trip or outing with them that did not go to plan.' },

  // ---------- food ----------
  { id: 'food-1', domain: 'food', text: 'What did you eat yesterday? All of it, including the things you snacked on.' },
  { id: 'food-2', domain: 'food', text: 'Teach me to cook something you make often, step by step, as if I am standing next to you.' },
  { id: 'food-3', domain: 'food', text: 'Describe doing your food shopping — where you go, what you buy, what it costs.' },
  { id: 'food-4', domain: 'food', text: 'Tell me about the best meal you have ever had and why it stuck with you.' },
  { id: 'food-5', domain: 'food', text: 'What do you eat when you cannot be bothered to cook?' },
  { id: 'food-6', domain: 'food', text: 'If you had to eat one cuisine for a year, which and why? What would you miss?' },

  // ---------- home ----------
  { id: 'home-1', domain: 'home', text: 'Give me a tour of where you live, room by room.' },
  { id: 'home-2', domain: 'home', text: 'What chores are on your list this week, and which one do you keep putting off?' },
  { id: 'home-3', domain: 'home', text: 'Tell me about something in your home that broke and what you did about it.' },
  { id: 'home-4', domain: 'home', text: 'How did you find this place, and what was moving in like?' },
  { id: 'home-5', domain: 'home', text: 'If you had money to change one thing about your home, what would you do?' },
  { id: 'home-6', domain: 'home', text: 'Describe your morning routine at home, from alarm to leaving.' },

  // ---------- commute ----------
  { id: 'commute-1', domain: 'commute', text: 'Describe your journey to work or school, turn by turn.' },
  { id: 'commute-2', domain: 'commute', text: 'Tell me about a journey that went wrong — delays, breakdowns, missed connections.' },
  { id: 'commute-3', domain: 'commute', text: 'How do you normally get around your city, and what annoys you about it?' },
  { id: 'commute-4', domain: 'commute', text: 'Talk about learning to drive, or deciding not to.' },
  { id: 'commute-5', domain: 'commute', text: 'If you could redesign transport where you live, what would you fix first?' },

  // ---------- money ----------
  { id: 'money-1', domain: 'money', text: 'Talk through what you spent money on this month.' },
  { id: 'money-2', domain: 'money', text: 'Describe your bills — what goes out, when, and to whom.' },
  { id: 'money-3', domain: 'money', text: 'Tell me about the biggest thing you have ever bought and how you decided.' },
  { id: 'money-4', domain: 'money', text: 'Are you saving for anything? What would you do with an unexpected windfall?' },
  { id: 'money-5', domain: 'money', text: 'What did you learn about money growing up, and has it stuck?' },

  // ---------- health ----------
  { id: 'health-1', domain: 'health', text: 'Describe the last time you were properly ill and how it went.' },
  { id: 'health-2', domain: 'health', text: 'Walk me through a visit to the doctor or dentist, from booking to leaving.' },
  { id: 'health-3', domain: 'health', text: 'How do you sleep? Talk about your evenings and your mornings.' },
  { id: 'health-4', domain: 'health', text: 'What do you do when you are stressed, and does it actually help?' },
  { id: 'health-5', domain: 'health', text: 'If a doctor gave you one thing to change about your habits, what would it be?' },

  // ---------- exercise ----------
  { id: 'exercise-1', domain: 'exercise', text: 'Describe a typical workout or training session in detail.' },
  { id: 'exercise-2', domain: 'exercise', text: 'How did you get into your sport, and what was being a beginner like?' },
  { id: 'exercise-3', domain: 'exercise', text: 'Tell me about an injury, a bad session, or a time you wanted to quit.' },
  { id: 'exercise-4', domain: 'exercise', text: 'Explain the rules of a sport you follow to someone who has never seen it.' },
  { id: 'exercise-5', domain: 'exercise', text: 'What would you like to be able to do physically in a year?' },

  // ---------- hobbies ----------
  { id: 'hobbies-1', domain: 'hobbies', text: 'Explain your hobby to someone who knows nothing about it — including the jargon.' },
  { id: 'hobbies-2', domain: 'hobbies', text: 'How did you get into it? Tell the story from the beginning.' },
  { id: 'hobbies-3', domain: 'hobbies', text: 'Describe the last time you did it, in as much detail as you can.' },
  { id: 'hobbies-4', domain: 'hobbies', text: 'What gear or equipment do you use, and what would you upgrade?' },
  { id: 'hobbies-5', domain: 'hobbies', text: 'If you had a free weekend and no obligations, what would you actually do?' },

  // ---------- friends ----------
  { id: 'friends-1', domain: 'friends', text: 'Describe your closest friends — how you met, what they are like.' },
  { id: 'friends-2', domain: 'friends', text: 'What did you do the last time you saw them?' },
  { id: 'friends-3', domain: 'friends', text: 'Tell me about a friendship that faded, and why you think it did.' },
  { id: 'friends-4', domain: 'friends', text: 'How do you usually make plans, and who is bad at replying?' },
  { id: 'friends-5', domain: 'friends', text: 'Tell me a story about your friends that you have told before.' },

  // ---------- tech ----------
  { id: 'tech-1', domain: 'tech', text: 'What is on your phone? Talk through the apps you actually open.' },
  { id: 'tech-2', domain: 'tech', text: 'Describe the last show or video you watched — the plot, the people in it.' },
  { id: 'tech-3', domain: 'tech', text: 'Tell me about a time technology failed you and what you did.' },
  { id: 'tech-4', domain: 'tech', text: 'Explain something you use every day to someone from fifty years ago.' },
  { id: 'tech-5', domain: 'tech', text: 'How much time do you spend online, and would you change it?' },

  // ---------- weekend ----------
  { id: 'weekend-1', domain: 'weekend', text: 'What did you do last weekend? Start Friday evening.' },
  { id: 'weekend-2', domain: 'weekend', text: 'Describe your best holiday — where, who with, what happened.' },
  { id: 'weekend-3', domain: 'weekend', text: 'Tell me about a trip that went wrong.' },
  { id: 'weekend-4', domain: 'weekend', text: 'Where would you go if you had two free weeks and a decent budget?' },
  { id: 'weekend-5', domain: 'weekend', text: 'What are your plans for the next few weeks?' },
  { id: 'weekend-6', domain: 'weekend', text: 'Describe a place you know well enough to give someone directions around.' },

  // ---------- opinions ----------
  { id: 'opinions-1', domain: 'opinions', text: 'What is something most people around you believe that you disagree with?' },
  { id: 'opinions-2', domain: 'opinions', text: 'Talk about a news story you have been following and what you make of it.' },
  { id: 'opinions-3', domain: 'opinions', text: 'Describe an argument you had recently — both sides, fairly.' },
  { id: 'opinions-4', domain: 'opinions', text: 'What has changed most about where you live in the last ten years?' },
  { id: 'opinions-5', domain: 'opinions', text: 'Persuade me of something you actually believe. Take your time.' },
  { id: 'opinions-6', domain: 'opinions', text: 'What advice do you give people that you do not follow yourself?' },
]

export function promptsForDomains(domains: string[]): CorpusPrompt[] {
  if (domains.length === 0) return CORPUS_PROMPTS
  const wanted = new Set(domains)
  const matching = CORPUS_PROMPTS.filter((p) => wanted.has(p.domain))
  return matching.length > 0 ? matching : CORPUS_PROMPTS
}

/**
 * Picks the next prompt, preferring domains the learner has spoken least about —
 * topic breadth is what makes the list theirs, so the recorder should steer toward gaps.
 */
export function nextPrompt(
  domains: string[],
  tokensByDomain: Record<string, number>,
  usedPromptIds: string[],
): CorpusPrompt | null {
  const pool = promptsForDomains(domains)
  const used = new Set(usedPromptIds)
  const unused = pool.filter((p) => !used.has(p.id))
  // Every prompt used at least once — start round two rather than stalling.
  const candidates = unused.length > 0 ? unused : pool
  if (candidates.length === 0) return null

  let best = candidates[0]
  let bestTokens = Infinity
  for (const prompt of candidates) {
    const tokens = tokensByDomain[prompt.domain] ?? 0
    if (tokens < bestTokens) {
      best = prompt
      bestTokens = tokens
    }
  }
  return best
}
