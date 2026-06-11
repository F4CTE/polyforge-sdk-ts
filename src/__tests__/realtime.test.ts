import { inspect } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { createRealtimeClient, PolyforgeRealtimeClient } from '../realtime';
import type { PolyforgeWebSocketLike, RealtimeServerEvent } from '../types';

class FakeWebSocket implements PolyforgeWebSocketLike {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason?: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.onclose?.({ code: code ?? 1000, reason });
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  closeFromServer(code = 1006, reason?: string): void {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

function makeClient(options: { reconnect?: boolean; wsUrl?: string } = {}): PolyforgeRealtimeClient {
  FakeWebSocket.instances = [];
  return createRealtimeClient('https://api.polyforge.app', 'secret-token', {
    WebSocket: FakeWebSocket,
    reconnectMinDelayMs: 1,
    reconnectMaxDelayMs: 1,
    ...options,
  });
}

describe('Realtime WebSocket client', () => {
  it('rejects remote plaintext websocket URLs before appending credentials', () => {
    expect(() => makeClient({ wsUrl: 'ws://api.example.com/ws' })).toThrow('Non-localhost WebSocket URLs must use WSS');
  });

  it('redacts token credentials from JSON and Node inspection', () => {
    const client = makeClient();

    expect(JSON.stringify(client)).toContain('token=[REDACTED]');
    expect(JSON.stringify(client)).not.toContain('secret-token');
    expect(inspect(client)).toContain('token=[REDACTED]');
    expect(inspect(client)).not.toContain('secret-token');
  });

  it('does not queue failed subscriptions while disconnected', async () => {
    const client = makeClient({ reconnect: false });

    expect(() => client.subscribePrices(['tok-1'])).toThrow('WebSocket is not connected');

    const connect = client.connect();
    FakeWebSocket.instances[0].open();
    await connect;

    expect(FakeWebSocket.instances[0].sent).toEqual([]);
  });

  it('replays price, strategy, and whale subscriptions after reconnect', async () => {
    vi.useFakeTimers();
    try {
      const client = makeClient();
      const connect = client.connect();
      FakeWebSocket.instances[0].open();
      await connect;

      client.subscribePrices(['tok-1']);
      client.subscribeStrategy('strategy-1');
      client.subscribeWhales();
      FakeWebSocket.instances[0].sent = [];

      FakeWebSocket.instances[0].closeFromServer();
      await vi.runOnlyPendingTimersAsync();
      FakeWebSocket.instances[1].open();

      expect(FakeWebSocket.instances[1].sent.map((item) => JSON.parse(item))).toEqual([
        { type: 'SUBSCRIBE_PRICES', tokenIds: ['tok-1'] },
        { type: 'SUBSCRIBE_STRATEGY', strategyId: 'strategy-1' },
        { type: 'SUBSCRIBE_WHALES' },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('updates desired unsubscribe state during reconnect gaps', async () => {
    vi.useFakeTimers();
    try {
      const client = makeClient();
      const connect = client.connect();
      FakeWebSocket.instances[0].open();
      await connect;

      client.subscribePrices(['tok-1']);
      client.subscribeStrategy('strategy-1');
      client.subscribeWhales();
      FakeWebSocket.instances[0].closeFromServer();

      client.unsubscribePrices(['tok-1']);
      client.unsubscribeStrategy('strategy-1');
      client.unsubscribeWhales();

      await vi.runOnlyPendingTimersAsync();
      FakeWebSocket.instances[1].open();

      expect(FakeWebSocket.instances[1].sent).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles an in-flight connect when closed during the handshake', async () => {
    const client = makeClient();
    const connect = client.connect();

    client.close(1000, 'cancelled');

    await expect(connect).rejects.toMatchObject({ code: 'WEBSOCKET_CLOSED' });

    const nextConnect = client.connect();
    FakeWebSocket.instances[1].open();
    await expect(nextConnect).resolves.toBeUndefined();
  });

  it('keeps realtime server events discriminated by gateway type', () => {
    type PriceEvent = Extract<RealtimeServerEvent, { type: 'PRICE_UPDATE' }>;
    const event: PriceEvent = {
      type: 'PRICE_UPDATE',
      data: { tokenId: 'tok-1', price: 0.42, timestamp: 1 },
      timestamp: 1,
    };

    expect(event.data.price).toBe(0.42);
  });
});
