"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AudioVisualizer from "@/components/AudioVisualizer";
import TranscriptPanel, { TranscriptEntry } from "@/components/TranscriptPanel";
import VoiceSelector from "@/components/VoiceSelector";
import TaskMonitor, { TaskStatus } from "@/components/TaskMonitor";
import {
  PRESET_SCENARIOS,
  Scenario,
  VoiceId,
  buildHumanPersonaPrompt,
  resolveOpenAIVoice,
} from "@/lib/scenarios";
import {
  LiveServerEvent,
  createCommentaryAppendEvent,
  createInputAudioMuteEvent,
  createInputAudioUnmuteEvent,
  createInstructionsAppendEvent,
  createSessionCloseEvent,
  getAudioStream,
} from "@/lib/openai-live";

export default function ConversationPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a12] text-gray-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        </div>
      }
    >
      <ConversationPage />
    </Suspense>
  );
}

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

function ConversationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const scenarioId = Number(searchParams.get("id"));

  // Resolve matching preset scenario or construct fallback
  const scenario: Scenario = useMemo(() => {
    const matched = PRESET_SCENARIOS.find((s) => s.id === scenarioId);
    if (matched) return matched;

    let parsedTasks: string[] = [
      "Engage naturally in the conversation and achieve your goal",
    ];
    try {
      const paramTasks = searchParams.get("tasks");
      if (paramTasks) parsedTasks = JSON.parse(paramTasks);
    } catch {
      // Use fallback
    }

    return {
      id: scenarioId,
      name: searchParams.get("title") || "Custom Roleplay",
      description:
        searchParams.get("description") ||
        searchParams.get("instructions") ||
        "Custom conversational scenario",
      image: "",
      tasks: parsedTasks,
      is_ai_initiated: searchParams.get("is_ai_initiated") === "true",
      avatar_voice: "coral",
      persona:
        searchParams.get("instructions") ||
        "You are a realistic roleplay conversationalist.",
      difficulty: "Medium",
      icon: searchParams.get("icon") || "🎭",
      gradient: "from-purple-600 to-indigo-600",
    };
  }, [scenarioId, searchParams]);

  // Voice state
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>(() =>
    resolveOpenAIVoice(scenario.avatar_voice),
  );

  // Connection state
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(
    null,
  );

  // Steerability / mid-session instruction state
  const [customInstruction, setCustomInstruction] = useState("");
  const [instructionFeedback, setInstructionFeedback] = useState<string | null>(
    null,
  );

  // Task monitoring state
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>(() =>
    scenario.tasks.map((_, idx) => ({
      index: idx,
      completed: false,
      reason: "Pending",
    })),
  );
  const [isEvaluating, setIsEvaluating] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const evalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitiatedRef = useRef(false);

  // Auto-disconnect state & tracking
  const [autoDisconnectCountdown, setAutoDisconnectCountdown] = useState<number | null>(null);
  const [autoDisconnectCancelled, setAutoDisconnectCancelled] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const lastAssistantDeltaTimeRef = useRef<number>(0);
  const lastUserSpeechTimeRef = useRef<number>(0);
  const allCompletedTimeRef = useRef<number | null>(null);
  const autoDisconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const allTasksCompleted = useMemo(() => {
    if (!scenario.tasks || scenario.tasks.length === 0) return false;
    const completedCount = taskStatuses.filter((t) => t.completed).length;
    return completedCount >= scenario.tasks.length;
  }, [scenario.tasks, taskStatuses]);

  // Initialize/reset task statuses when scenario changes
  useEffect(() => {
    setTaskStatuses(
      scenario.tasks.map((_, idx) => ({
        index: idx,
        completed: false,
        reason: "Pending",
      })),
    );
    setSelectedVoice(resolveOpenAIVoice(scenario.avatar_voice));
    setAutoDisconnectCancelled(false);
    setAutoDisconnectCountdown(null);
  }, [scenario]);

  // Toggle task manually (user control)
  const handleToggleTask = useCallback((index: number) => {
    setTaskStatuses((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              completed: !item.completed,
              reason: !item.completed ? "Manually verified" : "Pending",
            }
          : item,
      ),
    );
  }, []);

  // Real-time evaluation against tasks
  const evaluateTasksAgainstTranscript = useCallback(
    async (currentTranscript: TranscriptEntry[]) => {
      const userText = currentTranscript
        .filter((t) => t.role === "user")
        .map((t) => t.text.trim())
        .filter(Boolean);

      if (userText.length === 0 || scenario.tasks.length === 0) return;

      try {
        setIsEvaluating(true);
        const completedIndices = taskStatuses
          .filter((s) => s.completed)
          .map((s) => s.index);

        const res = await fetch("/api/evaluate-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks: scenario.tasks,
            transcript: currentTranscript.map((t) => ({
              role: t.role,
              text: t.text,
            })),
            completedIndices,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.taskStatuses)) {
            setTaskStatuses(data.taskStatuses);
          }
        }
      } catch (e) {
        console.warn("Task evaluation fetch failed:", e);
      } finally {
        setIsEvaluating(false);
      }
    },
    [scenario.tasks, taskStatuses],
  );

  const appendTranscriptDelta = useCallback(
    (role: "user" | "assistant", delta: string) => {
      if (!delta) return;
      setTranscript((prev) => {
        let updated: TranscriptEntry[];
        if (prev.length > 0 && prev[prev.length - 1].role === role) {
          const last = prev[prev.length - 1];
          const modified: TranscriptEntry = {
            ...last,
            text: last.text + delta,
          };
          updated = [...prev.slice(0, -1), modified];
        } else {
          const newEntry: TranscriptEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role,
            text: delta,
            timestamp: new Date(),
          };
          updated = [...prev, newEntry];
        }

        if (role === "assistant") {
          lastAssistantDeltaTimeRef.current = Date.now();
        } else if (role === "user") {
          lastUserSpeechTimeRef.current = Date.now();
        }

        // Debounce task evaluation on user speech
        if (role === "user") {
          if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
          evalTimerRef.current = setTimeout(() => {
            evaluateTasksAgainstTranscript(updated);
          }, 1200);
        }

        return updated;
      });
    },
    [evaluateTasksAgainstTranscript],
  );

  const disconnect = useCallback(() => {
    if (evalTimerRef.current) clearTimeout(evalTimerRef.current);
    if (autoDisconnectTimerRef.current) {
      clearInterval(autoDisconnectTimerRef.current);
      autoDisconnectTimerRef.current = null;
    }
    setAutoDisconnectCountdown(null);
    allCompletedTimeRef.current = null;

    if (dcRef.current) {
      try {
        if (dcRef.current.readyState === "open") {
          dcRef.current.send(JSON.stringify(createSessionCloseEvent()));
        }
        dcRef.current.close();
      } catch {
        // ignore closing error
      }
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMicAnalyser(null);
    setOutputAnalyser(null);
    hasInitiatedRef.current = false;
    setStatus("disconnected");
  }, []);

  const handleServerEvent = useCallback(
    (event: LiveServerEvent | Record<string, unknown>) => {
      const type = event.type as string;

      switch (type) {
        case "session.input_transcript.delta": {
          const liveDelta = (event as { delta?: string }).delta || "";
          appendTranscriptDelta("user", liveDelta);
          lastUserSpeechTimeRef.current = Date.now();
          break;
        }
        case "session.output_transcript.delta": {
          const liveDelta = (event as { delta?: string }).delta || "";
          appendTranscriptDelta("assistant", liveDelta);
          lastAssistantDeltaTimeRef.current = Date.now();
          break;
        }
        case "session.started": {
          const startedEvent = event as { session?: { id?: string } };
          if (startedEvent.session?.id) {
            setSessionId(startedEvent.session.id);
          }
          setStatus("connected");
          if (scenario.is_ai_initiated && !hasInitiatedRef.current) {
            hasInitiatedRef.current = true;
            if (dcRef.current && dcRef.current.readyState === "open") {
              const commentary = createCommentaryAppendEvent(
                "Please start the conversation now by greeting the user warmly in character."
              );
              dcRef.current.send(JSON.stringify(commentary));
            }
          }
          break;
        }
        case "session.input_audio.muted": {
          setIsMuted(true);
          break;
        }
        case "session.input_audio.unmuted": {
          setIsMuted(false);
          break;
        }
        case "session.instructions.appended": {
          setInstructionFeedback("Direction applied to character");
          setTimeout(() => setInstructionFeedback(null), 3500);
          break;
        }
        case "session.closed": {
          setStatus("disconnected");
          break;
        }
        case "response.output_audio_transcript.delta": {
          const delta = (event as { delta?: string }).delta || "";
          appendTranscriptDelta("assistant", delta);
          lastAssistantDeltaTimeRef.current = Date.now();
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          const fullText = (event as { transcript?: string }).transcript || "";
          if (fullText) appendTranscriptDelta("user", fullText);
          break;
        }
        case "error": {
          const err = event as { error?: { message?: string } };
          console.error("OpenAI Live error:", err.error);
          setError(
            err.error?.message || "An error occurred in the live session",
          );
          break;
        }
      }
    },
    [appendTranscriptDelta],
  );

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    setSessionId(null);
    hasInitiatedRef.current = false;
    setAutoDisconnectCancelled(false);
    setAutoDisconnectCountdown(null);
    setShowCompletionModal(false);

    try {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        throw new Error(
          "Microphone access requires HTTPS or localhost. Please access this page via a secure context.",
        );
      }

      const stream = await getAudioStream();
      if (!stream) {
        throw new Error(
          "Microphone access failed. Please allow microphone permission in your browser.",
        );
      }
      streamRef.current = stream;

      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const micSource = audioCtx.createMediaStreamSource(stream);
      const micAnalyserNode = audioCtx.createAnalyser();
      micAnalyserNode.fftSize = 256;
      micSource.connect(micAnalyserNode);
      setMicAnalyser(micAnalyserNode);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioTrack = stream.getAudioTracks()[0];
      pc.addTrack(audioTrack, stream);

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (!remoteStream) return;

        const audioEl = document.createElement("audio");
        audioEl.srcObject = remoteStream;
        audioEl.autoplay = true;
        audioEl.setAttribute("playsinline", "true");
        audioEl.id = "remote-audio";
        const existing = document.getElementById("remote-audio");
        if (existing) existing.remove();
        document.body.appendChild(audioEl);

        audioEl.play().catch((playErr) => {
          console.warn(
            "Audio autoplay delayed until user interaction:",
            playErr,
          );
        });

        const outSource = audioCtx.createMediaStreamSource(remoteStream);
        const outAnalyserNode = audioCtx.createAnalyser();
        outAnalyserNode.fftSize = 256;
        outSource.connect(outAnalyserNode);
        setOutputAnalyser(outAnalyserNode);
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("connected");
        // If AI initiates the conversation, send commentary event so character speaks first
        if (scenario.is_ai_initiated) {
          setTimeout(() => {
            if (!hasInitiatedRef.current && dc.readyState === "open") {
              hasInitiatedRef.current = true;
              const commentary = createCommentaryAppendEvent(
                "Please start the conversation now by greeting the user warmly in character."
              );
              dc.send(JSON.stringify(commentary));
            }
          }, 600);
        }
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleServerEvent(msg);
        } catch {
          // ignore non-JSON
        }
      };

      dc.onclose = () => {
        setStatus("disconnected");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Build human persona instructions
      const systemPrompt = buildHumanPersonaPrompt(scenario);

      const sessionRes = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: systemPrompt,
          voice: selectedVoice,
          sdp: offer.sdp,
          model: "gpt-live-1",
        }),
      });

      if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${sessionRes.status}`);
      }

      const sessionData = await sessionRes.json();
      const answerSdp = sessionData.transport?.sdp || sessionData.sdp;

      if (!answerSdp) {
        throw new Error("No SDP answer received from Live session API");
      }

      if (sessionData.session?.id) {
        setSessionId(sessionData.session.id);
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err) {
      console.error("Connection error:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
      disconnect();
    }
  }, [scenario, selectedVoice, disconnect, handleServerEvent]);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) {
        const nextMuted = track.enabled;
        track.enabled = !track.enabled;
        setIsMuted(nextMuted);

        if (dcRef.current && dcRef.current.readyState === "open") {
          const muteEvent = nextMuted
            ? createInputAudioMuteEvent()
            : createInputAudioUnmuteEvent();
          dcRef.current.send(JSON.stringify(muteEvent));
        }
      }
    }
  }, []);

  const sendLiveInstruction = useCallback(() => {
    if (
      !customInstruction.trim() ||
      !dcRef.current ||
      dcRef.current.readyState !== "open"
    ) {
      return;
    }

    const event = createInstructionsAppendEvent(customInstruction.trim());
    dcRef.current.send(JSON.stringify(event));
    setCustomInstruction("");
    setInstructionFeedback("Steering instruction sent");
  }, [customInstruction]);

  useEffect(() => {
    return () => {
      disconnect();
      const audioEl = document.getElementById("remote-audio");
      if (audioEl) audioEl.remove();
    };
  }, [disconnect]);

  // Automatically disconnect session once all tasks are completed and AI audio finishes playing
  useEffect(() => {
    if (status !== "connected" || !allTasksCompleted || autoDisconnectCancelled) {
      if (autoDisconnectTimerRef.current) {
        clearInterval(autoDisconnectTimerRef.current);
        autoDisconnectTimerRef.current = null;
      }
      allCompletedTimeRef.current = null;
      setAutoDisconnectCountdown(null);
      return;
    }

    if (allCompletedTimeRef.current === null) {
      allCompletedTimeRef.current = Date.now();
    }

    const completionTime = allCompletedTimeRef.current;

    const interval = setInterval(() => {
      const now = Date.now();
      const lastAiTime = lastAssistantDeltaTimeRef.current;
      const lastUserTime = lastUserSpeechTimeRef.current;

      // 1. If user spoke recently and AI hasn't replied yet, allow AI up to 4s to begin speaking
      if (lastUserTime > lastAiTime && now - lastUserTime < 4000) {
        setAutoDisconnectCountdown(null);
        return;
      }

      // 2. If AI is actively streaming speech deltas or spoke within the last 2.5 seconds, wait for it to finish!
      if (lastAiTime > 0 && now - lastAiTime < 2500) {
        setAutoDisconnectCountdown(null);
        return;
      }

      // 3. Allow at least 1.5s buffer after all tasks are completed
      if (now - completionTime < 1500) {
        return;
      }

      // 4. AI speech has concluded! Decrement countdown smoothly
      setAutoDisconnectCountdown((prev) => {
        if (prev === null) {
          return 3;
        }
        if (prev <= 1) {
          clearInterval(interval);
          disconnect();
          setShowCompletionModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    autoDisconnectTimerRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [allTasksCompleted, autoDisconnectCancelled, disconnect, status]);

  const statusConfig: Record<
    ConnectionStatus,
    { label: string; color: string; dot: string }
  > = {
    idle: {
      label: "Ready to Start",
      color: "text-gray-400",
      dot: "bg-gray-500",
    },
    connecting: {
      label: "Connecting...",
      color: "text-amber-400",
      dot: "bg-amber-500 animate-pulse",
    },
    connected: {
      label: "Live Active",
      color: "text-emerald-400",
      dot: "bg-emerald-500",
    },
    disconnected: {
      label: "Session Ended",
      color: "text-gray-400",
      dot: "bg-gray-500",
    },
    error: { label: "Error", color: "text-red-400", dot: "bg-red-500" },
  };

  const currentStatus = statusConfig[status];

  return (
    <main className="relative min-h-screen bg-[#0a0a12] text-gray-100">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-80 w-80 rounded-full bg-purple-700/15 blur-[120px] animate-blob" />
        <div className="absolute -right-40 bottom-0 h-80 w-80 rounded-full bg-indigo-700/15 blur-[120px] animate-blob animation-delay-2000" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <button
            onClick={() => {
              disconnect();
              router.push("/");
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 
              hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Scenarios
          </button>

          <div className="flex items-center gap-3">
            <span className="text-2xl">{scenario.icon || "🎭"}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">
                  {scenario.name}
                </h1>
                <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                  {scenario.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <span>
                  {scenario.is_ai_initiated
                    ? "🤖 AI Speaks First"
                    : "🗣️ You Speak First"}
                </span>
                <span>•</span>
                <span>Voice: {selectedVoice}</span>
                {sessionId && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-gray-500">
                      ID: {sessionId.slice(0, 10)}...
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 ${currentStatus.color}`}
          >
            <span className={`h-2 w-2 rounded-full ${currentStatus.dot}`} />
            <span className="text-xs font-semibold">{currentStatus.label}</span>
          </div>
        </header>

        {/* Auto-disconnect notification banner */}
        {allTasksCompleted && status === "connected" && !autoDisconnectCancelled && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/70 p-4 backdrop-blur-xl shadow-xl shadow-emerald-500/10 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-xl animate-bounce">
                🎉
              </span>
              <div>
                <div className="text-sm font-bold text-white">
                  {autoDisconnectCountdown !== null
                    ? "All objectives completed & character finished speaking!"
                    : "All objectives completed! Wrapping up after character finishes speaking..."}
                </div>
                <div className="text-xs text-emerald-300">
                  {autoDisconnectCountdown !== null ? (
                    <>
                      Disconnecting session automatically in{" "}
                      <span className="font-extrabold text-white text-sm underline decoration-emerald-400 decoration-2">
                        {autoDisconnectCountdown}s
                      </span>
                      ...
                    </>
                  ) : (
                    "The session will automatically disconnect once the final audio response concludes."
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  disconnect();
                  setShowCompletionModal(true);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-colors cursor-pointer"
              >
                Disconnect Now
              </button>
              <button
                onClick={() => {
                  setAutoDisconnectCancelled(true);
                  setAutoDisconnectCountdown(null);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                Keep Talking
              </button>
            </div>
          </div>
        )}

        {/* Main Grid: Left Controls & Audio, Center Tasks Monitoring, Right Transcript */}
        <div className="grid flex-1 gap-6 lg:grid-cols-12">
          {/* Left Column (5 cols): Audio Visualizer, Call Controls, Steering, Scenario Info */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            {/* Visualizer & Call Controls */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-xl">
              {/* Voice Selector */}
              <div className="mb-5">
                <VoiceSelector
                  selectedVoice={selectedVoice}
                  onSelect={setSelectedVoice}
                  disabled={status === "connected" || status === "connecting"}
                />
              </div>

              {/* Visualizers */}
              <div className="mb-6 space-y-3">
                <AudioVisualizer
                  analyserNode={micAnalyser}
                  isActive={status === "connected" && !isMuted}
                  label="Your Microphone"
                  color="#a855f7"
                />
                <AudioVisualizer
                  analyserNode={outputAnalyser}
                  isActive={status === "connected"}
                  label="Character Voice"
                  color="#34d399"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-4">
                {status === "idle" ||
                status === "disconnected" ||
                status === "error" ? (
                  <button
                    onClick={connect}
                    className="group flex items-center gap-3 rounded-full bg-gradient-to-r 
                      from-purple-600 to-indigo-600 px-8 py-3.5 text-sm font-semibold text-white 
                      shadow-xl shadow-purple-500/25 transition-all hover:shadow-purple-500/40 
                      hover:scale-105 cursor-pointer"
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
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                    Start Roleplay
                  </button>
                ) : status === "connecting" ? (
                  <div className="flex items-center gap-3 rounded-full bg-amber-500/20 px-8 py-3.5 text-sm font-semibold text-amber-300">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    Connecting Audio...
                  </div>
                ) : (
                  <>
                    <button
                      onClick={toggleMute}
                      className={`flex h-12 w-12 items-center justify-center rounded-full 
                        transition-all cursor-pointer ${
                          isMuted
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      title={isMuted ? "Unmute Mic" : "Mute Mic"}
                    >
                      {isMuted ? (
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
                            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                          />
                        </svg>
                      ) : (
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
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={disconnect}
                      className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 
                        text-sm font-semibold text-white shadow-lg shadow-red-500/25 
                        transition-all hover:bg-red-500 hover:scale-105 cursor-pointer"
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
                          d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
                        />
                      </svg>
                      End Session
                    </button>
                  </>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-300">
                  <div className="font-semibold mb-0.5">Session Error</div>
                  <div>{error}</div>
                </div>
              )}
            </div>

            {/* Steerability in Live Session */}
            {status === "connected" && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">
                    Direct Character Mid-Session
                  </h3>
                  {instructionFeedback && (
                    <span className="text-[10px] text-emerald-400 animate-pulse">
                      {instructionFeedback}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendLiveInstruction();
                    }}
                    placeholder="E.g. 'Speak more casually', 'Ask me about my timeline'..."
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    onClick={sendLiveInstruction}
                    disabled={!customInstruction.trim()}
                    className="rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-40 hover:bg-purple-500 cursor-pointer"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Situation Context */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Scenario Situation
              </h3>
              <p className="text-xs leading-relaxed text-gray-300">
                {scenario.description}
              </p>
            </div>
          </div>

          {/* Center Column (4 cols): Task Completion Monitoring */}
          <div className="flex flex-col lg:col-span-4">
            <TaskMonitor
              tasks={scenario.tasks}
              taskStatuses={taskStatuses}
              isAiInitiated={scenario.is_ai_initiated}
              onToggleTask={handleToggleTask}
              isEvaluating={isEvaluating}
            />
          </div>

          {/* Right Column (4 cols): Live Transcript */}
          <div className="flex flex-col min-h-[420px] lg:col-span-4">
            <TranscriptPanel entries={transcript} />
          </div>
        </div>
      </div>

      {/* Scenario Completed Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-[#121220] p-6 sm:p-8 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-3xl shadow-lg shadow-emerald-500/30">
                🏆
              </div>
              <h2 className="text-2xl font-bold text-white">
                Scenario Completed!
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-gray-300 leading-relaxed">
                Outstanding job! You completed all conversational objectives for{" "}
                <strong className="text-purple-300">{scenario.name}</strong>, and the character concluded the conversation naturally.
              </p>
            </div>

            {/* Completed Tasks Summary */}
            <div className="my-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Completed Objectives ({scenario.tasks.length}/{scenario.tasks.length})
              </h3>
              <ul className="space-y-2">
                {scenario.tasks.map((taskText, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-gray-200"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black font-bold">
                      ✓
                    </span>
                    <span>{taskText}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                onClick={() => setShowCompletionModal(false)}
                className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                Review Transcript
              </button>
              <button
                onClick={() => router.push("/")}
                className="w-full sm:w-auto rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-colors cursor-pointer"
              >
                Other Scenarios
              </button>
              <button
                onClick={() => {
                  setShowCompletionModal(false);
                  setAutoDisconnectCancelled(false);
                  setAutoDisconnectCountdown(null);
                  setTranscript([]);
                  setTaskStatuses(
                    scenario.tasks.map((_, idx) => ({
                      index: idx,
                      completed: false,
                      reason: "Pending",
                    }))
                  );
                  connect();
                }}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 hover:scale-105 transition-all cursor-pointer"
              >
                Practice Again
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
