"use client";

import { Scenario } from "@/lib/scenarios";

interface ScenarioCardProps {
  scenario: Scenario;
  onClick: (scenario: Scenario) => void;
}

export default function ScenarioCard({ scenario, onClick }: ScenarioCardProps) {
  return (
    <button
      onClick={() => onClick(scenario)}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 
        bg-white/5 backdrop-blur-xl p-6 text-left transition-all duration-300 
        hover:scale-[1.03] hover:border-white/20 hover:bg-white/10 
        hover:shadow-2xl hover:shadow-purple-500/10 
        focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer`}
    >
      {/* Gradient accent on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${scenario.gradient} 
          opacity-0 transition-opacity duration-300 group-hover:opacity-10`}
      />

      {/* Icon */}
      <div
        className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl 
          bg-gradient-to-br ${scenario.gradient} text-2xl shadow-lg`}
      >
        {scenario.icon}
      </div>

      {/* Content */}
      <h3 className="mb-2 text-lg font-semibold text-white">
        {scenario.title}
      </h3>
      <p className="text-sm leading-relaxed text-gray-400">
        {scenario.description}
      </p>

      {/* Arrow indicator */}
      <div
        className="mt-4 flex items-center gap-1 text-sm font-medium text-purple-400 
          opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1"
      >
        Start conversation
        <svg
          className="h-4 w-4"
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
      </div>
    </button>
  );
}
