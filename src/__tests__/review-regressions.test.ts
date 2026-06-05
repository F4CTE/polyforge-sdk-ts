import { describe, expect, it, vi } from 'vitest';
import { PolyforgeClient } from '../client';
import type { BatchRequestItem, SmartOrder } from '../types';

describe('PR #277 review regressions', () => {
  it('keeps getStrategyHealth on the public client', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'RUNNING' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
      await client.getStrategyHealth('strategy-1');

      expect(new URL(fetchSpy.mock.calls[0][0] as string).pathname).toBe('/api/v1/strategies/strategy-1/health');
      expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('keeps listSmartOrders typed and parsed as the bare array response', async () => {
    const smartOrders: SmartOrder[] = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(smartOrders), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
      const result: SmartOrder[] = await client.listSmartOrders();

      expect(result).toEqual([]);
      expect(new URL(fetchSpy.mock.calls[0][0] as string).pathname).toBe('/api/v1/orders/smart');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('does not type unsupported PUT batch requests', () => {
    const item: BatchRequestItem = { id: '1', method: 'POST', path: '/ok' };
    // @ts-expect-error PUT is not supported by the platform batch endpoint.
    const unsupported: BatchRequestItem = { id: '2', method: 'PUT', path: '/nope' };

    expect(item.method).toBe('POST');
    expect(unsupported.method).toBe('PUT');
  });
});
