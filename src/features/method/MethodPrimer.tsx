// The method, in seven cards. Shown once during onboarding and kept at /method,
// because most of these only make sense after you've used the app for a week.

interface Card {
  label: string
  title: string
  body: string
}

const CARDS: Card[] = [
  {
    label: 'The idea',
    title: 'This app does not teach you the language',
    body: 'There are no lessons here, no grammar drills, no vocabulary quizzes written by us. What it does is structure your practice, time it, and keep score — so that the hours you put in are the right hours, in the right proportions. The learning happens in the material you choose and the mouth you open. Everything in here is scaffolding around that.',
  },
  {
    label: 'The split',
    title: 'Output is where the road actually moves',
    body: 'Every block gives a third of its time to input and two thirds to output. That feels backwards — input is comfortable, output is embarrassing — which is exactly why the split is enforced. Recognising a word when you hear it and producing it under pressure are different skills, and only one of them is speaking. You will always be tempted to watch one more episode instead. Do the talking.',
  },
  {
    label: 'Repetition',
    title: 'Watch the same thing four to seven times',
    body: 'Comprehensible input only works when the gap between what you know and what you are hearing is small. A brand new video every day keeps that gap permanently wide — you understand a third of it, get a small thrill, and learn almost nothing. Go back to the same episode. The second pass you catch the shape of it, the fourth you catch the words, the seventh you catch the jokes. That is the point where it goes in. The Library tracks your passes for exactly this reason.',
  },
  {
    label: 'Rest',
    title: 'Sleep is part of the training, not a break from it',
    body: 'Consolidation happens overnight — the vocabulary you drilled today is filed away while you sleep, and a short night undoes a good chunk of the work. A focused ninety minutes before a full night beats three hours before a bad one, reliably. This is why the app asks you to log your sleep next to your sessions instead of treating them as unrelated. If you have to choose between one more block and going to bed, go to bed.',
  },
  {
    label: 'Output',
    title: 'Speak badly on purpose, then go and look',
    body: 'Record yourself telling a story. Transcribe what actually came out. Write down what you meant to say. The gap between those two columns is your curriculum — more precisely targeted than any textbook, because it is made of the exact things you tried to say and could not. Mine that gap for cards, study them, then tell the same story again. The mistake is not a setback in this loop; it is the input.',
  },
  {
    label: 'Rhythm',
    title: 'Take the break',
    body: 'Blocks are ninety minutes and breaks are twenty, and the break screen makes you hold a button to skip it. That is deliberate. Attention does not survive being pushed straight through, and the block you steal the break from is not the one that suffers — the next one is. The app counts your skipped breaks and shows them back to you, without judgement, so you can see the pattern yourself.',
  },
  {
    label: 'Motivation',
    title: 'Your destination is a tool, not a decoration',
    body: 'The reason you wrote down at the start gets shown back to you when you begin a session and again during breaks. Not to be sentimental — because motivation is not a fixed quantity you either have or lack, it is a thing that dips on specific Tuesdays for specific reasons. On those days a concrete sentence in your own handwriting about why you started does more than discipline does. You can rewrite it whenever it stops being true.',
  },
]

export function MethodPrimer() {
  return (
    <ol className="flex flex-col gap-3">
      {CARDS.map((card, i) => (
        <li key={card.title} className="rounded-xl border border-stone-200 bg-card p-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[13px] font-bold text-stone-400">{i + 1}</span>
            <span className="text-[10.5px] font-extrabold tracking-[.2em] text-stone-500 uppercase">
              {card.label}
            </span>
          </div>
          <h3 className="font-display mt-1.5 text-[19px] leading-snug font-bold text-ink">
            {card.title}
          </h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-stone-600">{card.body}</p>
        </li>
      ))}
    </ol>
  )
}
