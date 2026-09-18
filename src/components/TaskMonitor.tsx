"use client";

import { useState } from "react";

export interface TaskStatus {
  index: number;
  completed: boolean;
  reason?: string;
}

interface TaskMonitorProps {
  tasks: string[];
  taskStatuses: TaskStatus[];
  isAiInitiated: boolean;
  onToggleTask?: (index: number) => void;
  isEvaluating?: boolean;
}

export default function TaskMonitor({
  tasks,
  taskStatuses,
  isAiInitiated,
  onToggleTask,
  isEvaluating = false,
}: TaskMonitorProps) {
  const [expandedTips, setExpandedTips] = useState<Record<number, boolean>>({});

  const completedCount = taskStatuses.filter((s) => s.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  // Find index of current active (first incomplete) task
  const activeTaskIndex = tasks.findIndex((_, idx) => !taskStatuses[idx]?.completed);

  const toggleTip = (idx: number) => {
    setExpandedTips((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Task Monitoring
            </h2>
            <p className="text-[11px] text-gray-400">
              Complete each objective in natural conversation
            </p>
          </div>
        </div>

        {isEvaluating && (
          <div className="flex items-center gap-1.5 rounded-full bg-purple-500/15 px-2.5 py-1 text-[11px] text-purple-300">
            <div className="h-2 w-2 animate-spin rounded-full border border-purple-400 border-t-transparent" />
            <span>Evaluating...</span>
          </div>
        )}
      </div>

      {/* Turn Initiation Badge */}
      <div
        className={`mb-4 flex items-center gap-2.5 rounded-xl border p-2.5 text-xs transition-colors ${
          isAiInitiated
            ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        }`}
      >
        <span className="text-base">{isAiInitiated ? "🤖" : "🗣️"}</span>
        <div className="flex-1">
          <div className="font-semibold">
            {isAiInitiated ? "AI Initiated" : "User Initiated"}
          </div>
          <div className="text-[11px] opacity-85">
            {isAiInitiated
              ? "The character will speak first when audio connects."
              : "You speak first! Greet the character to begin."}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-5 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-300">Progress</span>
          <span className="font-semibold text-purple-400">
            {completedCount} / {totalCount} Completed ({progressPercent}%)
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Celebration Banner if all completed */}
      {allCompleted && (
        <div className="mb-4 animate-bounce rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3 text-center text-xs text-emerald-300 shadow-lg shadow-emerald-500/10">
          <span className="text-base mr-1">🎉</span>
          <strong className="font-semibold">All Objectives Complete!</strong> You naturally fulfilled every roleplay task.
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.map((taskText, idx) => {
          const status = taskStatuses[idx];
          const isDone = status?.completed;
          const isActive = idx === activeTaskIndex;

          return (
            <div
              key={idx}
              className={`group relative rounded-xl border p-3.5 transition-all duration-200 ${
                isDone
                  ? "border-emerald-500/40 bg-emerald-950/20 text-gray-300"
                  : isActive
                  ? "border-purple-500/60 bg-purple-950/20 text-white shadow-md shadow-purple-500/10 ring-1 ring-purple-500/30"
                  : "border-white/5 bg-white/[0.02] text-gray-400"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox button (interactive toggle) */}
                <button
                  type="button"
                  onClick={() => onToggleTask?.(idx)}
                  title="Click to toggle status manually"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    isDone
                      ? "border-emerald-500 bg-emerald-500 text-black shadow-sm shadow-emerald-500/50"
                      : isActive
                      ? "border-purple-400 bg-purple-500/20 text-transparent hover:border-purple-300"
                      : "border-white/20 bg-white/5 text-transparent hover:border-white/40"
                  }`}
                >
                  {isDone ? (
                    <svg
                      className="h-3.5 w-3.5 stroke-[3]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <span className="text-[10px] font-mono text-purple-300">
                      {idx + 1}
                    </span>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isDone
                          ? "text-emerald-400"
                          : isActive
                          ? "text-purple-400"
                          : "text-gray-500"
                      }`}
                    >
                      Task {idx + 1}
                    </span>

                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                        isDone
                          ? "bg-emerald-500/20 text-emerald-300"
                          : isActive
                          ? "bg-purple-500/20 text-purple-300 animate-pulse"
                          : "bg-white/5 text-gray-500"
                      }`}
                    >
                      {isDone ? "Completed" : isActive ? "Current Objective" : "Upcoming"}
                    </span>
                  </div>

                  <p
                    className={`mt-1 text-xs leading-relaxed ${
                      isDone
                        ? "line-through text-gray-400 decoration-emerald-500/40"
                        : "text-gray-200"
                    }`}
                  >
                    {taskText}
                  </p>

                  {/* Feedback reasoning if completed */}
                  {isDone && status?.reason && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400/90 font-medium">
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>{status.reason}</span>
                    </div>
                  )}

                  {/* Expandable Hint / Tip */}
                  {!isDone && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => toggleTip(idx)}
                        className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                      >
                        <span>💡 How to fulfill</span>
                        <svg
                          className={`h-3 w-3 transition-transform ${
                            expandedTips[idx] ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {expandedTips[idx] && (
                        <div className="mt-1.5 rounded-lg border border-purple-500/20 bg-purple-500/10 p-2 text-[11px] text-purple-200">
                          Address this in character using your own natural voice. For example:{" "}
                          <span className="italic opacity-90">
                            &ldquo;{taskText.slice(0, 80)}...&rdquo;
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
