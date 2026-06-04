import { inspect } from 'node:util';
import { PolyforgeError } from './errors.js';
import type {
  PolyforgeRealtimeConnectionOptions,
  PolyforgeRealtimeOptions,
  PolyforgeWebSocketConstructor,
  PolyforgeWebSocketLike,
  RealtimeClientMessage,
  RealtimeServerEvent,
} from './types.js';

const MAX_PRICE_SUBSCRIPTIONS = 200;
const MAX_STRATEGY_SUBSCRIPTIONS = 200;
const DEFAULT_RECONNECT_MIN_DELAY_MS = 500;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 10_000;
const TERMINAL_CLOSE_CODES = new Set([4001, 4003, 4008]);

type RealtimeListener = (event: RealtimeServerEvent) => void;
type ErrorListener = (error: unknown) => void;
type CloseListener = (event: { code: number; reason?: string; terminal: boolean }) => void;

function toWebSocketUrl(apiUrl: string, token: string, override?: string): string {
  const url = new URL(override ?? apiUrl);
  if (!override) {
    url.pathname = '/ws';
    url.search = '';
    url.hash = '';
  }

  if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  } else if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  } else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('WebSocket URL must use ws, wss, http, or https');
  }

  if (url.protocol === 'ws:' && !isLocalWebSocketHost(url.hostname)) {
    throw new Error('Non-localhost WebSocket URLs must use WSS');
  }

  url.searchParams.set('token', token);
  return url.toString();
}

function isLocalWebSocketHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
  if (host === 'localhost' || host === 'localhost.localdomain' || host === '0.0.0.0' || host === '::1') {
    return true;
  }
  if (/^127(?:\.\d{1,3}){3}$/.test(host)) {
    return true;
  }
  return host.endsWith('.localhost');
}

function getDefaultWebSocketConstructor(): PolyforgeWebSocketConstructor {
  const ctor = (globalThis as { WebSocket?: PolyforgeWebSocketConstructor }).WebSocket;
  if (!ctor) {
    throw new PolyforgeError({
      status: 0,
      code: 'WEBSOCKET_UNAVAILABLE',
      message: 'No WebSocket implementation is available. Pass options.WebSocket in this runtime.',
    });
  }
  return ctor;
}

function addSocketListener(
  socket: PolyforgeWebSocketLike,
  type: 'open' | 'message' | 'close' | 'error',
  listener: (event?: unknown) => void,
): void {
  if (typeof socket.addEventListener === 'function') {
    socket.addEventListener(type as 'open', listener as () => void);
    return;
  }

  const key = `on${type}` as 'onopen' | 'onmessage' | 'onclose' | 'onerror';
  const previous = socket[key] as ((event?: unknown) => void) | null | undefined;
  socket[key] = ((event?: unknown) => {
    previous?.(event);
    listener(event);
  }) as never;
}

async function messageDataToString(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof Uint8Array) return new TextDecoder().decode(data);
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (Array.isArray(data)) return data.map((part) => String(part)).join('');
  if (data && typeof data === 'object' && 'text' in data && typeof data.text === 'function') {
    return (await (data as { text(): Promise<string> }).text());
  }
  return String(data);
}

/**
 * Client for the authenticated `/ws` gateway.
 *
 * The platform currently accepts the token as a `?token=` query parameter. That
 * path is marked deprecated server-side, but browser WebSocket APIs cannot set a
 * Cookie header; this keeps the SDK compatible with browser and injected-WS
 * runtimes without adding a runtime dependency.
 */
export class PolyforgeRealtimeClient {
  private readonly url: string;
  private readonly WebSocket: PolyforgeWebSocketConstructor;
  private readonly reconnect: boolean;
  private readonly reconnectMinDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly listeners = new Set<RealtimeListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private readonly closeListeners = new Set<CloseListener>();
  private readonly priceSubscriptions = new Set<string>();
  private readonly strategySubscriptions = new Set<string>();
  private whaleSubscribed = false;
  private socket: PolyforgeWebSocketLike | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private connecting: Promise<void> | null = null;

  constructor(options: PolyforgeRealtimeConnectionOptions) {
    this.url = toWebSocketUrl(options.apiUrl, options.token, options.wsUrl);
    this.WebSocket = options.WebSocket ?? getDefaultWebSocketConstructor();
    this.reconnect = options.reconnect ?? true;
    this.reconnectMinDelayMs = options.reconnectMinDelayMs ?? DEFAULT_RECONNECT_MIN_DELAY_MS;
    this.reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS;
  }

  toJSON(): Record<string, unknown> {
    const redacted = new URL(this.url);
    redacted.searchParams.set('token', '[REDACTED]');
    return { url: redacted.toString().replace('token=%5BREDACTED%5D', 'token=[REDACTED]'), connected: this.isConnected() };
  }

  [inspect.custom](): Record<string, unknown> {
    return this.toJSON();
  }

  isConnected(): boolean {
    return this.socket?.readyState === 1;
  }

  connect(): Promise<void> {
    if (this.isConnected()) return Promise.resolve();
    if (this.connecting) return this.connecting;

    this.closedByUser = false;
    this.connecting = new Promise((resolve, reject) => {
      let settled = false;
      const socket = new this.WebSocket(this.url);
      this.socket = socket;

      addSocketListener(socket, 'open', () => {
        if (socket !== this.socket) return;
        settled = true;
        this.connecting = null;
        this.reconnectAttempts = 0;
        resolve();
        this.replaySubscriptions();
      });
      addSocketListener(socket, 'message', (event) => {
        if (socket !== this.socket) return;
        void this.handleMessage((event as { data?: unknown } | undefined)?.data);
      });
      addSocketListener(socket, 'error', (event) => {
        if (socket !== this.socket) return;
        this.emitError(event);
        if (!settled) {
          settled = true;
          this.connecting = null;
          reject(event);
        }
      });
      addSocketListener(socket, 'close', (event) => {
        if (socket !== this.socket) return;
        const closeEvent = event as { code?: number; reason?: string } | undefined;
        const code = closeEvent?.code ?? 1006;
        const reason = closeEvent?.reason;
        const terminal = TERMINAL_CLOSE_CODES.has(code);
        this.connecting = null;
        this.emitClose({ code, reason, terminal });
        if (!settled) {
          settled = true;
          reject(new PolyforgeError({
            status: 0,
            code: 'WEBSOCKET_CLOSED',
            message: reason ? `WebSocket closed before opening (${code}): ${reason}` : `WebSocket closed before opening (${code})`,
          }));
        }
        if (!this.closedByUser && this.reconnect && !terminal) {
          this.scheduleReconnect();
        }
      });
    });

    return this.connecting;
  }

  close(code?: number, reason?: string): void {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close(code, reason);
    this.socket = null;
  }

  onMessage(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onClose(listener: CloseListener): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  ping(): void {
    this.send({ type: 'PING' });
  }

  subscribePrices(tokenIds: string[]): void {
    this.assertTokenSubscriptions(tokenIds);
    this.send({ type: 'SUBSCRIBE_PRICES', tokenIds });
    for (const tokenId of tokenIds) this.priceSubscriptions.add(tokenId);
  }

  unsubscribePrices(tokenIds: string[]): void {
    this.updateTokenSet(tokenIds, false);
    this.sendIfConnected({ type: 'UNSUBSCRIBE_PRICES', tokenIds });
  }

  subscribeStrategy(strategyId: string): void {
    this.assertSubscriptionId('strategyId', strategyId);
    if (!this.strategySubscriptions.has(strategyId) && this.strategySubscriptions.size >= MAX_STRATEGY_SUBSCRIPTIONS) {
      throw new PolyforgeError({
        status: 0,
        code: 'SUBSCRIPTION_LIMIT_EXCEEDED',
        message: `A WebSocket connection can subscribe to at most ${MAX_STRATEGY_SUBSCRIPTIONS} strategies`,
      });
    }
    this.send({ type: 'SUBSCRIBE_STRATEGY', strategyId });
    this.strategySubscriptions.add(strategyId);
  }

  unsubscribeStrategy(strategyId: string): void {
    this.assertSubscriptionId('strategyId', strategyId);
    this.strategySubscriptions.delete(strategyId);
    this.sendIfConnected({ type: 'UNSUBSCRIBE_STRATEGY', strategyId });
  }

  subscribeWhales(): void {
    this.send({ type: 'SUBSCRIBE_WHALES' });
    this.whaleSubscribed = true;
  }

  unsubscribeWhales(): void {
    this.whaleSubscribed = false;
    this.sendIfConnected({ type: 'UNSUBSCRIBE_WHALES' });
  }

  send(message: RealtimeClientMessage): void {
    if (!this.isConnected() || !this.socket) {
      throw new PolyforgeError({
        status: 0,
        code: 'WEBSOCKET_NOT_CONNECTED',
        message: 'WebSocket is not connected; call connect() before sending messages',
      });
    }
    this.socket.send(JSON.stringify(message));
  }

  private sendIfConnected(message: RealtimeClientMessage): void {
    if (!this.isConnected() || !this.socket) return;
    this.socket.send(JSON.stringify(message));
  }

  private updateTokenSet(tokenIds: string[], subscribe: boolean): void {
    this.assertTokenIds(tokenIds);

    if (!subscribe) {
      for (const tokenId of tokenIds) this.priceSubscriptions.delete(tokenId);
    }
  }

  private assertTokenSubscriptions(tokenIds: string[]): void {
    this.assertTokenIds(tokenIds);
    const next = new Set([...this.priceSubscriptions, ...tokenIds]);
    if (next.size > MAX_PRICE_SUBSCRIPTIONS) {
      throw new PolyforgeError({
        status: 0,
        code: 'SUBSCRIPTION_LIMIT_EXCEEDED',
        message: `A WebSocket connection can subscribe to at most ${MAX_PRICE_SUBSCRIPTIONS} token prices`,
      });
    }
  }

  private assertTokenIds(tokenIds: string[]): void {
    if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
      throw new PolyforgeError({
        status: 0,
        code: 'VALIDATION_ERROR',
        message: 'tokenIds must be a non-empty array',
      });
    }
    for (const tokenId of tokenIds) this.assertSubscriptionId('tokenId', tokenId);
  }

  private assertSubscriptionId(name: string, value: string): void {
    if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
      throw new PolyforgeError({
        status: 0,
        code: 'VALIDATION_ERROR',
        message: `${name} must be a non-empty string up to 128 characters`,
      });
    }
  }

  private replaySubscriptions(): void {
    if (this.priceSubscriptions.size > 0) {
      this.send({ type: 'SUBSCRIBE_PRICES', tokenIds: [...this.priceSubscriptions] });
    }
    for (const strategyId of this.strategySubscriptions) {
      this.send({ type: 'SUBSCRIBE_STRATEGY', strategyId });
    }
    if (this.whaleSubscribed) {
      this.send({ type: 'SUBSCRIBE_WHALES' });
    }
  }

  private async handleMessage(data: unknown): Promise<void> {
    let raw = await messageDataToString(data);
    raw = raw.trim();
    if (!raw || raw.startsWith(':')) return;

    try {
      const parsed = JSON.parse(raw) as RealtimeServerEvent;
      if (typeof parsed.type !== 'string') return;
      for (const listener of this.listeners) listener(parsed);
    } catch (error) {
      this.emitError(error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      this.reconnectMaxDelayMs,
      this.reconnectMinDelayMs * 2 ** this.reconnectAttempts,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => this.emitError(error));
    }, delay);
  }

  private emitError(error: unknown): void {
    for (const listener of this.errorListeners) listener(error);
  }

  private emitClose(event: { code: number; reason?: string; terminal: boolean }): void {
    for (const listener of this.closeListeners) listener(event);
  }
}

export function createRealtimeClient(
  apiUrl: string,
  token: string,
  options: PolyforgeRealtimeOptions = {},
): PolyforgeRealtimeClient {
  return new PolyforgeRealtimeClient({ ...options, apiUrl, token });
}
