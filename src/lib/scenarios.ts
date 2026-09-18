export interface Scenario {
  id: number;
  name: string;
  description: string;
  image: string;
  tasks: string[];
  is_ai_initiated: boolean;
  persona: string;
  avatar_voice: string;
  difficulty: "Easy" | "Medium" | "Hard";
  // UI helpers
  icon?: string;
  gradient?: string;
}

export const PRESET_SCENARIOS: Scenario[] = [
  {
    id: 0,
    name: "Meeting a Mentor",
    description:
      "You have been connected with a mentor through a professional programme. This is your first conversation with them. Their profile shows they spent ten years in product management before moving into venture capital.",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop",
    tasks: [
      "Thank them and mention that their move from product into venture capital was what made you glad to be matched with them",
      "Tell them you are two years into your career in marketing and are figuring out whether to go deeper into your field or pivot into product",
      "Ask them what made them decide to leave product management after ten years",
    ],
    is_ai_initiated: true,
    persona:
      "You are a warm, engaging mentor who enjoys sharing career wisdom. You are genuinely happy to help guide a promising marketer who is navigating a pivotal career choice.",
    avatar_voice: "coral", // mapped from leda to official OpenAI voice
    difficulty: "Hard",
    icon: "🤝",
    gradient: "from-purple-600 to-indigo-600",
  },
  {
    id: 1,
    name: "Salary & Promotion Review",
    description:
      "You have scheduled a 1-on-1 with your engineering manager, David. Over the past year, you've led critical architecture migrations and mentored junior teammates. Now you are seeking a promotion to Senior Engineer with a 15% compensation review.",
    image:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=800&auto=format&fit=crop",
    tasks: [
      "Open the meeting by stating your objective: reviewing your accomplishments and discussing a promotion to Senior Engineer",
      "Highlight two specific high-impact contributions from the past year (e.g. leading the architecture migration and mentoring junior teammates)",
      "Propose a target salary increase of 15% and ask for his perspective on the timeline and budget cycle",
    ],
    is_ai_initiated: false,
    persona: "You are David, a supportive but candid Engineering Manager. You value clarity and directness. Listen carefully to your employee's contributions, and respond honestly about the promotion and salary expectations.",
    avatar_voice: "ash",
    difficulty: "Medium",
    icon: "📈",
    gradient: "from-blue-600 to-cyan-600",
  },
  {
    id: 2,
    name: "De-escalating an Upset Client",
    description:
      "You are a Customer Success Lead taking an urgent escalation call with Elena Vance, VP of Operations at Global Logistics Corp. An unexpected 4-hour system outage occurred during their critical month-end close.",
    image:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=800&auto=format&fit=crop",
    tasks: [
      "Acknowledge Elena's frustration immediately without defensiveness and validate the severity of the month-end disruption",
      "Explain the root cause transparently (a database failover timeout) and explain the permanent fix that was deployed",
      "Offer a concrete remedy: an SLA credit on their next billing cycle and a dedicated engineering check-in before their next monthly close",
    ],
    persona:
      "You are Elena Vance, VP of Operations at Global Logistics Corp. You are extremely frustrated and stressed because an unexpected 4-hour outage from your software provider paralyzed your team during month-end financial closing. Since you initiate this call, start directly and firmly: express your deep disappointment and demand to understand what happened and how this will be made right.",
    is_ai_initiated: true,
    avatar_voice: "shimmer",
    difficulty: "Hard",
    icon: "⚡",
    gradient: "from-rose-600 to-red-600",
  },
  {
    id: 3,
    name: "Angel Investor Pitch",
    description:
      "You are the founder of an AI automation platform having a 15-minute introductory coffee chat with Marcus Thorne, an early-stage angel investor with deep enterprise SaaS expertise.",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop",
    tasks: [
      "Deliver a clear 30-second elevator pitch defining the core customer problem and your unique software solution",
      "Share current traction metrics (e.g. 12 pilot enterprise customers and 20% month-over-month usage growth)",
      "Explain your competitive moat against incumbents and ask to schedule a 30-minute deep-dive product demo",
    ],
    persona:
      "You are Marcus Thorne, a successful angel investor and former B2B software founder. You have heard hundreds of pitches and can instantly spot buzzwords. You are sharp, respectful, and genuinely excited by real customer pull and clear unit economics. Since the founder asked for this chat, wait for them to introduce the company, then ask concise, probing questions about their customer retention and moat.",
    is_ai_initiated: false,
    avatar_voice: "echo",
    difficulty: "Medium",
    icon: "🚀",
    gradient: "from-emerald-600 to-teal-600",
  },
  {
    id: 4,
    name: "Apartment Deposit Dispute",
    description:
      "You recently vacated your apartment in pristine condition, but received an itemized letter deducting $900 from your $1,200 security deposit for repainting and general wear. You are calling property manager Arthur Briggs to contest it.",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800&auto=format&fit=crop",
    tasks: [
      "State politely but firmly that you are disputing the $900 deposit deduction sent to you",
      "Provide evidence by referencing your move-in and move-out inspection photos showing standard wear-and-tear with no damage",
      "Propose a fair resolution: waiving the $600 repainting fee and agreeing only to a $75 routine carpet cleaning",
    ],
    is_ai_initiated: false,
    persona:
      "You are Arthur Briggs, an experienced, no-nonsense property manager of an urban residential complex. You manage dozens of units and are used to tenant disputes. You initially defend the deductions as standard turnover costs per the lease. However, you are reasonable, respect tenants who provide photographic proof, and are willing to compromise to avoid small-claims paperwork. Respond naturally in character.",
    avatar_voice: "verse",
    difficulty: "Easy",
    icon: "🏢",
    gradient: "from-amber-600 to-orange-600",
  },
];

export const VOICES = [
  { id: "alloy", name: "Alloy", description: "Neutral & balanced" },
  { id: "ash", name: "Ash", description: "Warm & confident" },
  { id: "ballad", name: "Ballad", description: "Soft & melodic" },
  { id: "coral", name: "Coral", description: "Friendly & bright" },
  { id: "echo", name: "Echo", description: "Clear & resonant" },
  { id: "sage", name: "Sage", description: "Calm & wise" },
  { id: "shimmer", name: "Shimmer", description: "Expressive & lively" },
  { id: "verse", name: "Verse", description: "Articulate & refined" },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];

/**
 * Maps arbitrary or legacy voice names (e.g. "leda") to supported OpenAI Live voices.
 */
export function resolveOpenAIVoice(voiceName?: string): VoiceId {
  if (!voiceName) return "alloy";
  const lower = voiceName.toLowerCase();
  if (lower === "leda" || lower === "female") return "coral";
  if (lower === "male") return "ash";
  const match = VOICES.find((v) => v.id === lower);
  return match ? match.id : "alloy";
}

/**
 * Builds the comprehensive persona prompt guaranteeing authentic, human-like voice conversation.
 */
export function buildHumanPersonaPrompt(scenario: Scenario): string {
  return `
[ROLEPLAY PERSONA]
${scenario.persona}

[SITUATION & SCENARIO CONTEXT]
${scenario.description}

[CONVERSATION TURN INITIATION]
${
  scenario.is_ai_initiated
    ? "CRITICAL: You MUST initiate the conversation. As soon as the session begins, immediately speak your opening line in character with a natural, conversational greeting. Do not wait for the user to speak first."
    : "CRITICAL: The user initiates this conversation. Remain silent until the user speaks their opening greeting or question. Once they speak, respond warmly and naturally in character."
}

[STRICT HUMAN CONVERSATIONAL RULES - ACT LIKE A NORMAL HUMAN]
1. Talk like an authentic, real human in an everyday voice phone call or video chat.
2. Keep your spoken responses concise and natural: 1 to 3 short sentences per turn (maximum 20-40 words). Never monologue or lecture.
3. Spoken rhythm & casual markers: Use everyday contractions (I'm, you're, we've, don't, that's), natural pauses, and brief spontaneous human reactions ("Oh, wow", "That totally makes sense", "Yeah, I hear you", "Honestly, good question", "Fair enough").
4. Never sound like an AI assistant. Never say "How may I assist you?", "As an AI...", or read off bulleted lists.
5. Do NOT mention tasks, rubrics, scoring, or tests. Keep the interaction 100% immersive and realistic.
6. Ask at most ONE natural follow-up question per turn to keep conversational ping-pong alive without interrogating the user.
`.trim();
}
