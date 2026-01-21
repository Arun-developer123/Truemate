// src/app/blog/posts.ts
export type Section = {
  heading?: string;
  paragraphs: string[];
};

export type Post = {
  id: number;
  title: string;
  author: string;
  date: string;    // human friendly (not used for sorting)
  isoDate: string; // ISO for sorting
  readingMinutes: number;
  categories: string[];
  excerpt: string;
  sections: Section[];
  conclusion?: string;
};

export const POSTS: Post[] = [
  {
    id: 1,
    title: "The Psychology of True Connections: Quality > Quantity",
    author: "Team Truemate",
    date: "August 15, 2025",
    isoDate: "2025-08-15",
    readingMinutes: 7,
    categories: ["Relationships", "Psychology"],
    excerpt:
      "Why most connections feel shallow — and three practical rules to deepen the relationships that matter.",
    sections: [
      {
        heading: "Why most connections feel shallow",
        paragraphs: [
          "In an always-on world, we confuse activity with intimacy. A barrage of messages, likes, and short replies creates the illusion of closeness — but not the feeling that someone truly understands you.",
          "Human brains are wired to respond to storytelling, validation, and sustained attention. Micro-interactions (emoji, short replies) rarely trigger the emotional responses necessary to build long-term bonds.",
        ],
      },
      {
        heading: "Three practical rules to deepen any relationship",
        paragraphs: [
          "Ask a follow-up question that reveals context. Instead of ‘How was your day?’, try ‘What part of today surprised you most?’ — the answer tells a story.",
          "Name the feeling. If someone says, ‘Work was rough,’ respond with, ‘Sounds exhausting — are you feeling drained or frustrated?’ Naming helps people organize emotion.",
          "Swap one meaningful detail every day. It can be small: a short memory, a personal annoyance, a tiny win. These details build a shared history.",
        ],
      },
      {
        heading: "The neurochemical truth (simple, not clinical)",
        paragraphs: [
          "Moments of being heard increase oxytocin and lower stress responses. That’s why feeling seen matters more than frequency of contact.",
          "Design your interactions to invite stories, not checkboxes.",
        ],
      },
    ],
    conclusion:
      "Start today: replace one generic check-in with a curious, open question. See how the tone of the relationship changes in a week.",
  },

  {
    id: 2,
    title: "How AI Companions Can Help — And Where They Must Stop",
    author: "Team Truemate",
    date: "August 18, 2025",
    isoDate: "2025-08-18",
    readingMinutes: 6,
    categories: ["AI", "Wellbeing"],
    excerpt:
      "AI friends lower the barrier to self-reflection — but they must be designed responsibly to complement human connection.",
    sections: [
      {
        heading: "AI companions: the promise",
        paragraphs: [
          "AI friends are consistent, non-judgmental, and available 24/7. For many, they lower the activation energy needed to reflect — a safe first step toward expressing feelings.",
          "When designed responsibly, these companions help people practice vulnerability, rehearse tough conversations, and keep mental health routines consistent.",
        ],
      },
      {
        heading: "Real limitations you must accept",
        paragraphs: [
          "AI doesn’t replace human empathy. It models empathetic responses, but it cannot share lived human experience.",
          "Dependence is real. If AI becomes the primary source of validation, it can stunt real-world social confidence. Use AI as a scaffold, not a crutch.",
        ],
      },
      {
        heading: "Design rules for healthy AI companions",
        paragraphs: [
          "Transparency: make it clear the user is interacting with an AI.",
          "Escalation: detect serious risk signals and suggest human help or emergency resources.",
          "Balance: encourage real-world interactions and set gentle limits on auto-sent messages to avoid replacement of human contact.",
        ],
      },
    ],
    conclusion:
      "AI can be a powerful tool for emotional growth — when built to augment human connection rather than replace it.",
  },

  {
    id: 3,
    title: "Productivity Secrets Nobody Talks About: Energy, Not Just Time",
    author: "Team Truemate",
    date: "August 20, 2025",
    isoDate: "2025-08-20",
    readingMinutes: 8,
    categories: ["Productivity", "Habits"],
    excerpt:
      "Stop optimizing minutes — start optimizing energy. Simple energy-first routines beat complex schedules every time.",
    sections: [
      {
        heading: "The myth of time optimization",
        paragraphs: [
          "Most productivity advice focuses on scheduling minutes. But minutes are indifferent: your energy levels and mental state determine whether minutes are used well.",
          "High-output work requires focus windows, low-distraction context, and psychological rewards — not just a color-coded calendar.",
        ],
      },
      {
        heading: "A simple energy-first framework",
        paragraphs: [
          "Map your energy curve: track when you feel sharp vs. slow during the day for one week.",
          "Slot demanding tasks into your high-energy blocks and creative tasks into the next best slot.",
          "Use micro-rewards to maintain momentum: 10 minutes of music, a stretch, a small snack.",
        ],
      },
      {
        heading: "The surprising role of micro-breaks",
        paragraphs: [
          "Short, intentional breaks prevent cognitive fatigue. A 7–10 minute walk or a 3-minute breathing exercise recharges focus far better than another coffee.",
          "Micro-breaks are habitized rewards: they help your brain link progress to pleasure, making consistency sustainable.",
        ],
      },
    ],
    conclusion:
      "Optimize for energy and emotional state first; time will naturally become your ally.",
  },

  {
    id: 4,
    title: "Emotional Intelligence in 2025: The Skill That Outranks IQ",
    author: "Team Truemate",
    date: "August 23, 2025",
    isoDate: "2025-08-23",
    readingMinutes: 6,
    categories: ["Leadership", "EQ"],
    excerpt:
      "EQ is the competitive advantage of the modern workplace — and it’s learnable. Small daily experiments compound into meaningful change.",
    sections: [
      {
        heading: "Why EQ matters more than ever",
        paragraphs: [
          "As automation handles analytical tasks, human roles increasingly require soft skills: empathy, conflict-resolution, and nuanced communication.",
          "Leaders with high EQ create trust, reduce churn, and build teams that adapt fast.",
        ],
      },
      {
        heading: "Three ways to build EQ (practical)",
        paragraphs: [
          "Practice reflective listening: repeat the gist of what someone said before offering your view.",
          "Journal a single emotional insight daily: what moved you today and why?",
          "Seek feedback on how others experience your tone — not the facts you share, but the feeling your message creates.",
        ],
      },
      {
        heading: "Small experiments that compound",
        paragraphs: [
          "Try a 7-day EQ challenge: each day, do one thing (ask a deeper question, name a feeling, apologize succinctly). Track how relationships change.",
        ],
      },
    ],
    conclusion:
      "EQ is learnable. Start small, be consistent, and watch your relationships and career accelerate.",
  },
];
