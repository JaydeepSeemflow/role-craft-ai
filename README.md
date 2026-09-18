# 🎭 RolePlay Live (or PersonaLive / SimuSpeak)

> **Real-Time Voice Roleplay & Objective-Driven Conversational Training** powered by OpenAI Live Sessions (`gpt-live-1`) and WebRTC.

Have authentic, natural, human-like voice conversations with AI characters across realistic scenarios. Practice high-stakes negotiations, mentor meetings, and client de-escalations with real-time sequential task monitoring and automated completion detection.

---

## 🌟 Key Features

- **🎙️ Full-Duplex Real-Time Voice (WebRTC)**: Ultra-low latency voice communication via OpenAI Live Sessions (`gpt-live-1`). Speak, listen, and interrupt naturally just like on a real phone or video call.
- **✅ Sequential Task Completion Monitoring**:
  - Track structured objectives step-by-step during live speech.
  - Live progress bar (`X / Y Completed`).
  - Automatic evaluation of speech transcript against task criteria.
  - Expandable conversational hints and sample phrases for each task.
  - Manual verification override for testing or practice.
- **🤖 Dynamic Turn Initiation (`is_ai_initiated`)**:
  - **AI Initiated**: The AI character speaks first upon connection with a natural opening greeting (using `session.commentary.append`).
  - **User Initiated**: The character listens quietly, allowing you to introduce the topic or greet them first.
- **🧠 Natural Human Conversational Modeling**:
  - Concise turns (1–3 short spoken sentences, 20–40 words max).
  - Everyday human speech habits (contractions, spontaneous fillers, conversational rhythm).
  - Zero robotic assistant jargon—stays 100% immersed in character.
- **⏱️ Auto-Disconnection on Task Completion**:
  - Automatically detects when all objectives have been satisfied.
  - Waits for the AI character to deliver and finish its final spoken response.
  - Displays a 3-second live countdown banner with options to **"Disconnect Now"** or **"Keep Talking"**.
  - Gracefully wraps up the session and displays an achievement summary modal.
- **🎛️ Dual Audio Visualizers & Mid-Session Steering**:
  - Real-time Web Audio API visualizers for both your microphone and the character's voice.
  - Live steering input (`session.instructions.append`) to guide the character on the fly without restarting.
- **🎭 Custom Scenario Creator**:
  - Define custom personas, goals, and scenarios on demand.

---

## 📚 Included Scenarios

| # | Scenario | Difficulty | Who Starts | Voice | Core Focus |
|---|---|---|---|---|---|
| **0** | **Meeting a Mentor** | `Hard` | 🤖 AI Starts | Coral | Career transition from product into venture capital |
| **1** | **Salary & Promotion Review** | `Medium` | 🗣️ You Start | Ash | Manager 1-on-1, promotion to Senior Engineer & 15% raise |
| **2** | **De-escalating an Upset Client** | `Hard` | 🤖 AI Starts | Shimmer | Outage during month-end close with VP of Operations |
| **3** | **Angel Investor Pitch** | `Medium` | 🗣️ You Start | Echo | 15-min coffee chat pitch with B2B SaaS angel investor |
| **4** | **Apartment Deposit Dispute** | `Easy` | 🗣️ You Start | Verse | Contesting unfair $900 move-out deposit deductions |

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- **Frontend**: [React 19](https://react.dev), TypeScript, Tailwind CSS v4
- **Audio & Media**: WebRTC (`RTCPeerConnection`), Web Audio API (`AudioContext`, `AnalyserNode`)
- **AI Backend**:
  - **OpenAI Live Sessions API**: `https://api.openai.com/v1/live/sessions` (`gpt-live-1`)
  - **Task Evaluation**: Real-time evaluation endpoint with semantic fallback matcher

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js** 18.17+ or higher
- An **OpenAI API Key** with access to real-time / live audio models

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note on Microphone Permissions**: WebRTC audio and microphone access require a secure context (`http://localhost` or `https://`).

---

## 📋 Scenario Schema Format

All scenarios adhere to the following schema in `src/lib/scenarios.ts`:

```typescript
export interface Scenario {
  id: number;
  name: string;
  description: string;
  image: string;
  tasks: string[];
  is_ai_initiated: boolean; // true = AI speaks first, false = User speaks first
  persona: string;          // Character instructions & personality
  avatar_voice: string;     // Supported voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse
  difficulty: "Easy" | "Medium" | "Hard";
  icon?: string;
  gradient?: string;
}
```

---

## 📁 Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── evaluate-tasks/route.ts  # Real-time task completion evaluation
│   │   │   └── session/route.ts         # OpenAI Live WebRTC session creation
│   │   ├── conversation/
│   │   │   └── page.tsx                 # Full-duplex voice call, visualizers, auto-disconnect
│   │   ├── globals.css                  # Global styles & animations
│   │   ├── layout.tsx                   # Root layout
│   │   └── page.tsx                     # Scenario selection & custom scenario modal
│   ├── components/
│   │   ├── AudioVisualizer.tsx          # Real-time Web Audio frequency visualizer
│   │   ├── ScenarioCard.tsx             # Scenario card with badges, preview, and image
│   │   ├── TaskMonitor.tsx              # Objectives checklist, progress bar, and tips
│   │   ├── TranscriptPanel.tsx          # Live speech-to-text dialogue stream
│   │   └── VoiceSelector.tsx            # Character voice selector
│   └── lib/
│       ├── openai-live/                 # OpenAI Live WebRTC protocol client & types
│       └── scenarios.ts                 # Preset scenarios, voice resolvers, prompt builder
├── public/                              # Static assets
└── package.json
```

---

## 💡 How Task Monitoring & Auto-Disconnect Works

1. **Active Listening**: As you speak, speech is converted into transcript deltas in real time.
2. **Evaluation**: Debounced transcript text is evaluated against the scenario's criteria. Once an objective is met, it is checked off with visual celebration.
3. **Completion & Audio Flush**: When the final task is checked off, the system waits for the character to deliver and complete its spoken reply.
4. **Graceful Disconnect**: Once the character concludes speaking, a 3-second countdown initiates, automatically closing audio channels and launching the completion review modal.
