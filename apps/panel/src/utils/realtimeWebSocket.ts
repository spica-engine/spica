import { ChunkKind, type StreamChunk } from '../types/realtime';

export interface RealtimeWebSocketOptions {
  filter?: Record<string, any>;
  sort?: Record<string, any>;
  limit?: number;
  skip?: number;
}

interface RealtimeWebSocketHandle {
  onMessage: (callback: (chunk: StreamChunk) => void) => void;
  close: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;

/**
 * Creates a WebSocket connection to a Spica realtime endpoint.
 *
 * @param path - The API path (e.g., "/bucket" or "/bucket/:id/data")
 * @param token - The auth token (will be sent as `Authorization=IDENTITY <token>` query param)
 * @param options - Optional filter, sort, limit, skip query params
 * @returns A handle with `onMessage` to subscribe and `close` to tear down
 */
export function createRealtimeWebSocket(
  path: string,
  token: string | null,
  options?: RealtimeWebSocketOptions
): RealtimeWebSocketHandle {
  let messageCallback: ((chunk: StreamChunk) => void) | null = null;
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let closed = false;

  function buildUrl(): string {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = import.meta.env.VITE_BASE_URL || '/api';

    // If VITE_BASE_URL is absolute (http(s)://...), parse it; otherwise use window.location.host
    let host: string;
    let basePath: string;
    if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
      const parsed = new URL(baseUrl);
      host = parsed.host;
      basePath = parsed.pathname.replace(/\/$/, '');
    } else {
      host = loc.host;
      basePath = baseUrl.replace(/\/$/, '');
    }

    const params = new URLSearchParams();
    if (token) {
      params.set('Authorization', `IDENTITY ${token}`);
    }
    if (options?.filter) {
      params.set('filter', JSON.stringify(options.filter));
    }
    if (options?.sort) {
      params.set('sort', JSON.stringify(options.sort));
    }
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options?.skip !== undefined) {
      params.set('skip', String(options.skip));
    }

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${protocol}//${host}${basePath}${cleanPath}?${params.toString()}`;
  }

  function connect() {
    if (closed) return;

    const url = buildUrl();
    ws = new WebSocket(url);

    ws.onmessage = (event: MessageEvent) => {
      if (!messageCallback) return;
      try {
        const chunk: StreamChunk = JSON.parse(event.data);
        messageCallback(chunk);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onopen = () => {
      reconnectAttempts = 0;
    };

    ws.onclose = (event: CloseEvent) => {
      if (closed) return;

      // Reconnect on abnormal closure (code 1006) or server-initiated close that isn't auth failure
      if (event.code === 1006 || (event.code >= 1001 && event.code <= 1004)) {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts);
          reconnectAttempts++;
          setTimeout(connect, delay);
        }
      }
    };

    ws.onerror = () => {
      // The close event will fire after this — reconnection is handled there
    };
  }

  connect();

  return {
    onMessage(callback: (chunk: StreamChunk) => void) {
      messageCallback = callback;
    },
    close() {
      closed = true;
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }
    },
  };
}
