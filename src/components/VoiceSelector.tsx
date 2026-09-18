"use client";

import { VOICES, VoiceId } from "@/lib/scenarios";

interface VoiceSelectorProps {
  selectedVoice: VoiceId;
  onSelect: (voice: VoiceId) => void;
  disabled?: boolean;
}

export default function VoiceSelector({
  selectedVoice,
  onSelect,
  disabled,
}: VoiceSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
        Voice
      </label>
      <div className="flex flex-wrap gap-2">
        {VOICES.map((voice) => (
          <button
            key={voice.id}
            onClick={() => onSelect(voice.id)}
            disabled={disabled}
            title={voice.description}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200
              ${
                selectedVoice === voice.id
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {voice.name}
          </button>
        ))}
      </div>
    </div>
  );
}
