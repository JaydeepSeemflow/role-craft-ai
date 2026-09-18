"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ScenarioCard from "@/components/ScenarioCard";
import { PRESET_SCENARIOS, Scenario } from "@/lib/scenarios";

export default function HomePage() {
  const router = useRouter();
  const [filterDifficulty, setFilterDifficulty] = useState<string>("All");
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);

  const filteredScenarios = PRESET_SCENARIOS.filter((scenario) => {
    if (filterDifficulty === "All") return true;
    return scenario.difficulty === filterDifficulty;
  });

  const handleScenarioClick = (scenario: Scenario) => {
    router.push(`/conversation?id=${scenario.id}`);
  };

  const handleCustomStart = () => {
    if (!customPrompt.trim()) return;

    const params = new URLSearchParams({
      id: "custom",
      title: "Custom Scenario",
      icon: "🎭",
      instructions: customPrompt.trim(),
      tasks: JSON.stringify(["Introduce yourself and establish your goal in this scenario"]),
      is_ai_initiated: "false",
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
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-12 sm:py-20">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm font-medium text-purple-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
            </span>
            Real-Time Voice Roleplay & Task Monitoring
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
              RolePlay
            </span>{" "}
            GPT
          </h1>

          <p className="mx-auto max-w-2xl text-base sm:text-lg text-gray-400">
            Have natural, human-like voice conversations with realistic characters. Practice critical conversations, steer through sequential tasks, and receive real-time objective monitoring.
          </p>

          {/* Filter & Custom scenario bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {["All", "Easy", "Medium", "Hard"].map((level) => (
              <button
                key={level}
                onClick={() => setFilterDifficulty(level)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  filterDifficulty === level
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                    : "border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {level} {level !== "All" && "Difficulty"}
              </button>
            ))}

            <button
              onClick={() => setShowCustomModal(true)}
              className="rounded-full border border-purple-500/40 bg-purple-950/40 px-4 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-900/60 transition-colors cursor-pointer"
            >
              ✨ Create Custom Scenario
            </button>
          </div>
        </div>

        {/* Scenario Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredScenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onClick={handleScenarioClick}
            />
          ))}
        </div>

        {/* How it works */}
        <div className="mt-20">
          <h2 className="mb-8 text-center text-lg font-semibold text-gray-300">
            How Tasks Completion Works
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Initiation & Natural Dialogue",
                desc: "Check who starts — if AI Initiated, the character greets you first. The model speaks in concise, human-like conversational turns.",
              },
              {
                step: "02",
                title: "Real-Time Task Monitoring",
                desc: "Follow the sequential checklist. As you converse, speech is evaluated in real time to automatically check off completed tasks.",
              },
              {
                step: "03",
                title: "Steerability & Mastery",
                desc: "Interrupt naturally, steer mid-session, view hints if stuck, and celebrate when all objectives are achieved.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center backdrop-blur-sm"
              >
                <div className="mb-3 text-3xl font-bold text-purple-500/60">
                  {item.step}
                </div>
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed text-gray-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Scenario Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#13131f] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                🎭 Create Custom Scenario
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

            <p className="mb-4 text-xs text-gray-400">
              Describe the character and persona you want to roleplay with.
            </p>

            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="You are Sarah, an experienced investor. You are meeting the user for coffee to discuss an early-stage SaaS pitch..."
              rows={5}
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white 
                placeholder-gray-600 focus:border-purple-500/50 focus:outline-none focus:ring-1 
                focus:ring-purple-500/50 resize-none"
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowCustomModal(false)}
                className="rounded-lg px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomStart}
                disabled={!customPrompt.trim()}
                className="rounded-lg bg-purple-600 px-5 py-2 text-xs font-semibold text-white 
                  hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed 
                  transition-colors cursor-pointer shadow-lg shadow-purple-500/25"
              >
                Launch Roleplay
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
