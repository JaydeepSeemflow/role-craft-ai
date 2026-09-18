/**
 * Types and schemas for OpenAI Live Session API
 * Reference: https://developers.openai.com/api/reference/resources/live/primary-websocket#client-events
 */

// ============================================================================
// Common & Shared Types
// ============================================================================

export type LiveModel = "gpt-live-1" | string;

export interface AudioFormatPCM {
  type: "audio/pcm";
  rate: 24000;
}

export type LiveAudioFormat = AudioFormatPCM | { type: string; rate?: number };

export interface AudioOutputConfig {
  voice?: string;
}

export interface AudioConfig {
  format?: LiveAudioFormat;
  output?: AudioOutputConfig;
}

export interface ClientDelegationConfig {
  type: "client";
}

export interface ResponsesDelegationConfig {
  type: "responses";
  responses?: {
    instructions?: string;
    max_output_tokens?: number;
  };
}

export type LiveDelegationConfig = ClientDelegationConfig | ResponsesDelegationConfig;

export interface LiveSessionConfig {
  model?: LiveModel;
  instructions?: string;
  audio?: AudioConfig;
  delegation?: LiveDelegationConfig;
  input?: unknown[];
}

export interface LiveSessionResource extends LiveSessionConfig {
  id: string;
  status: "active" | "closed" | string;
  expires_at?: number;
}

// ============================================================================
// Client Events (Sent from Client to Server)
// ============================================================================

/**
 * session.start
 * Start a Live session on a primary WebSocket. Send this event before other
 * commands and wait for session.started.
 */
export interface SessionStartEvent {
  type: "session.start";
  event_id?: string | null;
  session: LiveSessionConfig;
}

/**
 * session.update
 * Update the delegation settings of an active Live session.
 */
export interface SessionUpdateEvent {
  type: "session.update";
  event_id?: string | null;
  session: {
    delegation: LiveDelegationConfig;
  };
}

/**
 * session.input_audio.append
 * Send raw audio to a Live session over its primary WebSocket.
 * Audio is base64-encoded PCM16LE 24kHz without a container header.
 */
export interface SessionInputAudioAppendEvent {
  type: "session.input_audio.append";
  event_id?: string | null;
  audio: string;
}

/**
 * session.input_audio.mute
 * Mute audio input to the Live model without closing the session.
 */
export interface SessionInputAudioMuteEvent {
  type: "session.input_audio.mute";
  event_id?: string | null;
}

/**
 * session.input_audio.unmute
 * Resume audio input to a Live model after muting it.
 */
export interface SessionInputAudioUnmuteEvent {
  type: "session.input_audio.unmute";
  event_id?: string | null;
}

/**
 * session.instructions.append
 * Append instructions to the Live conversation while it is running.
 */
export interface SessionInstructionsAppendEvent {
  type: "session.instructions.append";
  event_id?: string | null;
  content: string;
  delegation_id?: string | null;
}

/**
 * session.thinking.append
 * Provide silent reasoning or progress context to the Live model.
 */
export interface SessionThinkingAppendEvent {
  type: "session.thinking.append";
  event_id?: string | null;
  content: string;
  delegation_id?: string | null;
}

/**
 * session.commentary.append
 * Provide speakable context the Live model can communicate to the user.
 */
export interface SessionCommentaryAppendEvent {
  type: "session.commentary.append";
  event_id?: string | null;
  content: string;
  delegation_id?: string | null;
}

/**
 * response.item.create
 * Add an input item to the Live session's Responses backend.
 */
export interface ResponseItemCreateEvent {
  type: "response.item.create";
  event_id?: string | null;
  item: {
    role: "user" | "assistant" | "system";
    content: unknown;
    [key: string]: unknown;
  };
}

/**
 * response.create
 * Request a response from the Live session's Responses backend.
 */
export interface ResponseCreateEvent {
  type: "response.create";
  event_id?: string | null;
}

/**
 * session.close
 * Request that the Live session close.
 */
export interface SessionCloseEvent {
  type: "session.close";
  event_id?: string | null;
}

export type LiveClientEvent =
  | SessionStartEvent
  | SessionUpdateEvent
  | SessionInputAudioAppendEvent
  | SessionInputAudioMuteEvent
  | SessionInputAudioUnmuteEvent
  | SessionInstructionsAppendEvent
  | SessionThinkingAppendEvent
  | SessionCommentaryAppendEvent
  | ResponseItemCreateEvent
  | ResponseCreateEvent
  | SessionCloseEvent;

// ============================================================================
// Server Events (Received from Server)
// ============================================================================

export interface BaseServerEvent {
  type: string;
  event_id: string;
  client_event_id?: string;
}

/**
 * session.started
 * Returned when a Live session has started.
 */
export interface SessionStartedEvent extends BaseServerEvent {
  type: "session.started";
  session: LiveSessionResource;
}

/**
 * session.updated
 * Returned when a Live session update is accepted.
 */
export interface SessionUpdatedEvent extends BaseServerEvent {
  type: "session.updated";
  session: LiveSessionResource;
}

/**
 * session.input_audio.muted
 * Acknowledges audio input muted.
 */
export interface SessionInputAudioMutedEvent extends BaseServerEvent {
  type: "session.input_audio.muted";
}

/**
 * session.input_audio.unmuted
 * Acknowledges audio input unmuted.
 */
export interface SessionInputAudioUnmutedEvent extends BaseServerEvent {
  type: "session.input_audio.unmuted";
}

/**
 * session.instructions.appended
 */
export interface SessionInstructionsAppendedEvent extends BaseServerEvent {
  type: "session.instructions.appended";
  start_ms?: number;
  end_ms?: number;
}

/**
 * session.thinking.appended
 */
export interface SessionThinkingAppendedEvent extends BaseServerEvent {
  type: "session.thinking.appended";
  start_ms?: number;
  end_ms?: number;
}

/**
 * session.commentary.appended
 */
export interface SessionCommentaryAppendedEvent extends BaseServerEvent {
  type: "session.commentary.appended";
  start_ms?: number;
  end_ms?: number;
}

/**
 * session.output_audio.delta
 * Raw base64-encoded audio delta from the Live model.
 */
export interface SessionOutputAudioDeltaEvent extends BaseServerEvent {
  type: "session.output_audio.delta";
  delta: string;
}

/**
 * session.input_transcript.delta
 * Real-time transcript delta for user's input audio.
 */
export interface SessionInputTranscriptDeltaEvent extends BaseServerEvent {
  type: "session.input_transcript.delta";
  delta: string;
  start_ms?: number;
  end_ms?: number;
}

/**
 * session.output_transcript.delta
 * Real-time transcript delta for assistant's generated speech.
 */
export interface SessionOutputTranscriptDeltaEvent extends BaseServerEvent {
  type: "session.output_transcript.delta";
  delta: string;
  start_ms?: number;
  end_ms?: number;
}

/**
 * session.delegation.created
 */
export interface SessionDelegationCreatedEvent extends BaseServerEvent {
  type: "session.delegation.created";
  delegation: {
    id: string;
    target?: string;
    type?: string;
    response_id?: string;
  };
}

/**
 * response.event
 */
export interface ResponseEvent extends BaseServerEvent {
  type: "response.event";
  event: Record<string, unknown>;
}

/**
 * session.usage.updated
 */
export interface SessionUsageUpdatedEvent extends BaseServerEvent {
  type: "session.usage.updated";
  usage?: Record<string, unknown>;
}

/**
 * session.closed
 */
export interface SessionClosedEvent extends BaseServerEvent {
  type: "session.closed";
  reason?: string;
  usage?: Record<string, unknown>;
}

/**
 * error
 */
export interface LiveErrorEvent extends BaseServerEvent {
  type: "error";
  error: {
    message: string;
    type?: string;
    code?: string;
    param?: string | null;
  };
}

/**
 * info
 */
export interface LiveInfoEvent extends BaseServerEvent {
  type: "info";
  code: string;
  message?: string;
}

export type LiveServerEvent =
  | SessionStartedEvent
  | SessionUpdatedEvent
  | SessionInputAudioMutedEvent
  | SessionInputAudioUnmutedEvent
  | SessionInstructionsAppendedEvent
  | SessionThinkingAppendedEvent
  | SessionCommentaryAppendedEvent
  | SessionOutputAudioDeltaEvent
  | SessionInputTranscriptDeltaEvent
  | SessionOutputTranscriptDeltaEvent
  | SessionDelegationCreatedEvent
  | ResponseEvent
  | SessionUsageUpdatedEvent
  | SessionClosedEvent
  | LiveErrorEvent
  | LiveInfoEvent;

// ============================================================================
// Event Creator Helpers
// ============================================================================

export function generateEventId(prefix = "evt"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSessionStartEvent(config: LiveSessionConfig): SessionStartEvent {
  return {
    type: "session.start",
    event_id: generateEventId("start"),
    session: {
      model: config.model || "gpt-live-1",
      instructions: config.instructions,
      audio: config.audio || {
        format: { type: "audio/pcm", rate: 24000 },
        output: { voice: "alloy" },
      },
      delegation: config.delegation || { type: "client" },
    },
  };
}

export function createInputAudioAppendEvent(base64Audio: string): SessionInputAudioAppendEvent {
  return {
    type: "session.input_audio.append",
    audio: base64Audio,
  };
}

export function createInputAudioMuteEvent(): SessionInputAudioMuteEvent {
  return {
    type: "session.input_audio.mute",
    event_id: generateEventId("mute"),
  };
}

export function createInputAudioUnmuteEvent(): SessionInputAudioUnmuteEvent {
  return {
    type: "session.input_audio.unmute",
    event_id: generateEventId("unmute"),
  };
}

export function createInstructionsAppendEvent(
  content: string,
  delegationId?: string | null
): SessionInstructionsAppendEvent {
  return {
    type: "session.instructions.append",
    event_id: generateEventId("instructions"),
    content,
    delegation_id: delegationId ?? null,
  };
}

export function createThinkingAppendEvent(
  content: string,
  delegationId?: string | null
): SessionThinkingAppendEvent {
  return {
    type: "session.thinking.append",
    event_id: generateEventId("thinking"),
    content,
    delegation_id: delegationId ?? null,
  };
}

export function createCommentaryAppendEvent(
  content: string,
  delegationId?: string | null
): SessionCommentaryAppendEvent {
  return {
    type: "session.commentary.append",
    event_id: generateEventId("commentary"),
    content,
    delegation_id: delegationId ?? null,
  };
}

export function createResponseCreateEvent(): ResponseCreateEvent {
  return {
    type: "response.create",
    event_id: generateEventId("resp"),
  };
}

export function createSessionCloseEvent(): SessionCloseEvent {
  return {
    type: "session.close",
    event_id: generateEventId("close"),
  };
}
