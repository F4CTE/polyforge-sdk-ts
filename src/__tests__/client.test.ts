import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PolyforgeClient, isBlockedHost, validateWebhookUrl } from '../client';
import { PolyforgeError } from '../errors';
import { KNOWN_STRATEGY_EVENTS } from '../types';
import type { StrategyStatusResponse, PaginatedResponse, Strategy } from '../types';

// Mock node:dns/promises at the module level for ESM compatibility.
vi.mock('node:dns/promises', () => ({
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));

import { resolve4, resolve6 } from 'node:dns/promises';

const mockResolve4 = vi.mocked(resolve4);
const mockResolve6 = vi.mocked(resolve6);

describe('PolyforgeClient', () => {
  describe('constructor', () => {
    it('should instantiate with valid apiKey', () => {
      const client = new PolyforgeClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should use default baseUrl when not provided', () => {
      const client = new PolyforgeClient({ apiKey: 'test-key' });
      expect(client).toBeDefined();
    });

    it('should use custom baseUrl when provided', () => {
      const client = new PolyforgeClient({
        apiKey: 'test-key',
        apiUrl: 'https://api.example.com/',
      });
      expect(client).toBeDefined();
    });

    it('should use custom timeout when provided', () => {
      const client = new PolyforgeClient({
        apiKey: 'test-key',
        timeout: 30000,
      });
      expect(client).toBeDefined();
    });

    it('should throw error when apiKey is missing', () => {
      expect(() => {
        new PolyforgeClient({ apiKey: '' });
      }).toThrow('apiKey is required');
    });

    it('should throw error when apiKey is not provided', () => {
      expect(() => {
        new PolyforgeClient({ apiKey: undefined as any });
      }).toThrow('apiKey is required');
    });
  });

  describe('URL construction', () => {
    it('should normalize baseUrl by removing trailing slashes', () => {
      const clientWithSlash = new PolyforgeClient({
        apiKey: 'test-key',
        apiUrl: 'http://localhost:3002///',
      });
      expect(clientWithSlash).toBeDefined();
    });

    it('should handle URL paths correctly', () => {
      const client = new PolyforgeClient({
        apiKey: 'test-key',
        apiUrl: 'https://api.example.com',
      });
      expect(client).toBeDefined();
    });
  });

  describe('HTTPS enforcement', () => {
    it('should reject HTTP for non-local hosts', () => {
      expect(() => new PolyforgeClient({ apiKey: 'k', apiUrl: 'http://api.example.com' }))
        .toThrow('Non-localhost API URLs must use HTTPS');
    });

    it.each([
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://127.0.0.2:3002',
      'http://0.0.0.0:3002',
      'http://[::1]:3002',
      'http://localhost.localdomain:3002',
    ])('should allow HTTP for local address %s', (url) => {
      expect(() => new PolyforgeClient({ apiKey: 'k', apiUrl: url })).not.toThrow();
    });

    it('should allow HTTPS for any host', () => {
      expect(() => new PolyforgeClient({ apiKey: 'k', apiUrl: 'https://api.example.com' }))
        .not.toThrow();
    });
  });
});

describe('Platform contract compliance', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('aiQuery sends { query } not { question } (#84)', async () => {
    await client.aiQuery('what is BTC?');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ query: 'what is BTC?' });
    expect(body).not.toHaveProperty('question');
  });

  it('createStrategyFromDescription sends { description } not { query } (#85)', async () => {
    await client.createStrategyFromDescription({ description: 'buy low sell high' });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ description: 'buy low sell high' });
    expect(body).not.toHaveProperty('query');
  });

  it('startStrategy sends lowercase mode (#87)', async () => {
    await client.startStrategy('strat-id', 'live');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ mode: 'live' });
  });

  it('startStrategy does not uppercase paper mode (#87)', async () => {
    await client.startStrategy('strat-id', 'paper');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ mode: 'paper' });
  });

  it('placeSmartOrder sends intervalMinutes not intervalSeconds (#88)', async () => {
    await client.placeSmartOrder({
      type: 'TWAP',
      tokenId: 'tok-1',
      side: 'BUY',
      outcome: 'YES',
      totalSize: 100,
      slices: 5,
      intervalMinutes: 15,
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toHaveProperty('intervalMinutes', 15);
    expect(body).not.toHaveProperty('intervalSeconds');
  });

  it('WebhookEvent values use SCREAMING_SNAKE_CASE (#86)', async () => {
    // Type-level test: these should compile without error
    const events: import('../types').WebhookEvent[] = [
      'ORDER_FILLED', 'STRATEGY_ERROR', 'WHALE_TRADE', 'NEWS_SIGNAL',
      'BACKTEST_COMPLETE', 'DAILY_LOSS_LIMIT', 'MARKET_RESOLVED', 'PRICE_ALERT',
    ];
    expect(events).toHaveLength(8);
    // Ensure no dot.notation values exist in the type
    for (const e of events) {
      expect(e).not.toContain('.');
    }
  });
});

describe('PolyforgeError', () => {
  describe('constructor', () => {
    it('should create error with all parameters', () => {
      const error = new PolyforgeError({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Resource not found',
        requestId: 'req-123',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('PolyforgeError');
      expect(error.message).toBe('Resource not found');
      expect(error.status).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.requestId).toBe('req-123');
    });

    it('should create error without requestId', () => {
      const error = new PolyforgeError({
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });

      expect(error.status).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.requestId).toBeUndefined();
    });

    it('should have correct error name', () => {
      const error = new PolyforgeError({
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Bad request',
      });

      expect(error.name).toBe('PolyforgeError');
    });

    it('should have stack trace', () => {
      const error = new PolyforgeError({
        status: 500,
        code: 'ERROR',
        message: 'Test error',
      });

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('PolyforgeError');
    });
  });

  describe('suggestion field (#89)', () => {
    it('should capture suggestion from constructor params', () => {
      const error = new PolyforgeError({
        status: 400,
        code: 'INVALID_STRATEGY',
        message: 'Strategy has no blocks',
        suggestion: 'Add at least one condition block before starting the strategy.',
      });

      expect(error.suggestion).toBe('Add at least one condition block before starting the strategy.');
    });

    it('should be undefined when not provided', () => {
      const error = new PolyforgeError({
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Bad request',
      });

      expect(error.suggestion).toBeUndefined();
    });

    it('should be extracted from API error response body', async () => {
      const client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'STRATEGY_LIMIT_REACHED',
            message: 'You have reached the maximum number of strategies',
            suggestion: 'Upgrade to Pro for up to 10 strategies.',
            requestId: 'req-456',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      try {
        await client.listMarkets();
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PolyforgeError);
        const pErr = err as PolyforgeError;
        expect(pErr.status).toBe(403);
        expect(pErr.code).toBe('STRATEGY_LIMIT_REACHED');
        expect(pErr.suggestion).toBe('Upgrade to Pro for up to 10 strategies.');
        expect(pErr.requestId).toBe('req-456');
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('error types', () => {
    it('should handle 401 Unauthorized', () => {
      const error = new PolyforgeError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid API key',
      });

      expect(error.status).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should handle 429 Rate Limit', () => {
      const error = new PolyforgeError({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      });

      expect(error.status).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
    });

    it('should handle 503 Service Unavailable', () => {
      const error = new PolyforgeError({
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service temporarily unavailable',
      });

      expect(error.status).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('KNOWN_STRATEGY_EVENTS', () => {
    it('should contain all documented event types', () => {
      const expected = [
        'CONNECTED', 'STRATEGY_STARTED', 'STRATEGY_STOPPED',
        'STRATEGY_PAUSED', 'STRATEGY_RESUMED', 'STRATEGY_ERROR',
        'ORDER_PLACED', 'ORDER_SUBMITTED', 'ORDER_FILLED',
        'ORDER_PARTIAL', 'ORDER_CANCELLED', 'ORDER_FAILED', 'ORDER_ERROR',
        'BACKTEST_PROGRESS', 'BACKTEST_COMPLETED', 'BACKTEST_FAILED',
      ];
      for (const type of expected) {
        expect(KNOWN_STRATEGY_EVENTS.has(type)).toBe(true);
      }
      expect(KNOWN_STRATEGY_EVENTS.size).toBe(expected.length);
    });

    it('should not contain unknown event types', () => {
      expect(KNOWN_STRATEGY_EVENTS.has('UNKNOWN_TYPE')).toBe(false);
      expect(KNOWN_STRATEGY_EVENTS.has('')).toBe(false);
    });
  });
});

describe('isBlockedHost', () => {
  describe('IPv4 blocked ranges', () => {
    it.each([
      ['127.0.0.1', 'loopback'],
      ['127.255.255.255', 'loopback high'],
      ['10.0.0.1', 'RFC 1918 10/8'],
      ['10.255.255.255', 'RFC 1918 10/8 high'],
      ['172.16.0.1', 'RFC 1918 172.16/12'],
      ['172.31.255.255', 'RFC 1918 172.16/12 high'],
      ['192.168.0.1', 'RFC 1918 192.168/16'],
      ['192.168.255.255', 'RFC 1918 192.168/16 high'],
      ['169.254.1.1', 'link-local'],
      ['100.64.0.1', 'CGNAT low'],
      ['100.127.255.255', 'CGNAT high'],
      ['0.0.0.0', 'unspecified'],
    ])('should block %s (%s)', (ip) => {
      expect(isBlockedHost(ip)).toBe(true);
    });
  });

  describe('IPv4 allowed addresses', () => {
    it.each([
      ['8.8.8.8', 'public DNS'],
      ['1.1.1.1', 'Cloudflare DNS'],
      ['100.128.0.1', 'above CGNAT'],
      ['172.32.0.1', 'above RFC 1918 172 range'],
      ['192.169.0.1', 'above RFC 1918 192.168 range'],
    ])('should allow %s (%s)', (ip) => {
      expect(isBlockedHost(ip)).toBe(false);
    });
  });

  describe('IPv6 blocked ranges', () => {
    it.each([
      ['::1', 'loopback'],
      ['::', 'unspecified'],
      ['fc00::1', 'unique-local fc00'],
      ['fd12:3456::1', 'unique-local fd'],
      ['fe80::1', 'link-local'],
      ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
      ['::ffff:10.0.0.1', 'IPv4-mapped private'],
      ['::ffff:192.168.1.1', 'IPv4-mapped private 192.168'],
      ['::ffff:100.64.0.1', 'IPv4-mapped CGNAT'],
    ])('should block %s (%s)', (ip) => {
      expect(isBlockedHost(ip)).toBe(true);
    });
  });

  describe('IPv6 allowed addresses', () => {
    it.each([
      ['2001:db8::1', 'documentation prefix'],
      ['2607:f8b0:4004:800::200e', 'Google public'],
    ])('should allow %s (%s)', (ip) => {
      expect(isBlockedHost(ip)).toBe(false);
    });
  });

  describe('hostname checks', () => {
    it('should block localhost', () => {
      expect(isBlockedHost('localhost')).toBe(true);
    });

    it('should block localhost with trailing dot', () => {
      expect(isBlockedHost('localhost.')).toBe(true);
    });

    it.each(['.local', '.internal', '.localhost'])(
      'should block reserved TLD %s',
      (tld) => {
        expect(isBlockedHost(`myhost${tld}`)).toBe(true);
      },
    );

    it('should allow public hostnames', () => {
      expect(isBlockedHost('example.com')).toBe(false);
      expect(isBlockedHost('api.polyforge.app')).toBe(false);
    });
  });
});

describe('validateWebhookUrl', () => {
  it('should reject non-HTTPS URLs', async () => {
    await expect(validateWebhookUrl('http://example.com/hook')).rejects.toThrow(
      'Webhook URL must use HTTPS',
    );
  });

  it('should reject literal blocked IPv4', async () => {
    await expect(validateWebhookUrl('https://127.0.0.1/hook')).rejects.toThrow(
      'Webhook URL cannot point to localhost or internal addresses',
    );
  });

  it('should reject literal blocked IPv6', async () => {
    await expect(validateWebhookUrl('https://[::1]/hook')).rejects.toThrow(
      'Webhook URL cannot point to localhost or internal addresses',
    );
  });

  it('should reject localhost hostname', async () => {
    await expect(validateWebhookUrl('https://localhost/hook')).rejects.toThrow(
      'Webhook URL cannot point to localhost or internal addresses',
    );
  });

  beforeEach(() => {
    mockResolve4.mockReset();
    mockResolve6.mockReset();
  });

  it('should reject hostnames resolving to blocked IPs', async () => {
    mockResolve4.mockResolvedValue(['10.0.0.1']);
    mockResolve6.mockRejectedValue(new Error('ENODATA'));

    await expect(validateWebhookUrl('https://evil.example.com/hook')).rejects.toThrow(
      'Webhook URL resolves to a blocked address (10.0.0.1)',
    );
  });

  it('should reject hostnames where any resolved IP is blocked', async () => {
    mockResolve4.mockResolvedValue(['8.8.8.8', '192.168.1.1']);
    mockResolve6.mockRejectedValue(new Error('ENODATA'));

    await expect(validateWebhookUrl('https://mixed.example.com/hook')).rejects.toThrow(
      'Webhook URL resolves to a blocked address (192.168.1.1)',
    );
  });

  it('should reject unresolvable hostnames', async () => {
    mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));
    mockResolve6.mockRejectedValue(new Error('ENOTFOUND'));

    await expect(validateWebhookUrl('https://nonexistent.invalid/hook')).rejects.toThrow(
      'Webhook URL hostname could not be resolved',
    );
  });

  it('should allow hostnames resolving to public IPs', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    mockResolve6.mockResolvedValue(['2606:2800:220:1:248:1893:25c8:1946']);

    await expect(validateWebhookUrl('https://example.com/hook')).resolves.toBeUndefined();
  });

  it('should allow literal public IPv4', async () => {
    // Literal IPs skip DNS — no mock needed
    await expect(validateWebhookUrl('https://93.184.216.34/hook')).resolves.toBeUndefined();
  });

  it('should reject CGNAT range via DNS', async () => {
    mockResolve4.mockResolvedValue(['100.100.100.100']);
    mockResolve6.mockRejectedValue(new Error('ENODATA'));

    await expect(validateWebhookUrl('https://cgnat.example.com/hook')).rejects.toThrow(
      'Webhook URL resolves to a blocked address (100.100.100.100)',
    );
  });

  it('should reject IPv6 unique-local via DNS', async () => {
    mockResolve4.mockRejectedValue(new Error('ENODATA'));
    mockResolve6.mockResolvedValue(['fd00::1']);

    await expect(validateWebhookUrl('https://v6internal.example.com/hook')).rejects.toThrow(
      'Webhook URL resolves to a blocked address (fd00::1)',
    );
  });
});

// --- Breaking compat fixes (#61, #78) ---

describe('StrategyStatusResponse type (#61)', () => {
  it('should accept a minimal start response', () => {
    const resp: StrategyStatusResponse = {
      status: 'RUNNING',
      startedAt: '2026-04-13T10:00:00Z',
    };
    expect(resp.status).toBe('RUNNING');
    expect(resp.startedAt).toBe('2026-04-13T10:00:00Z');
    expect(resp.stoppedAt).toBeUndefined();
  });

  it('should accept a stop response', () => {
    const resp: StrategyStatusResponse = {
      status: 'IDLE',
      stoppedAt: '2026-04-13T10:05:00Z',
    };
    expect(resp.status).toBe('IDLE');
    expect(resp.stoppedAt).toBeDefined();
  });

  it('should accept a pause response with only status', () => {
    const resp: StrategyStatusResponse = { status: 'PAUSED' };
    expect(resp.status).toBe('PAUSED');
    expect(resp.startedAt).toBeUndefined();
    expect(resp.stoppedAt).toBeUndefined();
  });
});

describe('PaginatedResponse type (#78)', () => {
  it('should correctly type a paginated strategy response', () => {
    const resp: PaginatedResponse<Strategy> = {
      data: [
        { id: 's1', name: 'Alpha', status: 'IDLE', blocks: [], pnl: 0, tradeCount: 0, winRate: 0, createdAt: '', updatedAt: '' },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
    };
    expect(resp.data).toHaveLength(1);
    expect(resp.data[0].id).toBe('s1');
    expect(resp.total).toBe(1);
    expect(resp.hasNext).toBe(false);
  });

  it('should have correct shape for empty response', () => {
    const resp: PaginatedResponse<Strategy> = {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      hasNext: false,
    };
    expect(resp.data).toHaveLength(0);
    expect(resp.total).toBe(0);
  });
});
