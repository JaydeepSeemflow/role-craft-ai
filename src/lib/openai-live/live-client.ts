/**
 * OpenAI Live Primary WebSocket Client
 * Connects to wss://api.openai.com/v1/live/sessions
 * Sends session.start and listens for server events.
 */

import {
  LiveClientEvent,
  LiveServerEvent,
  LiveSessionConfig,
  SessionStartEvent,
  createSessionStartEvent,
  createInputAudioAppendEvent,
  createInputAudioMuteEvent,
  createInputAudioUnmuteEvent,
  createInstructionsAppendEvent,
  createSessionCloseEvent,
} from "./types";

export interface LiveWebSocketClientOptions {
  apiKey?: string;
  url?: string;
  config: LiveSessionConfig;
  onEvent?: (event: LiveServerEvent) => void;
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: Event | Error) => void;
}

export class LiveWebSocketClient {
  private ws: WebSocket | null = null;
  private options: LiveWebSocketClientOptions;
  private isStarted = false;

  constructor(options: LiveWebSocketClientOptions) {
    this.options = options;
  }

  public connect(customHeaders?: Record<string, string>): void {
    const defaultUrl = "wss://api.openai.com/v1/live/sessions";
    const url = this.options.url || defaultUrl;

    // When running in a browser, direct WebSocket to api.openai.com cannot include
    // Authorization header directly unless via a backend proxy or query (if supported).
    // This client supports standard WebSocket interfaces.
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.options.onOpen?.();
      // Send initial session.start event as required by the Live WebSocket specification
      const startEvent: SessionStartEvent = createSessionStartEvent(this.options.config);
      this.send(startEvent);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = typeof event.data === "string" ? event.data : event.data.toString();
        const serverEvent = JSON.parse(data) as LiveServerEvent;

        if (serverEvent.type === "session.started") {
          this.isStarted = true;
        }

        this.options.onEvent?.(serverEvent);
      } catch (parseErr) {
        console.warn("Failed to parse server message:", parseErr);
      }
    };

    this.ws.onerror = (err) => {
      this.options.onError?.(err);
    };

    this.ws.onclose = (event) => {
      this.isStarted = false;
      this.options.onClose?.(event.code, event.reason);
    };
  }

  public send(event: LiveClientEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected; unable to send event:", event.type);
      return;
    }
    this.ws.send(JSON.stringify(event));
  }

  public sendAudioChunk(base64Audio: string): void {
    if (!this.isStarted) {
      console.warn("Session not started yet. Waiting for session.started before sending audio.");
      return;
    }
    this.send(createInputAudioAppendEvent(base64Audio));
  }

  public mute(): void {
    this.send(createInputAudioMuteEvent());
  }

  public unmute(): void {
    this.send(createInputAudioUnmuteEvent());
  }

  public appendInstructions(text: string): void {
    this.send(createInstructionsAppendEvent(text));
  }

  public close(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send(createSessionCloseEvent());
      this.ws.close();
    }
    this.ws = null;
    this.isStarted = false;
  }
}
