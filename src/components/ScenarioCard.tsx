"use client";

import { useState } from "react";
import Image from "next/image";
import { Scenario } from "@/lib/scenarios";

interface ScenarioCardProps {
  scenario: Scenario;
  onClick: (scenario: Scenario) => void;
}

export default function ScenarioCard({ scenario, onClick }: ScenarioCardProps) {
  const [imgError, setImgError] = useState(false);

  const difficultyColors = {
    Easy: "border-emerald-500/30 bg-emerald-500/30 text-white",
    Medium: "border-amber-500/30 bg-amber-500/30 text-white",
    Hard: "border-rose-500/30 bg-rose-500/30 text-white",
  }[scenario.difficulty || "Medium"];

  return (
    <div
      onClick={() => onClick(scenario)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 
        bg-[#12121e]/80 backdrop-blur-xl transition-all duration-300 
        hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/15 
        cursor-pointer"
    >
      {/* Thumbnail Header */}
      <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-[#0d0d18]">
        {scenario.image && !imgError ? (
          <Image
            src={scenario.image}
            alt={scenario.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            {scenario.icon || "🎭"}
          </div>
        )}

        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#12121e] via-[#12121e]/50 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          {/* Difficulty badge */}
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase backdrop-blur-md ${difficultyColors}`}
          >
            {scenario.difficulty}
          </span>
        </div>

        {/* Voice tag */}
        <div className="absolute bottom-2 right-3">
          <span className="rounded-md border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] text-gray-300 backdrop-blur-md">
            🎙️ Voice: {scenario.avatar_voice}
          </span>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2">
          {scenario.icon && <span className="text-xl">{scenario.icon}</span>}
          <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
            {scenario.name}
          </h3>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-gray-400 line-clamp-2">
          {scenario.description}
        </p>

        {/* Tasks Section Preview */}
        {scenario.tasks && scenario.tasks.length > 0 && (
          <div className="mb-4 flex-1 rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">
                Tasks To Complete ({scenario.tasks.length})
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                Sequential
              </span>
            </div>
            <ul className="space-y-1.5">
              {scenario.tasks.slice(0, 3).map((task, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-[11px] leading-tight text-gray-300"
                >
                  <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[9px] font-bold text-purple-300">
                    {idx + 1}
                  </span>
                  <span className="line-clamp-1">{task}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-auto flex items-center justify-between pt-2 border-t border-white/5">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition-transform">
            Start Roleplay
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
