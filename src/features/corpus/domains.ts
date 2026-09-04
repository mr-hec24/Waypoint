// The slices of life a learner actually talks about. Picking these up front is what
// makes the starter list personal: the top ~200 words fall out of anyone's speech,
// but "invoice", "nappy", and "deadlift" only appear if the right topic came up.

export interface LifeDomain {
  slug: string
  label: string
  hint: string
}

export const LIFE_DOMAINS: LifeDomain[] = [
  { slug: 'work', label: 'Work', hint: 'your job, colleagues, meetings' },
  { slug: 'family', label: 'Family', hint: 'partner, parents, siblings' },
  { slug: 'kids', label: 'Kids', hint: 'school runs, bedtime, childcare' },
  { slug: 'food', label: 'Food & cooking', hint: 'meals, recipes, groceries' },
  { slug: 'home', label: 'Home & chores', hint: 'cleaning, repairs, the flat' },
  { slug: 'commute', label: 'Getting around', hint: 'commute, driving, transport' },
  { slug: 'money', label: 'Money', hint: 'bills, rent, spending, saving' },
  { slug: 'health', label: 'Health', hint: 'doctors, sleep, feeling ill' },
  { slug: 'exercise', label: 'Exercise', hint: 'training, sport, the gym' },
  { slug: 'hobbies', label: 'Hobbies', hint: 'what you do for fun' },
  { slug: 'friends', label: 'Friends', hint: 'plans, gossip, catching up' },
  { slug: 'tech', label: 'Tech & online', hint: 'phone, apps, what you watch' },
  { slug: 'weekend', label: 'Plans & travel', hint: 'weekends, holidays, trips' },
  { slug: 'opinions', label: 'Opinions', hint: 'news, arguments, what you think' },
]

export const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(
  LIFE_DOMAINS.map((d) => [d.slug, d.label]),
)

export function domainLabel(slug: string): string {
  return DOMAIN_LABEL[slug] ?? 'Other'
}
