"use client";

import { useEffect, useRef } from "react";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
}

export default function TranscriptPanel({ entries }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="text-center">
          <div className="mb-2 text-3xl">💬</div>
          <p className="text-sm text-gray-500">
            Conversation transcript will appear here...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-300">
          Live Transcript
        </h3>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin"
      >
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`flex ${
              entry.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                entry.role === "user"
                  ? "bg-purple-600/30 text-purple-100 rounded-br-sm"
                  : "bg-white/10 text-gray-200 rounded-bl-sm"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    entry.role === "user"
                      ? "text-purple-400"
                      : "text-emerald-400"
                  }`}
                >
                  {entry.role === "user" ? "You" : "AI"}
                </span>
                <span className="text-[10px] text-gray-600">
                  {entry.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {entry.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
