"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ScenarioCard from "@/components/ScenarioCard";
import { PRESET_SCENARIOS, Scenario } from "@/lib/scenarios";

export default function HomePage() {
  const router = useRouter();
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);

  const handleScenarioClick = (scenario: Scenario) => {
    if (scenario.id === "custom") {
      setShowCustomModal(true);
      return;
    }

    const params = new URLSearchParams({
      id: scenario.id,
      title: scenario.title,
      icon: scenario.icon,
      instructions: scenario.instructions,
    });
    router.push(`/conversation?${params.toString()}`);
  };

  const handleCustomStart = () => {
    if (!customPrompt.trim()) return;

    const params = new URLSearchParams({
      id: "custom",
      title: "Custom Scenario",
      icon: "🎭",
      instructions: customPrompt.trim(),
    });
    router.push(`/conversation?${params.toString()}`);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a12]">
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-purple-700/20 blur-[128px] animate-blob" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-indigo-700/20 blur-[128px] animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-fuchsia-700/15 blur-[128px] animate-blob animation-delay-4000" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm font-medium text-purple-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
            </span>
            Powered by GPT-Live-1
          </div>

          <h1 className="mb-4 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
              RolePlay
            </span>{" "}
            GPT
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-gray-400">
            Have real-time voice conversations with AI characters. Choose a
            scenario below and start talking — the AI will respond naturally
            in character.
          </p>
        </div>

        {/* Scenario Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRESET_SCENARIOS.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onClick={handleScenarioClick}
            />
          ))}
        </div>

        {/* How it works */}
        <div className="mt-20">
          <h2 className="mb-8 text-center text-lg font-semibold text-gray-400">
            How it works
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Pick a Scenario",
                desc: "Choose from preset roleplay scenarios or create your own custom character.",
              },
              {
                step: "02",
                title: "Start Talking",
                desc: "Allow microphone access and begin speaking. The AI responds in real-time.",
              },
              {
                step: "03",
                title: "Natural Conversation",
                desc: "Full-duplex audio — interrupt, ask questions, and have a real conversation.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center"
              >
                <div className="mb-3 text-3xl font-bold text-purple-500/50">
                  {item.step}
                </div>
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-gray-500">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Scenario Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#13131f] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                🎭 Custom Scenario
              </h2>
              <button
                onClick={() => setShowCustomModal(false)}
                className="rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-400">
              Describe the character and scenario the AI should roleplay.
              Be specific about personality, name, setting, and behavior.
            </p>

            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="You are a friendly barista at a cozy coffee shop called 'The Morning Brew'. Your name is Alex..."
              rows={6}
              className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white 
                placeholder-gray-600 focus:border-purple-500/50 focus:outline-none focus:ring-1 
                focus:ring-purple-500/50 resize-none"
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowCustomModal(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomStart}
                disabled={!customPrompt.trim()}
                className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white 
                  hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed 
                  transition-colors cursor-pointer shadow-lg shadow-purple-500/25"
              >
                Start Conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
