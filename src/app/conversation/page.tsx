"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AudioVisualizer from "@/components/AudioVisualizer";
import TranscriptPanel, { TranscriptEntry } from "@/components/TranscriptPanel";
import VoiceSelector from "@/components/VoiceSelector";
import { VoiceId } from "@/lib/scenarios";
import {
  LiveServerEvent,
  createInputAudioMuteEvent,
  createInputAudioUnmuteEvent,
  createInstructionsAppendEvent,
  createSessionCloseEvent,
  getAudioStream,
} from "@/lib/openai-live";

// Wrapper to provide Suspense boundary for useSearchParams
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

  const title = searchParams.get("title") || "Conversation";
  const icon = searchParams.get("icon") || "🎭";
  const instructions = searchParams.get("instructions") || "";

  const [selectedVoice, setSelectedVoice] = useState<VoiceId>("alloy");

  // Connection state
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  // Steerability / mid-session instruction state
  const [customInstruction, setCustomInstruction] = useState("");
  const [instructionFeedback, setInstructionFeedback] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const appendTranscriptDelta = useCallback(
    (role: "user" | "assistant", delta: string) => {
      if (!delta) return;
      setTranscript((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].role === role) {
          const last = prev[prev.length - 1];
          const updated: TranscriptEntry = {
            ...last,
            text: last.text + delta,
          };
          return [...prev.slice(0, -1), updated];
        } else {
          const newEntry: TranscriptEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role,
            text: delta,
            timestamp: new Date(),
          };
          return [...prev, newEntry];
        }
      });
    },
    []
  );

  const disconnect = useCallback(() => {
    if (dcRef.current) {
      try {
        if (dcRef.current.readyState === "open") {
          dcRef.current.send(JSON.stringify(createSessionCloseEvent()));
        }
        dcRef.current.close();
      } catch {
        // Ignore channel closing issues
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
    setStatus("disconnected");
  }, []);

  const handleServerEvent = useCallback(
    (event: LiveServerEvent | Record<string, unknown>) => {
      const type = event.type as string;

      switch (type) {
        // Official OpenAI Live transcript deltas
        case "session.input_transcript.delta": {
          const liveDelta = (event as { delta?: string }).delta || "";
          appendTranscriptDelta("user", liveDelta);
          break;
        }
        case "session.output_transcript.delta": {
          const liveDelta = (event as { delta?: string }).delta || "";
          appendTranscriptDelta("assistant", liveDelta);
          break;
        }

        // Session lifecycle
        case "session.started": {
          const startedEvent = event as { session?: { id?: string } };
          if (startedEvent.session?.id) {
            setSessionId(startedEvent.session.id);
          }
          setStatus("connected");
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
          setInstructionFeedback("Instruction applied to live session");
          setTimeout(() => setInstructionFeedback(null), 3500);
          break;
        }
        case "session.closed": {
          setStatus("disconnected");
          break;
        }

        // Legacy / fallback compatibility
        case "response.output_audio_transcript.delta": {
          const delta = (event as { delta?: string }).delta || "";
          appendTranscriptDelta("assistant", delta);
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          const fullText = (event as { transcript?: string }).transcript || "";
          if (fullText) appendTranscriptDelta("user", fullText);
          break;
        }

        // Errors and status notices
        case "error": {
          const err = event as { error?: { message?: string } };
          console.error("OpenAI Live error:", err.error);
          setError(err.error?.message || "An error occurred in the live session");
          break;
        }
      }
    },
    [appendTranscriptDelta]
  );

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    setSessionId(null);

    try {
      // 1. Check secure context (required for getUserMedia on mobile/browsers)
      if (typeof window !== "undefined" && !window.isSecureContext) {
        throw new Error(
          "Microphone access requires HTTPS or localhost. Please access this page via a secure context."
        );
      }

      // 2. Get microphone access
      const stream = await getAudioStream();
      if (!stream) {
        throw new Error(
          "Microphone access failed. Please allow microphone permission in your browser settings and reload."
        );
      }
      streamRef.current = stream;

      // 3. Create AudioContext (use default sample rate for mobile compatibility)
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      // 4. Set up mic analyser for visualizer
      const micSource = audioCtx.createMediaStreamSource(stream);
      const micAnalyserNode = audioCtx.createAnalyser();
      micAnalyserNode.fftSize = 256;
      micSource.connect(micAnalyserNode);
      setMicAnalyser(micAnalyserNode);

      // 5. Create WebRTC peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioTrack = stream.getAudioTracks()[0];
      pc.addTrack(audioTrack, stream);

      // Handle remote audio from OpenAI Live
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
          console.warn("Audio autoplay blocked, will play on next interaction:", playErr);
        });

        const outSource = audioCtx.createMediaStreamSource(remoteStream);
        const outAnalyserNode = audioCtx.createAnalyser();
        outAnalyserNode.fftSize = 256;
        outSource.connect(outAnalyserNode);
        setOutputAnalyser(outAnalyserNode);
      };

      // 6. Create data channel for OpenAI Live events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("connected");
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleServerEvent(msg);
        } catch {
          // Ignore non-JSON
        }
      };

      dc.onclose = () => {
        setStatus("disconnected");
      };

      // 7. Create offer and send to our backend OpenAI Live API route
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sessionRes = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: instructions,
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

      // 8. Set remote description with OpenAI's SDP answer
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err) {
      console.error("Connection error:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
      disconnect();
    }
  }, [instructions, selectedVoice, disconnect, handleServerEvent]);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) {
        const nextMuted = track.enabled; // If enabled, we will disable (mute)
        track.enabled = !track.enabled;
        setIsMuted(nextMuted);

        // Send official Live client event on data channel
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
    if (!customInstruction.trim() || !dcRef.current || dcRef.current.readyState !== "open") {
      return;
    }

    const event = createInstructionsAppendEvent(customInstruction.trim());
    dcRef.current.send(JSON.stringify(event));
    setCustomInstruction("");
    setInstructionFeedback("Sending instruction...");
  }, [customInstruction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      const audioEl = document.getElementById("remote-audio");
      if (audioEl) audioEl.remove();
    };
  }, [disconnect]);

  const statusConfig: Record<
    ConnectionStatus,
    { label: string; color: string; dot: string }
  > = {
    idle: { label: "Ready", color: "text-gray-400", dot: "bg-gray-500" },
    connecting: {
      label: "Connecting...",
      color: "text-amber-400",
      dot: "bg-amber-500 animate-pulse",
    },
    connected: {
      label: "Live Session",
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
    <main className="relative min-h-screen bg-[#0a0a12]">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-0 h-80 w-80 rounded-full bg-purple-700/15 blur-[120px] animate-blob" />
        <div className="absolute -right-40 bottom-0 h-80 w-80 rounded-full bg-indigo-700/15 blur-[120px] animate-blob animation-delay-2000" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
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
            Back
          </button>

          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h1 className="text-lg font-semibold text-white">{title}</h1>
              {sessionId && (
                <div className="text-[11px] font-mono text-gray-500">
                  ID: {sessionId}
                </div>
              )}
            </div>
          </div>

          <div className={`flex items-center gap-2 ${currentStatus.color}`}>
            <span className={`h-2 w-2 rounded-full ${currentStatus.dot}`} />
            <span className="text-sm font-medium">{currentStatus.label}</span>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-6 lg:flex-row">
          {/* Left: Controls + Visualizer */}
          <div className="flex flex-col gap-6 lg:w-1/2">
            {/* Visualizer Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              {/* Voice selector */}
              <div className="mb-6">
                <VoiceSelector
                  selectedVoice={selectedVoice}
                  onSelect={setSelectedVoice}
                  disabled={status === "connected" || status === "connecting"}
                />
              </div>

              {/* Audio Visualizers */}
              <div className="mb-6 space-y-4">
                <AudioVisualizer
                  analyserNode={micAnalyser}
                  isActive={status === "connected" && !isMuted}
                  label="Your Microphone"
                  color="#a855f7"
                />
                <AudioVisualizer
                  analyserNode={outputAnalyser}
                  isActive={status === "connected"}
                  label="Live AI Response"
                  color="#34d399"
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                {status === "idle" || status === "disconnected" || status === "error" ? (
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
                    Start Live Session
                  </button>
                ) : status === "connecting" ? (
                  <div className="flex items-center gap-3 rounded-full bg-amber-500/20 px-8 py-3.5 text-sm font-semibold text-amber-300">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    Connecting Live...
                  </div>
                ) : (
                  <>
                    {/* Mute button */}
                    <button
                      onClick={toggleMute}
                      className={`flex h-12 w-12 items-center justify-center rounded-full 
                        transition-all cursor-pointer ${
                          isMuted
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      title={isMuted ? "Unmute Live Input" : "Mute Live Input"}
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

                    {/* End call */}
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

              {/* Error display */}
              {error && (
                <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
                  <div className="font-medium mb-1">Live Session Error</div>
                  <div className="text-xs text-red-200">{error}</div>
                </div>
              )}
            </div>

            {/* Steerability: Append instructions live mid-session */}
            {status === "connected" && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                    Steer Live Session (session.instructions.append)
                  </h3>
                  {instructionFeedback && (
                    <span className="text-[11px] text-emerald-400 animate-pulse">
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
                    placeholder="Steer model (e.g. 'Speak more casually', 'Ask me about my career')..."
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    onClick={sendLiveInstruction}
                    disabled={!customInstruction.trim()}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-40 hover:bg-purple-500 cursor-pointer"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Scenario info */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Active Scenario Instructions
              </h3>
              <p className="text-sm leading-relaxed text-gray-300 line-clamp-4">
                {instructions || "No scenario specified"}
              </p>
            </div>
          </div>

          {/* Right: Transcript */}
          <div className="min-h-[400px] flex-1 lg:w-1/2">
            <TranscriptPanel entries={transcript} />
          </div>
        </div>
      </div>
    </main>
  );
}
