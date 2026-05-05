import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PolyforgeClient, isBlockedHost, validateWebhookUrl } from '../client';
import { PolyforgeError } from '../errors';
import { KNOWN_STRATEGY_EVENTS } from '../types';
import type { StrategyStatusResponse, PaginatedResponse, Strategy, OrderStatus, StrategyStatus, Order, Position, ImportStrategyBlocks, ImportStrategyParams, ClosePositionParams, RedeemPositionParams, ProvideLiquidityParams, ConditionalOrderStatus, CreateAlertParams, CreateConditionalOrderParams, ConditionalOrder, CopyConfig, Alert, CopyMode, CopyStatus, ConditionalOrderType, OrderType, Market, Token, RunBacktestParams, CreateStrategyParams, TraderScore, WhaleTrade, NewsSignal, AiQueryResponse, SplitPositionParams, MergePositionParams, StrategyVisibility, StrategyExecMode, PortfolioPnlParams, PortfolioPnl, PriceHistoryEntry, OrderBook, AccuracyLeaderboardParams, SystemHealthPublic, SystemHealthAuthenticated, UserPreferences, UpdateUserPreferencesParams, ComboMarketLookup, ActionsSchema } from '../types';

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
      expect(clientWithSlash.toJSON()).toEqual({ baseUrl: 'http://localhost:3002' });
    });

    it('should normalize pathological trailing slash runs without regex backtracking', () => {
      const client = new PolyforgeClient({
        apiKey: 'test-key',
        apiUrl: `https://api.example.com${'/'.repeat(50_000)}`,
      });
      expect(client.toJSON()).toEqual({ baseUrl: 'https://api.example.com' });
    });

    it('should handle URL paths correctly', () => {
      const client = new PolyforgeClient({
        apiKey: 'test-key',
        apiUrl: 'https://api.example.com',
      });
      expect(client).toBeDefined();
    });
  });

  describe('health endpoints', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('getHealth calls the public health endpoint and returns public health only', async () => {
      const payload: SystemHealthPublic = { status: 'ok', service: 'api-service' };
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
      const client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });

      const result = await client.getHealth();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

      expect(new URL(url).pathname).toBe('/health');
      expect(init.method).toBe('GET');
      expect(result.status).toBe('ok');
    });

    it('getHealthAuthenticated calls the status endpoint with authenticated health type', async () => {
      const payload: SystemHealthAuthenticated = { status: 'operational' };
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
      const client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });

      const result = await client.getHealthAuthenticated();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

      expect(new URL(url).pathname).toBe('/api/v1/status');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key' });
      expect(result.status).toBe('operational');
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

  it('startStrategy sends { mode: "live" } when mode:"live" (#190)', async () => {
    await client.startStrategy('strat-id', { mode: 'live' });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ mode: 'live' });
  });

  it('startStrategy sends { mode: "paper" } when mode:"paper" (#190)', async () => {
    await client.startStrategy('strat-id', { mode: 'paper' });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ mode: 'paper' });
  });

  it('startStrategy defaults to { mode: "paper" } (#190)', async () => {
    await client.startStrategy('strat-id');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ mode: 'paper' });
  });

  it('startStrategy translates legacy paperMode:false to { mode: "live" } (#190)', async () => {
    await client.startStrategy('strat-id', { paperMode: false });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ mode: 'live' });
  });

  it('startStrategy translates legacy paperMode:true to { mode: "paper" } (#190)', async () => {
    await client.startStrategy('strat-id', { paperMode: true });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ mode: 'paper' });
  });

  it('startStrategy drops legacy deploymentMode and never sends paperMode/deploymentMode (#190)', async () => {
    await client.startStrategy('strat-id', { paperMode: false, deploymentMode: 'LIVE' });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ mode: 'live' });
    expect(body).not.toHaveProperty('paperMode');
    expect(body).not.toHaveProperty('deploymentMode');
  });

  it('startStrategy prefers mode over legacy paperMode when both are passed (#190)', async () => {
    await client.startStrategy('strat-id', { mode: 'live', paperMode: true });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ mode: 'live' });
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
    }, 'smart-key-123');
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

  it('getPlatformActions calls the public actions catalog endpoint', async () => {
    const payload: ActionsSchema = {
      version: '1.0',
      actions: [
        {
          name: 'list_markets',
          description: 'Browse prediction markets',
          method: 'GET',
          path: '/api/v1/markets',
          scope: 'READ',
          category: 'markets',
          parameters: [
            {
              name: 'limit',
              type: 'number',
              required: false,
              in: 'query',
              default: 20,
              min: 1,
              max: 100,
            },
          ],
        },
      ],
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await client.getPlatformActions();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(new URL(url).pathname).toBe('/api/v1/actions');
    expect(init.method).toBe('GET');
    expect(result.actions[0].parameters?.[0].in).toBe('query');
  });

  it('getActions is a camelCase alias for the actions catalog', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: '1.0', actions: [] satisfies ActionsSchema['actions'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await client.getActions();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(new URL(url).pathname).toBe('/api/v1/actions');
    expect(init.method).toBe('GET');
    expect(result.actions).toEqual([]);
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

describe('PaginatedResponse type (#78, #141)', () => {
  it('should correctly type a paginated strategy response with nested pagination', () => {
    const resp: PaginatedResponse<Strategy> = {
      data: [
        { id: 's1', name: 'Alpha', status: 'IDLE' as StrategyStatus, visibility: 'PRIVATE', execMode: 'TICK', tickMs: 1000, triggers: [], conditions: [], actions: [], safety: [], logicBlocks: [], calcBlocks: [], tags: [], variables: [], pnl: 0, tradeCount: 0, winRate: 0, createdAt: '', updatedAt: '' },
      ],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    };
    expect(resp.data).toHaveLength(1);
    expect(resp.data[0].id).toBe('s1');
    expect(resp.pagination.total).toBe(1);
    expect(resp.pagination.page).toBe(1);
    expect(resp.pagination.limit).toBe(10);
    expect(resp.pagination.totalPages).toBe(1);
  });

  it('should have correct shape for empty response', () => {
    const resp: PaginatedResponse<Strategy> = {
      data: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    expect(resp.data).toHaveLength(0);
    expect(resp.pagination.total).toBe(0);
  });

  it('should not have hasNext field (not part of platform contract)', () => {
    const resp: PaginatedResponse<Strategy> = {
      data: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    expect((resp as any).hasNext).toBeUndefined();
  });
});

// --- Breaking compat fixes (#25, #26, #27, #28, #29, #30, #33) ---

describe('ProvideLiquidityParams uses marketId, not tokenId/spread (#25)', () => {
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

  it('sends { marketId, tokenId, amountUsdc } matching platform ProvideLiquidityDto', async () => {
    const params: ProvideLiquidityParams = { marketId: 'mkt-1', tokenId: 'tok-1', amountUsdc: 100 };
    await client.provideLiquidity(params, 'liquidity-key-123');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ marketId: 'mkt-1', tokenId: 'tok-1', amountUsdc: 100 });
    expect(body).not.toHaveProperty('size');
    expect(body).not.toHaveProperty('spread');
    expect((fetchSpy.mock.calls[0][1]!.headers as Record<string, string>)['Idempotency-Key']).toBe('liquidity-key-123');
  });
});

describe('RedeemPositionParams uses positionId/marketId, not tokenId/conditionId (#26)', () => {
  it('should accept positionId and marketId fields', () => {
    const params: RedeemPositionParams = { positionId: 'pos-1', marketId: 'mkt-1' };
    expect(params.positionId).toBe('pos-1');
    expect(params.marketId).toBe('mkt-1');
    expect((params as any).tokenId).toBeUndefined();
    expect((params as any).conditionId).toBeUndefined();
  });

  it('should allow both fields optional', () => {
    const params: RedeemPositionParams = {};
    expect(params.positionId).toBeUndefined();
    expect(params.marketId).toBeUndefined();
  });
});

describe('ImportStrategyParams matches platform DTO (#27)', () => {
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

  it('sends { polyforge, strategy } not { data: StrategyExport }', async () => {
    const params: ImportStrategyParams = {
      polyforge: '1.7.1',
      exportedAt: '2026-04-13T00:00:00Z',
      strategy: { name: 'Test' },
    };
    await client.importStrategy(params);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toHaveProperty('polyforge', '1.7.1');
    expect(body).toHaveProperty('strategy');
    expect(body.strategy).toHaveProperty('name', 'Test');
    expect(body).not.toHaveProperty('data');
  });

  it('sends strategy blocks nested under strategy.blocks (#207)', async () => {
    const params: ImportStrategyParams = {
      polyforge: '1.7.1',
      strategy: {
        name: 'Blocks Strategy',
        blocks: {
          triggers: [{ type: 'PRICE_CROSSES_UP', config: {} }],
          conditions: [],
          actions: [{ type: 'BUY_YES', config: { size: '50' } }],
          safety: [],
        },
      },
    };

    await client.importStrategy(params);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.strategy.blocks.triggers).toHaveLength(1);
    expect(body.strategy.blocks.actions).toHaveLength(1);
    expect(body.strategy).not.toHaveProperty('triggers');
    expect(body.strategy).not.toHaveProperty('conditions');
    expect(body.strategy).not.toHaveProperty('actions');
    expect(body.strategy).not.toHaveProperty('safety');
  });

  it('types import blocks as platform ImportBlockDto items only (#207)', () => {
    const blocks: ImportStrategyBlocks = {
      triggers: [{ type: 'PRICE_CROSSES_UP', config: { threshold: '0.6' } }],
      conditions: [{ type: 'MIN_LIQUIDITY', config: { min: '1000' } }],
      actions: [{ type: 'BUY_YES', config: { size: '50' } }],
      safety: [{ type: 'STOP_IF_DAILY_LOSS', config: { maxLoss: '25' } }],
    };

    expect(blocks.triggers?.[0]?.type).toBe('PRICE_CROSSES_UP');

    const rejectedBlocks: ImportStrategyBlocks = {
      triggers: [
        {
          // @ts-expect-error platform import blocks reject client-side block ids
          id: 't1',
          type: 'PRICE_CROSSES_UP',
          config: {},
        },
      ],
    };
    expect(rejectedBlocks.triggers?.[0]?.type).toBe('PRICE_CROSSES_UP');
  });
});

describe('ClosePositionParams.size is string (#28)', () => {
  it('should accept string size', () => {
    const params: ClosePositionParams = { tokenId: 'tok-1', size: '50.5' };
    expect(params.size).toBe('50.5');
  });

  it('should allow size to be omitted', () => {
    const params: ClosePositionParams = { tokenId: 'tok-1' };
    expect(params.size).toBeUndefined();
  });
});

describe('OrderStatus has 12 platform values (#29)', () => {
  it('should accept all 12 platform order statuses', () => {
    const statuses: OrderStatus[] = [
      'PENDING', 'SUBMITTED', 'LIVE', 'MATCHED', 'DELAYED', 'MINED',
      'CONFIRMED', 'PARTIAL', 'CANCELLED', 'UNMATCHED', 'FAILED', 'ERROR',
    ];
    expect(statuses).toHaveLength(12);
  });
});

describe('StrategyStatus includes ERROR and ARCHIVED (#30)', () => {
  it('should accept all 6 platform strategy statuses', () => {
    const statuses: StrategyStatus[] = [
      'IDLE', 'RUNNING', 'PAUSED', 'ERROR', 'PAPER', 'ARCHIVED',
    ];
    expect(statuses).toHaveLength(6);
  });
});

describe('Order/Position monetary fields are string (#33)', () => {
  it('Order fields price/size/fillSize/fillPrice/fee should be string', () => {
    const order: Order = {
      id: 'o-1',
      marketId: 'mkt-1',
      tokenId: 'tok-1',
      outcome: 'YES',
      side: 'BUY',
      orderType: 'GTC',
      status: 'LIVE',
      price: '0.65',
      size: '100',
      fillSize: '50',
      fillPrice: '0.64',
      fee: '0.01',
      createdAt: '',
      updatedAt: '',
    };
    expect(typeof order.price).toBe('string');
    expect(typeof order.size).toBe('string');
    expect(typeof order.fillSize).toBe('string');
    expect(typeof order.fillPrice).toBe('string');
    expect(typeof order.fee).toBe('string');
    // Ensure old field names do not exist
    expect((order as any).filledSize).toBeUndefined();
    expect((order as any).filledPrice).toBeUndefined();
    expect((order as any).marketName).toBeUndefined();
    expect((order as any).type).toBeUndefined();
  });

  it('Position fields size/avgPrice/currentPrice/unrealizedPnl/realizedPnl should be string', () => {
    const position: Position = {
      id: 'p-1',
      marketId: 'mkt-1',
      tokenId: 'tok-1',
      outcome: 'YES',
      side: 'BUY',
      size: '200',
      avgPrice: '0.55',
      currentPrice: '0.60',
      unrealizedPnl: '10.00',
      realizedPnl: '5.00',
      openedAt: '',
    };
    expect(typeof position.size).toBe('string');
    expect(typeof position.avgPrice).toBe('string');
    expect(typeof position.currentPrice).toBe('string');
    expect(typeof position.unrealizedPnl).toBe('string');
    expect(typeof position.realizedPnl).toBe('string');
    // Ensure old field names do not exist
    expect((position as any).entryPrice).toBeUndefined();
    expect((position as any).marketName).toBeUndefined();
  });
});

// --- Breaking compat fixes (#37, #48, #49, #50) ---

describe('ConditionalOrderStatus includes FAILED (#37)', () => {
  it('should accept all 5 platform conditional order statuses', () => {
    const statuses: ConditionalOrderStatus[] = [
      'PENDING', 'TRIGGERED', 'CANCELLED', 'EXPIRED', 'FAILED',
    ];
    expect(statuses).toHaveLength(5);
  });

  it('should allow filtering orders by FAILED status', () => {
    const orders: ConditionalOrder[] = [
      { id: 'co-1', marketId: 'mkt-1', tokenId: 'tok-1', type: 'STOP_LOSS', side: 'BUY', outcome: 'YES', size: 100, triggerPrice: 0.5, status: 'FAILED', createdAt: '', triggeredAt: null },
    ];
    const failed = orders.filter(o => o.status === 'FAILED');
    expect(failed).toHaveLength(1);
  });
});

describe('CreateAlertParams matches platform DTO (#48)', () => {
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

  it('sends { tokenId, direction, price } not { name, condition, marketId }', async () => {
    const params: CreateAlertParams = { tokenId: 'tok-1', direction: 'above', price: '0.75' };
    await client.createAlert(params);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ tokenId: 'tok-1', direction: 'above', price: '0.75' });
    expect(body).not.toHaveProperty('name');
    expect(body).not.toHaveProperty('condition');
    expect(body).not.toHaveProperty('marketId');
  });

  it('sends persistent field when provided', async () => {
    const params: CreateAlertParams = { tokenId: 'tok-1', direction: 'below', price: '0.25', persistent: true };
    await client.createAlert(params);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toHaveProperty('persistent', true);
  });

  it('Alert response type has correct platform fields', () => {
    const alert: Alert = {
      id: 'a-1',
      tokenId: 'tok-1',
      direction: 'above',
      price: '0.75',
      persistent: false,
      enabled: true,
      createdAt: '2026-04-13T00:00:00Z',
    };
    expect(alert.tokenId).toBe('tok-1');
    expect(alert.direction).toBe('above');
    expect(alert.price).toBe('0.75');
    expect((alert as any).name).toBeUndefined();
    expect((alert as any).condition).toBeUndefined();
  });
});

describe('CreateConditionalOrderParams matches platform DTO (#49)', () => {
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

  it('sends all required fields including tokenId, type, outcome', async () => {
    const params: CreateConditionalOrderParams = {
      marketId: 'mkt-1',
      tokenId: 'tok-1',
      type: 'STOP_LOSS',
      side: 'SELL',
      outcome: 'YES',
      size: 50,
      triggerPrice: 0.3,
    };
    await client.createConditionalOrder(params, 'conditional-key-123');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toHaveProperty('tokenId', 'tok-1');
    expect(body).toHaveProperty('type', 'STOP_LOSS');
    expect(body).toHaveProperty('outcome', 'YES');
    expect(body).toHaveProperty('marketId', 'mkt-1');
    expect(body).toHaveProperty('side', 'SELL');
    expect(body).toHaveProperty('size', 50);
    expect(body).toHaveProperty('triggerPrice', 0.3);
  });

  it('sends optional fields limitPrice, trailingPct, expiresAt as strings', async () => {
    const params: CreateConditionalOrderParams = {
      marketId: 'mkt-1',
      tokenId: 'tok-1',
      type: 'TRAILING_STOP',
      side: 'SELL',
      outcome: 'NO',
      size: 25,
      triggerPrice: 0.6,
      limitPrice: '0.55',
      trailingPct: '5.0',
      expiresAt: '2026-05-01T00:00:00Z',
    };
    await client.createConditionalOrder(params, 'conditional-key-123');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toHaveProperty('limitPrice', '0.55');
    expect(body).toHaveProperty('trailingPct', '5.0');
    expect(body).toHaveProperty('expiresAt', '2026-05-01T00:00:00Z');
  });

  it('ConditionalOrderType accepts all 5 platform values', () => {
    const types: ConditionalOrderType[] = [
      'TAKE_PROFIT', 'STOP_LOSS', 'TRAILING_STOP', 'LIMIT', 'PEGGED',
    ];
    expect(types).toHaveLength(5);
  });
});

describe('CopyConfig matches platform fields (#50, #163)', () => {
  it('uses targetWallet not sourceWallet', () => {
    const config: CopyConfig = {
      id: 'cc-1',
      userId: 'user-1',
      targetWallet: '0xabc123',
      mode: 'PERCENTAGE',
      sizeValue: '50',
      maxExposure: '1000',
      maxDailyLoss: '100',
      priceOffset: '0.01',
      status: 'ACTIVE',
      totalPnl: '250.50',
      totalCopied: 12,
      createdAt: '2026-04-13T00:00:00Z',
      updatedAt: '2026-04-14T00:00:00Z',
      stoppedAt: null,
    };
    expect(config.targetWallet).toBe('0xabc123');
    expect((config as any).sourceWallet).toBeUndefined();
    expect((config as any).label).toBeUndefined();
    expect((config as any).maxPositionSize).toBeUndefined();
    expect((config as any).totalCopiedTrades).toBeUndefined();
    expect((config as any).enabled).toBeUndefined();
  });

  it('has mode, sizeValue, maxExposure, maxDailyLoss, priceOffset fields', () => {
    const config: CopyConfig = {
      id: 'cc-2',
      userId: 'user-2',
      targetWallet: '0xdef456',
      mode: 'FIXED',
      sizeValue: '100',
      maxExposure: '5000',
      maxDailyLoss: '200',
      priceOffset: '0',
      status: 'PAUSED',
      totalPnl: '-10.00',
      totalCopied: 3,
      createdAt: '2026-04-13T00:00:00Z',
      updatedAt: '2026-04-13T12:00:00Z',
      stoppedAt: null,
    };
    expect(config.mode).toBe('FIXED');
    expect(config.sizeValue).toBe('100');
    expect(config.maxExposure).toBe('5000');
  });

  it('CopyMode accepts all 3 platform values', () => {
    const modes: CopyMode[] = ['PERCENTAGE', 'FIXED', 'MIRROR'];
    expect(modes).toHaveLength(3);
  });

  it('CopyStatus accepts all 4 platform values', () => {
    const statuses: CopyStatus[] = ['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR'];
    expect(statuses).toHaveLength(4);
  });

  it('has status enum instead of enabled boolean', () => {
    const config: CopyConfig = {
      id: 'cc-3',
      userId: 'user-3',
      targetWallet: '0x789',
      mode: 'MIRROR',
      sizeValue: '0',
      maxExposure: '0',
      maxDailyLoss: '0',
      priceOffset: '0',
      status: 'STOPPED',
      totalPnl: '0',
      totalCopied: 0,
      createdAt: '2026-04-13T00:00:00Z',
      updatedAt: '2026-04-15T00:00:00Z',
      stoppedAt: '2026-04-15T00:00:00Z',
    };
    expect(config.status).toBe('STOPPED');
    expect(config.stoppedAt).toBe('2026-04-15T00:00:00Z');
    expect((config as any).enabled).toBeUndefined();
  });

  it('includes performance metrics totalPnl and totalCopied', () => {
    const config: CopyConfig = {
      id: 'cc-4',
      userId: 'user-4',
      targetWallet: '0xperf',
      mode: 'PERCENTAGE',
      sizeValue: '25',
      maxExposure: '2000',
      maxDailyLoss: '50',
      priceOffset: '0.01',
      status: 'ACTIVE',
      totalPnl: '1500.75',
      totalCopied: 42,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-04-20T00:00:00Z',
      stoppedAt: null,
    };
    expect(config.totalPnl).toBe('1500.75');
    expect(config.totalCopied).toBe(42);
    expect(config.updatedAt).toBe('2026-04-20T00:00:00Z');
  });
});

// --- Breaking compat fixes (#16, #17, #36, #14) ---

describe('SSE response.body null guard (#16)', () => {
  it('should throw PolyforgeError when response.body is null', async () => {
    const client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      { ok: true, status: 200, body: null } as any,
    );

    const gen = client.watchStrategy('strat-1');
    try {
      await gen.next();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PolyforgeError);
      const pErr = err as PolyforgeError;
      expect(pErr.code).toBe('STREAM_ERROR');
      expect(pErr.message).toContain('null');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('Market type uses title and tokens[] (#17)', () => {
  it('should have title field, not name', () => {
    const market: Market = {
      id: 'mkt-1',
      title: 'Will BTC hit $100k?',
      category: 'crypto',
      tokens: [
        { id: 'tok-yes', outcome: 'YES', price: 0.65 },
        { id: 'tok-no', outcome: 'NO', price: 0.35 },
      ],
      price: 0.65,
      volume24h: 50000,
      change24h: 2.5,
      liquidity: 100000,
      createdAt: '2026-04-13T00:00:00Z',
    };
    expect(market.title).toBe('Will BTC hit $100k?');
    expect((market as any).name).toBeUndefined();
    expect(market.tokens).toHaveLength(2);
    expect(market.tokens[0].id).toBe('tok-yes');
    expect(market.tokens[0].outcome).toBe('YES');
    expect((market as any).baseToken).toBeUndefined();
    expect((market as any).quoteToken).toBeUndefined();
  });

  it('Token should have id, outcome, price fields', () => {
    const token: Token = { id: 'tok-1', outcome: 'YES', price: 0.72 };
    expect(token.id).toBe('tok-1');
    expect(token.outcome).toBe('YES');
    expect(token.price).toBe(0.72);
    expect((token as any).symbol).toBeUndefined();
    expect((token as any).address).toBeUndefined();
    expect((token as any).decimals).toBeUndefined();
  });

  it('Market should support optional description, endDate, resolved', () => {
    const market: Market = {
      id: 'mkt-2',
      title: 'Resolved market',
      description: 'A test market',
      category: 'politics',
      endDate: '2026-12-31T00:00:00Z',
      resolved: true,
      tokens: [],
      price: 1.0,
      volume24h: 0,
      change24h: 0,
      liquidity: 0,
      createdAt: '',
    };
    expect(market.description).toBe('A test market');
    expect(market.endDate).toBe('2026-12-31T00:00:00Z');
    expect(market.resolved).toBe(true);
  });
});

describe('OrderType uses all 5 platform values (#36, #126, #153)', () => {
  it('should accept all 5 platform order types', () => {
    const types: OrderType[] = ['GTC', 'GTD', 'FOK', 'FAK', 'POST_ONLY'];
    expect(types).toHaveLength(5);
  });

  it('should not accept exchange-style order types', () => {
    const validTypes = new Set<OrderType>(['GTC', 'GTD', 'FOK', 'FAK', 'POST_ONLY']);
    expect(validTypes.has('GTC')).toBe(true);
    expect(validTypes.has('GTD')).toBe(true);
    expect(validTypes.has('FOK')).toBe(true);
    expect(validTypes.has('FAK')).toBe(true);
    expect(validTypes.has('POST_ONLY')).toBe(true);
    // Old exchange-style values are not valid
    expect(validTypes.has('MARKET' as any)).toBe(false);
    expect(validTypes.has('LIMIT' as any)).toBe(false);
    expect(validTypes.has('STOP' as any)).toBe(false);
    expect(validTypes.has('STOP_LIMIT' as any)).toBe(false);
  });
});

describe('RunBacktestParams has all platform fields (#14)', () => {
  it('should allow all fields to be optional', () => {
    const params: RunBacktestParams = {};
    expect(params.strategyId).toBeUndefined();
    expect(params.dateRangeStart).toBeUndefined();
    expect(params.dateRangeEnd).toBeUndefined();
  });

  it('should accept quickMode, strategyBlocks, marketBindings', () => {
    const params: RunBacktestParams = {
      strategyId: 'strat-1',
      dateRangeStart: '2026-01-01',
      dateRangeEnd: '2026-03-31',
      quickMode: true,
      strategyBlocks: { condition: { type: 'price_above' } },
      marketBindings: { 'mkt-slot-1': 'mkt-real-1' },
    };
    expect(params.quickMode).toBe(true);
    expect(params.strategyBlocks).toBeDefined();
    expect(params.marketBindings).toBeDefined();
    // Old fields should not exist
    expect((params as any).startDate).toBeUndefined();
    expect((params as any).endDate).toBeUndefined();
    expect((params as any).initialBalance).toBeUndefined();
  });
});

// --- Breaking compat fixes (#18, #24, #31, #32) ---

describe('TraderScore fields match platform (#102)', () => {
  it('should use flat structure matching GET /api/v1/scores/me', () => {
    const ts: TraderScore = {
      overall: 85,
      rank: 12,
      profitability: 0.72,
      consistency: 0.78,
      riskManagement: 0.65,
      volume: 0.9,
      percentile: 92.5,
      updatedAt: '2026-04-13T00:00:00Z',
    };
    expect(ts.overall).toBe(85);
    expect(ts.rank).toBe(12);
    expect(ts.profitability).toBe(0.72);
    expect(ts.riskManagement).toBe(0.65);
    expect(ts.percentile).toBe(92.5);
    expect((ts as any).score).toBeUndefined();
    expect((ts as any).breakdown).toBeUndefined();
  });
});

describe('WhaleTrade fields match platform (#104)', () => {
  it('should use flat structure with wallet, usdValue, timestamp, marketName', () => {
    const wt: WhaleTrade = {
      id: 'wt-1',
      marketId: 'mkt-1',
      marketName: 'Test Market',
      side: 'BUY',
      size: 5000,
      usdValue: 3250,
      wallet: '0xabc123',
      timestamp: '2026-04-13T00:00:00.000Z',
    };
    expect(wt.wallet).toBe('0xabc123');
    expect(wt.marketName).toBe('Test Market');
    expect(wt.usdValue).toBe(3250);
    expect(wt.timestamp).toBeDefined();
    expect((wt as any).walletAddress).toBeUndefined();
    expect((wt as any).notional).toBeUndefined();
    expect((wt as any).detectedAt).toBeUndefined();
    expect((wt as any).market).toBeUndefined();
  });
});

describe('NewsSignal fields match platform (#105)', () => {
  it('should use flat structure with headline, source, sentiment, relatedMarkets', () => {
    const ns: NewsSignal = {
      id: 'ns-1',
      headline: 'Breaking news',
      source: 'reuters',
      sentiment: 'POSITIVE',
      confidence: 90,
      relatedMarkets: ['mkt-1', 'mkt-2'],
      signal: 'BUY',
      publishedAt: '2026-04-13T00:00:00Z',
    };
    expect(ns.headline).toBe('Breaking news');
    expect(ns.source).toBe('reuters');
    expect(ns.sentiment).toBe('POSITIVE');
    expect(ns.relatedMarkets).toHaveLength(2);
    expect((ns as any).direction).toBeUndefined();
    expect((ns as any).article).toBeUndefined();
    expect((ns as any).market).toBeUndefined();
    expect((ns as any).articleId).toBeUndefined();
  });
});

describe('AiQueryResponse fields match platform (#103)', () => {
  it('should use answer/confidence/sources/suggestedActions shape', () => {
    const resp: AiQueryResponse = {
      answer: 'BTC market is at 0.65',
      confidence: 0.92,
      sources: ['market-data', 'price-feed'],
      suggestedActions: ['view_market'],
    };
    expect(resp.answer).toBe('BTC market is at 0.65');
    expect(resp.confidence).toBe(0.92);
    expect(resp.sources).toHaveLength(2);
    expect(resp.suggestedActions).toHaveLength(1);
    expect((resp as any).query).toBeUndefined();
    expect((resp as any).intent).toBeUndefined();
    expect((resp as any).summary).toBeUndefined();
  });
});

describe('SplitPositionParams and MergePositionParams match platform (#24)', () => {
  it('SplitPositionParams uses tokenId + amount (string)', () => {
    const params: SplitPositionParams = {
      tokenId: 'tok-1',
      amount: '100.50',
    };
    expect(params.tokenId).toBe('tok-1');
    expect(typeof params.amount).toBe('string');
    // Old fields must not exist
    expect((params as any).size).toBeUndefined();
    expect((params as any).price).toBeUndefined();
  });

  it('MergePositionParams uses tokenId + amount (string), not tokenIds[]', () => {
    const params: MergePositionParams = {
      tokenId: 'tok-1',
      amount: '200.00',
    };
    expect(params.tokenId).toBe('tok-1');
    expect(typeof params.amount).toBe('string');
    // Old field must not exist
    expect((params as any).tokenIds).toBeUndefined();
  });
});

describe('Strategy uses categorized block arrays (#31)', () => {
  it('should have triggers/conditions/actions/safety/logicBlocks/calcBlocks instead of flat blocks', () => {
    const strat: Strategy = {
      id: 's-1',
      name: 'Test Strategy',
      status: 'IDLE',
      visibility: 'PRIVATE',
      execMode: 'TICK',
      tickMs: 1000,
      triggers: [{ id: 'b1', type: 'price_above', label: 'Price > 0.5', config: { threshold: 0.5 }, connections: ['b2'] }],
      conditions: [{ id: 'b2', type: 'time_window', label: 'Morning', config: {}, connections: ['b3'] }],
      actions: [{ id: 'b3', type: 'buy', label: 'Buy YES', config: { size: 100 }, connections: [] }],
      safety: [],
      logicBlocks: [],
      calcBlocks: [],
      tags: ['test'],
      variables: [],
      pnl: 0,
      tradeCount: 0,
      winRate: 0,
      createdAt: '',
      updatedAt: '',
    };
    expect(strat.triggers).toHaveLength(1);
    expect(strat.conditions).toHaveLength(1);
    expect(strat.actions).toHaveLength(1);
    expect(strat.safety).toHaveLength(0);
    // Old flat blocks field must not exist
    expect((strat as any).blocks).toBeUndefined();
  });
});

describe('CreateStrategyParams includes all platform fields (#32)', () => {
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

  it('should accept all CreateStrategyDto fields', async () => {
    const params: CreateStrategyParams = {
      name: 'Full Strategy',
      description: 'A complete strategy',
      visibility: 'PUBLIC',
      execMode: 'EVENT',
      tickMs: 5000,
      triggers: [{ id: 't1', type: 'price', label: 'Price trigger', config: {}, connections: [] }],
      conditions: [],
      actions: [{ id: 'a1', type: 'buy', label: 'Buy', config: {}, connections: [] }],
      safety: [],
      logicBlocks: [],
      calcBlocks: [],
      tags: ['alpha', 'crypto'],
      variables: [{ name: 'threshold', type: 'number', defaultValue: '0.5' }],
      canvas: { zoom: 1, offsetX: 0, offsetY: 0 },
      marketId: 'mkt-1',
      marketSlots: [{ slotId: 'slot-1', marketId: 'mkt-1', tokenId: 'tok-1' }],
    };
    await client.createStrategy(params);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toHaveProperty('name', 'Full Strategy');
    expect(body).toHaveProperty('visibility', 'PUBLIC');
    expect(body).toHaveProperty('execMode', 'EVENT');
    expect(body).toHaveProperty('tickMs', 5000);
    expect(body).toHaveProperty('triggers');
    expect(body.triggers).toHaveLength(1);
    expect(body).toHaveProperty('tags');
    expect(body.tags).toEqual(['alpha', 'crypto']);
    expect(body).toHaveProperty('variables');
    expect(body).toHaveProperty('canvas');
    expect(body).toHaveProperty('marketSlots');
  });

  it('should still work with minimal params (backward compat)', async () => {
    await client.createStrategy({ name: 'Simple Strategy' });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ name: 'Simple Strategy' });
    // Must not send undefined fields
    expect(body).not.toHaveProperty('visibility');
    expect(body).not.toHaveProperty('triggers');
  });

  it('Order uses orderType field name (#18)', () => {
    const order: Order = {
      id: 'o-1', marketId: 'mkt-1', tokenId: 'tok-1', outcome: 'YES',
      side: 'BUY', orderType: 'GTC', status: 'LIVE',
      price: '0.65', size: '100', fillSize: '0',
      createdAt: '', updatedAt: '',
    };
    expect(order.orderType).toBe('GTC');
    expect((order as any).type).toBeUndefined();
  });

  it('Position has tokenId and outcome, no marketName (#18)', () => {
    const pos: Position = {
      id: 'p-1', marketId: 'mkt-1', tokenId: 'tok-1', outcome: 'YES',
      side: 'BUY', size: '100', avgPrice: '0.55', currentPrice: '0.60',
      unrealizedPnl: '5.00', realizedPnl: '0', openedAt: '',
    };
    expect(pos.tokenId).toBe('tok-1');
    expect(pos.outcome).toBe('YES');
    expect((pos as any).marketName).toBeUndefined();
  });
});

// --- Missing query parameters (#72, #73, #74, #75, #79) ---

describe('Missing query parameters on list methods', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('listMarkets sends sort and closed params (#74)', async () => {
    await client.listMarkets({ sort: 'volume', closed: true, limit: 5 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('sort')).toBe('volume');
    expect(url.searchParams.get('closed')).toBe('true');
    expect(url.searchParams.get('limit')).toBe('5');
  });

  it('listStrategies sends sort, page, and limit params (#79)', async () => {
    await client.listStrategies({ status: 'RUNNING', sort: 'pnl', page: 2, limit: 20 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('status')).toBe('RUNNING');
    expect(url.searchParams.get('sort')).toBe('pnl');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  it('getOrders sends marketId and page params (#75)', async () => {
    await client.getOrders({ marketId: 'mkt-1', page: 3, limit: 50 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('marketId')).toBe('mkt-1');
    expect(url.searchParams.get('page')).toBe('3');
  });

  it('listBacktests sends strategyId, status, page, limit params (#72)', async () => {
    await client.listBacktests({ strategyId: 's-1', status: 'COMPLETED', page: 1, limit: 10 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('strategyId')).toBe('s-1');
    expect(url.searchParams.get('status')).toBe('COMPLETED');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('runQuickBacktest posts to /backtests/quick (#58)', async () => {
    await client.runQuickBacktest({ strategyId: 's-1', dateRangeStart: '2026-01-01', dateRangeEnd: '2026-03-01' });
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/v1/backtests/quick');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.strategyId).toBe('s-1');
    expect(body.dateRangeStart).toBe('2026-01-01');
    expect(body.dateRangeEnd).toBe('2026-03-01');
  });

  it('getBacktestOrders fetches orders for a backtest (#58)', async () => {
    await client.getBacktestOrders('bt-99');
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toContain('/api/v1/backtests/bt-99/orders');
    expect(opts.method).toBe('GET');
  });

  it('listConditionalOrders sends status, type, page, limit params (#73)', async () => {
    await client.listConditionalOrders({ status: 'PENDING', type: 'STOP_LOSS', page: 1, limit: 25 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('status')).toBe('PENDING');
    expect(url.searchParams.get('type')).toBe('STOP_LOSS');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('25');
  });

  it('all list methods still work with no params', async () => {
    await client.listMarkets();
    await client.listStrategies();
    await client.getOrders();
    await client.listBacktests();
    await client.listConditionalOrders();
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it('getPortfolioPnl sends period and strategyId query params (#19)', async () => {
    await client.getPortfolioPnl({ period: '30d', strategyId: 's-42' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('period')).toBe('30d');
    expect(url.searchParams.get('strategyId')).toBe('s-42');
  });

  it('getPortfolioPnl works with no params (#19)', async () => {
    await client.getPortfolioPnl();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.toString()).toBe('');
  });
});

describe('PortfolioPnl fields match platform (#106)', () => {
  it('should use period/totalPnl/realizedPnl/unrealizedPnl/dataPoints shape', () => {
    const pnl: PortfolioPnl = {
      period: '30d',
      totalPnl: 95.25,
      realizedPnl: 80.0,
      unrealizedPnl: 15.25,
      winRate: 0.62,
      tradeCount: 48,
      bestTrade: 120.5,
      worstTrade: -30.25,
      dataPoints: [
        { time: '2026-04-10T00:00:00.000Z', pnl: 125.5 },
        { time: '2026-04-11T00:00:00.000Z', pnl: -30.25 },
      ],
    };
    expect(pnl.period).toBe('30d');
    expect(pnl.totalPnl).toBe(95.25);
    expect(pnl.realizedPnl).toBe(80.0);
    expect(pnl.unrealizedPnl).toBe(15.25);
    expect(pnl.dataPoints).toHaveLength(2);
    expect((pnl as any).snapshots).toBeUndefined();
  });

  it('should handle empty result', () => {
    const pnl: PortfolioPnl = {
      period: '7d',
      totalPnl: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      winRate: 0,
      tradeCount: 0,
      bestTrade: 0,
      worstTrade: 0,
      dataPoints: [],
    };
    expect(pnl.dataPoints).toHaveLength(0);
  });
});

// --- Conditional order get/cancel (#65) ---

describe('getConditionalOrder and cancelConditionalOrder (#65)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ id: 'co-1', status: 'PENDING' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('getConditionalOrder sends GET to /api/v1/orders/conditional/:id', async () => {
    await client.getConditionalOrder('co-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/orders/conditional/co-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('cancelConditionalOrder sends DELETE to /api/v1/orders/conditional/:id', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.cancelConditionalOrder('co-2');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/orders/conditional/co-2');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('DELETE');
  });

  it('getConditionalOrder encodes special characters in ID', async () => {
    await client.getConditionalOrder('co/special&id');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toContain('co%2Fspecial%26id');
  });
});

describe('Watchlist CRUD (issue #56)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('getWatchlist sends GET to /api/v1/watchlist', async () => {
    await client.getWatchlist();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/watchlist');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('addToWatchlist sends POST with { marketId }', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ marketId: 'mkt-1', addedAt: '2026-01-01T00:00:00Z' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.addToWatchlist('mkt-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/watchlist');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ marketId: 'mkt-1' });
  });

  it('removeFromWatchlist sends DELETE to /api/v1/watchlist/:marketId', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.removeFromWatchlist('mkt-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/watchlist/mkt-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('DELETE');
  });

  it('removeFromWatchlist encodes special characters in marketId', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.removeFromWatchlist('mkt/special&id');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toContain('mkt%2Fspecial%26id');
  });

  it('getWatchlistStatus sends GET to /api/v1/watchlist/:marketId/status', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ marketId: 'mkt-1', watched: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getWatchlistStatus('mkt-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/watchlist/mkt-1/status');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getWatchlistStatus encodes special characters in marketId', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ marketId: 'mkt/special', watched: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getWatchlistStatus('mkt/special');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toContain('mkt%2Fspecial');
  });
});

describe('Webhook mutations (issue #57)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('deleteWebhook sends DELETE to /api/v1/webhooks/:id', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.deleteWebhook('wh-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/webhooks/wh-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('DELETE');
  });

  it('deleteWebhook encodes special characters in ID', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.deleteWebhook('wh/special&id');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toContain('wh%2Fspecial%26id');
  });

  it('testWebhook sends POST to /api/v1/webhooks/:id/test', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, statusCode: 200 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.testWebhook('wh-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/webhooks/wh-1/test');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    expect(result).toEqual({ success: true, statusCode: 200 });
  });

  it('testWebhook encodes special characters in ID', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, statusCode: 500 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.testWebhook('wh/special&id');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toContain('wh%2Fspecial%26id');
  });
});

describe('Price history & order book (issue #52)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('getPriceHistory sends GET to /api/v1/markets/:tokenId/price-history', async () => {
    await client.getPriceHistory('token-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/markets/token-1/price-history');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getPriceHistory passes resolution and limit as query params', async () => {
    await client.getPriceHistory('token-1', { resolution: '1h', limit: 100 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('resolution')).toBe('1h');
    expect(url.searchParams.get('limit')).toBe('100');
    expect(url.searchParams.get('period')).toBeNull();
  });

  it('getPriceHistory works without params', async () => {
    await client.getPriceHistory('token-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.toString()).toBe('');
  });

  it('getPriceHistory encodes special characters in tokenId', async () => {
    await client.getPriceHistory('token/special&id');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toContain('token%2Fspecial%26id');
  });

  it('getPriceHistory returns OHLCV candles with bucket field', async () => {
    const candle = { bucket: '2026-04-19T12:00:00.000Z', open: '0.65', high: '0.72', low: '0.63', close: '0.70', volume: 1500 };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([candle]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getPriceHistory('token-1');
    expect(result).toEqual([candle]);
    expect(result[0].bucket).toBe('2026-04-19T12:00:00.000Z');
    expect(result[0].open).toBe('0.65');
    expect(result[0].close).toBe('0.70');
    expect(result[0].volume).toBe(1500);
  });

  it('getPriceHistory accepts 5m and 15m resolutions', async () => {
    await client.getPriceHistory('token-1', { resolution: '5m' });
    let url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('resolution')).toBe('5m');

    fetchSpy.mockClear();
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getPriceHistory('token-1', { resolution: '15m' });
    url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('resolution')).toBe('15m');
  });

  it('getOrderBook sends GET to /api/v1/markets/:tokenId/book', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ bids: [], asks: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getOrderBook('token-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/markets/token-1/book');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result).toEqual({ bids: [], asks: [] });
  });

  it('getOrderBook encodes special characters in tokenId', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ bids: [], asks: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getOrderBook('token/special&id');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toContain('token%2Fspecial%26id');
  });

  // ── API Keys (#53) ──────────────────────────────────────────────────────

  it('listApiKeys calls GET /api/v1/api-keys', async () => {
    const mockKeys = [{ id: 'k-1', name: 'My Key', prefix: 'pf_abc123', scopes: ['READ'], expiresAt: null, lastUsedAt: null, createdAt: '2026-04-14T00:00:00Z' }];
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockKeys), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.listApiKeys();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/api-keys');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result).toEqual(mockKeys);
  });

  it('createApiKey sends name and scopes to POST /api/v1/api-keys', async () => {
    const mockResponse = { id: 'k-1', name: 'Trading', prefix: 'pf_abc123', scopes: ['READ', 'TRADE'], createdAt: '2026-04-14T00:00:00Z', token: 'pf_abc123...' };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.createApiKey({ name: 'Trading', scopes: ['READ', 'TRADE'] });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/api-keys');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ name: 'Trading', scopes: ['READ', 'TRADE'] });
    expect(result.token).toBe('pf_abc123...');
  });

  it('createApiKey sends only name when scopes omitted', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'k-1', name: 'Default', prefix: 'pf_x', scopes: ['READ'], createdAt: '2026-04-14T00:00:00Z', token: 'pf_x...' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.createApiKey({ name: 'Default' });
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ name: 'Default' });
    expect(body).not.toHaveProperty('scopes');
  });

  it('revokeApiKey calls DELETE /api/v1/api-keys/:id', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    await client.revokeApiKey('key-uuid-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/api-keys/key-uuid-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('DELETE');
  });

  it('revokeApiKey encodes special characters in id', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    await client.revokeApiKey('key/special&id');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toContain('key%2Fspecial%26id');
  });

  it('ApiKey type has correct platform fields', () => {
    const key: import('../types').ApiKey = {
      id: 'k-1',
      name: 'My Key',
      prefix: 'pf_abc123',
      scopes: ['READ'],
      expiresAt: null,
      lastUsedAt: '2026-04-14T00:00:00Z',
      createdAt: '2026-04-14T00:00:00Z',
    };
    expect(key.prefix).toBe('pf_abc123');
    expect(key.scopes).toEqual(['READ']);
    expect(key.expiresAt).toBeNull();
    expect((key as any).token).toBeUndefined();
    expect((key as any).tokenHash).toBeUndefined();
  });

  // ── CSV Exports (#55) ────────────────────────────────────────────────────

  it('exportOrdersCsv calls GET /api/v1/orders/export/csv and returns string', async () => {
    const csvData = 'id,marketId,side,size,price\norder-1,mkt-1,BUY,10,0.65';
    fetchSpy.mockResolvedValueOnce(
      new Response(csvData, { status: 200, headers: { 'Content-Type': 'text/csv' } }),
    );
    const result = await client.exportOrdersCsv();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/orders/export/csv');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result).toBe(csvData);
  });

  it('exportPortfolioCsv calls GET /api/v1/portfolio/export/csv and returns string', async () => {
    const csvData = 'tokenId,outcome,size,avgPrice\ntok-1,YES,100,0.55';
    fetchSpy.mockResolvedValueOnce(
      new Response(csvData, { status: 200, headers: { 'Content-Type': 'text/csv' } }),
    );
    const result = await client.exportPortfolioCsv();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/portfolio/export/csv');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result).toBe(csvData);
  });

  it('exportOrdersCsv throws PolyforgeError on failure', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } }),
    );
    await expect(client.exportOrdersCsv()).rejects.toThrow('Invalid token');
  });

  it('requestText does not send Content-Type header', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('csv-data', { status: 200, headers: { 'Content-Type': 'text/csv' } }),
    );
    await client.exportOrdersCsv();
    const headers = fetchSpy.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Content-Type');
    expect(headers['Authorization']).toBe('Bearer test-key');
  });
});

describe('Strategy social + versioning endpoints (#54)', () => {
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

  it('likeStrategy sends POST /api/v1/strategies/:id/like', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ liked: true, likeCount: 5 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.likeStrategy('s-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/strategies/s-1/like');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    expect(result).toEqual({ liked: true, likeCount: 5 });
  });

  it('listStrategyComments sends GET /api/v1/strategies/:id/comments with pagination', async () => {
    const resp = { data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(resp), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.listStrategyComments('s-1', { page: 2, limit: 10 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/strategies/s-1/comments');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('addStrategyComment sends POST /api/v1/strategies/:id/comments with { content }', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'c-1', content: 'Nice!' }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.addStrategyComment('s-1', 'Nice!');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/strategies/s-1/comments');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ content: 'Nice!' });
  });

  it('deleteStrategyComment sends DELETE /api/v1/strategies/:strategyId/comments/:commentId', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    await client.deleteStrategyComment('s-1', 'c-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/strategies/s-1/comments/c-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('DELETE');
  });

  it('listStrategyChildren sends GET /api/v1/strategies/:id/children', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ children: [{ id: 's-2', name: 'Fork', status: 'IDLE' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.listStrategyChildren('s-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/strategies/s-1/children');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].id).toBe('s-2');
  });

  it('reportStrategy sends POST /api/v1/strategies/:id/report with { reason }', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ reportId: 'r-1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.reportStrategy('s-1', 'SPAM');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/strategies/s-1/report');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ reason: 'SPAM' });
    expect(body).not.toHaveProperty('description');
  });

  it('reportStrategy includes optional description', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ reportId: 'r-1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.reportStrategy('s-1', 'OTHER', 'Looks suspicious');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ reason: 'OTHER', description: 'Looks suspicious' });
  });

  it('reportStrategy accepts MISLEADING reason', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ reportId: 'r-2' }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.reportStrategy('s-1', 'MISLEADING');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ reason: 'MISLEADING' });
  });

  it('listStrategyVersions sends GET /api/v1/strategies/:id/versions', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'v-1', version: 1 }]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.listStrategyVersions('s-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/strategies/s-1/versions');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result).toHaveLength(1);
  });

  it('rollbackStrategy sends POST /api/v1/strategies/:id/versions/:versionId/rollback', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Rolled back successfully', version: 2 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.rollbackStrategy('s-1', 'v-2');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/strategies/s-1/versions/v-2/rollback');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    expect(result.message).toBe('Rolled back successfully');
    expect(result.version).toBe(2);
  });

  it('getStrategyEventLog sends GET /api/v1/strategies/:id/event-log with limit param', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'e-1', eventType: 'ORDER_PLACED', payload: {}, createdAt: '2026-01-01' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getStrategyEventLog('s-1', { limit: 25 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/strategies/s-1/event-log');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result).toHaveLength(1);
  });

  it('getStrategyEventLog works without params', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getStrategyEventLog('s-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/strategies/s-1/event-log');
    expect(url.searchParams.has('limit')).toBe(false);
  });
});

describe('SSE buffer size cap (#43)', () => {
  it('should throw PolyforgeError when SSE buffer exceeds 1 MB', async () => {
    const client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });

    // Create a payload larger than 1 MB with no newlines so the buffer keeps growing
    const oversizedChunk = 'x'.repeat(1_048_577);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(oversizedChunk));
        controller.close();
      },
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      { ok: true, status: 200, body: stream } as any,
    );

    const gen = client.watchStrategy('strat-1');
    try {
      await gen.next();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PolyforgeError);
      const pErr = err as PolyforgeError;
      expect(pErr.code).toBe('STREAM_ERROR');
      expect(pErr.message).toContain('maximum buffer size');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('should not throw for payloads under 1 MB', async () => {
    const client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });

    const event = JSON.stringify({ type: 'status', status: 'running' });
    const ssePayload = `data: ${event}\n\n`;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      { ok: true, status: 200, body: stream } as any,
    );

    const gen = client.watchStrategy('strat-1');
    const result = await gen.next();
    expect(result.value).toEqual({ type: 'status', status: 'running' });

    fetchSpy.mockRestore();
  });
});

describe('Copy trading CRUD (#51)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const stubConfig = { id: 'cfg-1', userId: 'u-1', targetWallet: '0xabc', mode: 'PERCENTAGE', sizeValue: '10', maxExposure: '500', maxDailyLoss: '100', priceOffset: '0', status: 'ACTIVE', totalPnl: '0', totalCopied: 0, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', stoppedAt: null };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify(stubConfig), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('createCopyConfig sends POST to /api/v1/copy with body', async () => {
    await client.createCopyConfig({ targetWallet: '0xabc', mode: 'PERCENTAGE' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/copy');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.targetWallet).toBe('0xabc');
    expect(body.mode).toBe('PERCENTAGE');
  });

  it('getCopyConfig sends GET to /api/v1/copy/:id', async () => {
    await client.getCopyConfig('cfg-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/copy/cfg-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('updateCopyConfig sends PATCH to /api/v1/copy/:id with body', async () => {
    await client.updateCopyConfig('cfg-1', { sizeValue: '100' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/copy/cfg-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('PATCH');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.sizeValue).toBe('100');
  });

  it('pauseCopyConfig sends POST to /api/v1/copy/:id/pause', async () => {
    await client.pauseCopyConfig('cfg-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/copy/cfg-1/pause');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
  });

  it('resumeCopyConfig sends POST to /api/v1/copy/:id/resume', async () => {
    await client.resumeCopyConfig('cfg-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/copy/cfg-1/resume');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
  });

  it('deleteCopyConfig sends DELETE to /api/v1/copy/:id', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.deleteCopyConfig('cfg-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/copy/cfg-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('DELETE');
  });

  it('getCopyTrades sends GET to /api/v1/copy/:id/trades', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getCopyTrades('cfg-1', { page: 2, limit: 10 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/copy/cfg-1/trades');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('getCopyConfig encodes special characters in ID', async () => {
    await client.getCopyConfig('cfg/special');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toContain('cfg%2Fspecial');
  });
});

describe('Whale intelligence extended (#66)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('getTopWhales sends GET to /api/v1/whales/top', async () => {
    await client.getTopWhales({ sortBy: 'pnl', limit: 10 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/whales/top');
    expect(url.searchParams.get('sortBy')).toBe('pnl');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('getWhaleProfile sends GET to /api/v1/whales/:address', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ walletAddress: '0xabc', stats: null, recentTrades: [], sparkline: [], isFollowing: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getWhaleProfile('0xabc');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/whales/0xabc');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('followWhale sends POST to /api/v1/whales/:address/follow', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ following: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.followWhale('0xabc');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/whales/0xabc/follow');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
  });

  it('unfollowWhale sends POST to /api/v1/whales/:address/unfollow', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ following: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.unfollowWhale('0xabc');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/whales/0xabc/unfollow');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
  });

  it('getFollowingWhales sends GET to /api/v1/whales/following', async () => {
    await client.getFollowingWhales();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/whales/following');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });
});

describe('Discover and Leaderboard (#66)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ items: [], total: 0, page: 1, limit: 20 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('discoverStrategies sends GET to /api/v1/discover', async () => {
    await client.discoverStrategies({ sort: 'popular', search: 'BTC' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/discover');
    expect(url.searchParams.get('sort')).toBe('popular');
    expect(url.searchParams.get('search')).toBe('BTC');
  });

  it('getLeaderboard sends GET to /api/v1/leaderboard', async () => {
    await client.getLeaderboard({ period: '7d' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/leaderboard');
    expect(url.searchParams.get('period')).toBe('7d');
  });

  it('getAccuracyLeaderboard sends paginated params to /api/v1/leaderboard', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              rank: 51,
              userId: 'u1',
              username: 'alice',
              displayName: null,
              avatarUrl: null,
              pnl: '12.50',
              winRate: '55.0',
              tradeCount: 10,
            },
          ],
          total: 75,
          page: 3,
          limit: 25,
          totalPages: 3,
          hasNext: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const params: AccuracyLeaderboardParams = { period: '30d', limit: 25, offset: 50 };

    const result = await client.getAccuracyLeaderboard(params);
    const url = new URL(fetchSpy.mock.calls[0][0] as string);

    expect(url.pathname).toBe('/api/v1/leaderboard');
    expect(url.searchParams.get('period')).toBe('30d');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('page')).toBe('3');
    expect(url.searchParams.has('offset')).toBe(false);
    expect(url.searchParams.has('cursor')).toBe(false);
    expect(result.data[0]!.rank).toBe(51);
    expect(result.pagination).toEqual({ total: 75, page: 3, limit: 25, totalPages: 3 });
  });
});

describe('Paper trading (#66)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ balance: 10000, pnl: 0, tradeCount: 0, openPositions: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('getPaperSummary sends GET to /api/v1/paper/summary', async () => {
    await client.getPaperSummary();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/paper/summary');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('resetPaperAccount sends POST to /api/v1/paper/reset', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ reset: true, newBalance: 10000 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.resetPaperAccount();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/paper/reset');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
  });
});

describe('Batch API (#66)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ results: [{ id: 'req-1', status: 200, body: {} }, { id: 'req-2', status: 200, body: {} }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('batchRequests sends POST to /api/v1/batch with items array', async () => {
    const res = await client.batchRequests([
      { id: 'req-1', method: 'GET', path: '/api/v1/portfolio' },
      { id: 'req-2', method: 'GET', path: '/api/v1/strategies' },
    ]);
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/batch');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].id).toBe('req-1');
    expect(body.items[0].method).toBe('GET');
    expect(body.items[0].path).toBe('/api/v1/portfolio');
    expect(res.results[0].id).toBe('req-1');
    expect(res.results[1].id).toBe('req-2');
  });
});

describe('Marketplace seller CRUD (#66)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const stubListing = { id: 'lst-1', strategyId: 'strat-1', sellerId: 'user-1', title: 'My Strategy', description: null, priceUsdc: '10', status: 'ACTIVE', purchaseCount: 0, forkCount: 0, avgRating: null, ratingCount: 0, tags: [], createdAt: '2025-01-01T00:00:00.000Z', seller: { id: 'user-1', name: 'Alice', avatarUrl: null }, strategy: { id: 'strat-1', name: 'My Strategy', description: null } };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify(stubListing), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('createListing sends POST to /api/v1/marketplace with body', async () => {
    await client.createListing({ strategyId: 'strat-1', title: 'My Strategy', priceUsdc: 10 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/marketplace');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.strategyId).toBe('strat-1');
    expect(body.priceUsdc).toBe(10);
  });

  it('updateListing sends PATCH to /api/v1/marketplace/:id with body', async () => {
    await client.updateListing('lst-1', { priceUsdc: 15, status: 'PAUSED' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/marketplace/lst-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('PATCH');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.priceUsdc).toBe(15);
    expect(body.status).toBe('PAUSED');
  });

  it('getMyListings sends GET to /api/v1/marketplace/my/listings', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([stubListing]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getMyListings();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/marketplace/my/listings');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getMyPurchases sends GET to /api/v1/marketplace/my/purchases', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getMyPurchases();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/marketplace/my/purchases');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('rateListing sends POST to /api/v1/marketplace/:id/rate with body', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rated: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.rateListing('lst-1', { rating: 5, review: 'Great!' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/marketplace/lst-1/rate');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.rating).toBe(5);
    expect(body.review).toBe('Great!');
  });
});

// ── Risk Settings (#124) ─────────────────────────────────────────────────────

describe('Risk Settings', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const mockRiskSettings = {
    drawdownEnabled: false,
    drawdownLookbackHours: 24,
    drawdownThresholdPct: 0.1,
    circuitBreakerTripped: false,
    circuitBreakerTrippedAt: null,
  };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockRiskSettings), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('getRiskSettings calls GET /api/v1/settings/risk', async () => {
    const result = await client.getRiskSettings();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('GET');
    expect(url).toContain('/api/v1/settings/risk');
    expect(result.drawdownEnabled).toBe(false);
    expect(result.drawdownLookbackHours).toBe(24);
    expect(result.drawdownThresholdPct).toBe(0.1);
    expect(result.circuitBreakerTripped).toBe(false);
    expect(result.circuitBreakerTrippedAt).toBeNull();
  });

  it('updateRiskSettings calls PATCH /api/v1/settings/risk with body', async () => {
    await client.updateRiskSettings({ drawdownEnabled: true, drawdownThresholdPct: 0.15 });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PATCH');
    expect(url).toContain('/api/v1/settings/risk');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ drawdownEnabled: true, drawdownThresholdPct: 0.15 });
  });

  it('updateRiskSettings with only drawdownLookbackHours', async () => {
    await client.updateRiskSettings({ drawdownLookbackHours: 8 });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ drawdownLookbackHours: 8 });
  });

  it('resetCircuitBreaker calls POST /api/v1/settings/risk/reset', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ...mockRiskSettings, circuitBreakerTripped: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await client.resetCircuitBreaker();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(url).toContain('/api/v1/settings/risk/reset');
    expect(result.circuitBreakerTripped).toBe(false);
  });

  it('getRiskSettings returns RiskSettings with correct shape', async () => {
    const result = await client.getRiskSettings();
    expect(typeof result.drawdownEnabled).toBe('boolean');
    expect(typeof result.drawdownLookbackHours).toBe('number');
    expect(typeof result.drawdownThresholdPct).toBe('number');
    expect(typeof result.circuitBreakerTripped).toBe('boolean');
  });
});

// ── Missing endpoint families (POLA-315 / #156) ──────────────────────────────

describe('Markets — extended data (#156)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('searchMarkets sends GET to /api/v1/markets/search with q param', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.searchMarkets('bitcoin');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/markets/search');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(url.searchParams.get('q')).toBe('bitcoin');
  });

  it('searchMarkets passes optional limit param', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.searchMarkets('eth', 5);
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('limit')).toBe('5');
  });

  it('getTickSize sends GET to /api/v1/markets/:tokenId/tick-size', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ tokenId: 'tok-1', tickSize: '0.01', feeRate: '0' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getTickSize('tok-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/markets/tok-1/tick-size');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getSpread sends GET to /api/v1/markets/:tokenId/spread', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ tokenId: 'tok-1', spread: '0.02' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getSpread('tok-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/markets/tok-1/spread');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getMidpoint sends GET to /api/v1/markets/:tokenId/midpoint', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ tokenId: 'tok-1', midpoint: '0.51' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getMidpoint('tok-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/markets/tok-1/midpoint');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getClobBook sends GET to /api/v1/markets/:tokenId/clob-book', async () => {
    const stub = { tokenId: 'tok-1', bids: [], asks: [], spread: '0', midpoint: '0', timestamp: 0 };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(stub), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getClobBook('tok-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/markets/tok-1/clob-book');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getClobPricesHistory sends GET to /api/v1/markets/:tokenId/clob-prices-history', async () => {
    const stub = { tokenId: 'tok-1', interval: '1h', history: [] };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(stub), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getClobPricesHistory('tok-1', { interval: '1h', fidelity: 60 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/markets/tok-1/clob-prices-history');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(url.searchParams.get('interval')).toBe('1h');
    expect(url.searchParams.get('fidelity')).toBe('60');
  });

  it('getClobPricesHistory works without params', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ tokenId: 'tok-1', interval: '1h', history: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getClobPricesHistory('tok-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/markets/tok-1/clob-prices-history');
  });
});

describe('Orders — bulk operations (#156)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('placeBatchOrders sends POST to /api/v1/orders/batch with orders array', async () => {
    const stub = { results: [{ orderId: 'o-1', intentId: 'i-1', status: 'PENDING' }] };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(stub), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const orders = [{ marketId: 'mkt-1', tokenId: 'tok-1', side: 'BUY' as const, outcome: 'YES' as const, size: 10, price: 0.5 }];
    await client.placeBatchOrders(orders, 'batch-key-123');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/orders/batch');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    expect((fetchSpy.mock.calls[0][1]!.headers as Record<string, string>)['Idempotency-Key']).toBe('batch-key-123');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toHaveProperty('orders');
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders[0].tokenId).toBe('tok-1');
  });

  it('placeOrder sends POST to /api/v1/orders/place with marketId', async () => {
    const stub = { orderId: 'o-1', intentId: 'i-1', status: 'PENDING' };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(stub), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.placeOrder({ marketId: 'mkt-1', tokenId: 'tok-1', side: 'BUY', outcome: 'YES', size: 10, price: 0.5 }, 'order-key-123');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/orders/place');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    expect((fetchSpy.mock.calls[0][1]!.headers as Record<string, string>)['Idempotency-Key']).toBe('order-key-123');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.marketId).toBe('mkt-1');
    expect(body.tokenId).toBe('tok-1');
  });

  it('cancelOrdersBulk sends DELETE to /api/v1/orders/bulk with orderIds array', async () => {
    const stub = { cancelled: ['o-1', 'o-2'], errors: [] };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(stub), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.cancelOrdersBulk(['o-1', 'o-2']);
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/orders/bulk');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('DELETE');
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toHaveProperty('orderIds');
    expect(body.orderIds).toEqual(['o-1', 'o-2']);
  });
});

describe('Trading write idempotency (#208)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const tradingWrites = [
    {
      name: 'placeOrder',
      path: '/api/v1/orders/place',
      call: (key: string) => client.placeOrder(
        { marketId: 'mkt-1', tokenId: 'tok-1', side: 'BUY', outcome: 'YES', size: 10, price: 0.5 },
        key,
      ),
    },
    {
      name: 'placeBatchOrders',
      path: '/api/v1/orders/batch',
      call: (key: string) => client.placeBatchOrders(
        [{ marketId: 'mkt-1', tokenId: 'tok-1', side: 'BUY', outcome: 'YES', size: 10, price: 0.5 }],
        key,
      ),
    },
    {
      name: 'closePosition',
      path: '/api/v1/orders/close-position',
      call: (key: string) => client.closePosition({ tokenId: 'tok-1', size: '10' }, key),
    },
    {
      name: 'redeemPosition',
      path: '/api/v1/orders/redeem',
      call: (key: string) => client.redeemPosition({ positionId: 'pos-1' }, key),
    },
    {
      name: 'splitPosition',
      path: '/api/v1/orders/split',
      call: (key: string) => client.splitPosition({ tokenId: 'tok-1', amount: '10' }, key),
    },
    {
      name: 'mergePosition',
      path: '/api/v1/orders/merge',
      call: (key: string) => client.mergePosition({ tokenId: 'tok-1', amount: '10' }, key),
    },
    {
      name: 'createConditionalOrder',
      path: '/api/v1/orders/conditional',
      call: (key: string) => client.createConditionalOrder({
        marketId: 'mkt-1',
        tokenId: 'tok-1',
        type: 'STOP_LOSS',
        side: 'SELL',
        outcome: 'YES',
        size: 50,
        triggerPrice: 0.3,
      }, key),
    },
    {
      name: 'placeSmartOrder',
      path: '/api/v1/orders/smart',
      call: (key: string) => client.placeSmartOrder({
        type: 'TWAP',
        tokenId: 'tok-1',
        side: 'BUY',
        outcome: 'YES',
        totalSize: 100,
        slices: 5,
        intervalMinutes: 15,
      }, key),
    },
    {
      name: 'provideLiquidity',
      path: '/api/v1/lp/provide',
      call: (key: string) => client.provideLiquidity(
        { marketId: 'mkt-1', tokenId: 'tok-1', amountUsdc: 100 },
        key,
      ),
    },
  ];

  it.each(tradingWrites)('$name sends Idempotency-Key on the protected POST endpoint', async ({ path, call }) => {
    await call('trade-key-123');

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe(path);
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    expect((fetchSpy.mock.calls[0][1]!.headers as Record<string, string>)['Idempotency-Key']).toBe('trade-key-123');
  });

  it.each(tradingWrites)('$name rejects a missing idempotencyKey before fetch', async ({ call }) => {
    await expect(call(undefined as unknown as string)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('idempotencyKey'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(tradingWrites)('$name rejects an invalid idempotencyKey before fetch', async ({ call }) => {
    await expect(call('short')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('idempotencyKey'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps unprotected cancel endpoints free of Idempotency-Key', async () => {
    await client.cancelOrder('order-1');
    await client.cancelOrdersBulk(['order-1']);
    await client.cancelConditionalOrder('conditional-1');
    await client.cancelSmartOrder('smart-1');

    for (const [, init] of fetchSpy.mock.calls) {
      expect((init!.headers as Record<string, string>)['Idempotency-Key']).toBeUndefined();
    }
  });
});

describe('News — articles (#156)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const stubArticle = { id: 'a-1', title: 'Test', source: 'Reuters', url: 'https://example.com', imageUrl: null, sentiment: 'NEUTRAL', publishedAt: '2025-01-01T00:00:00Z' };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('listNews sends GET to /api/v1/news', async () => {
    const stub = { data: [stubArticle], total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(stub), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.listNews();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/news');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('listNews passes source and sentiment filters', async () => {
    const stub = { data: [], total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(stub), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.listNews({ source: 'Reuters', sentiment: 'POSITIVE' });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('source')).toBe('Reuters');
    expect(url.searchParams.get('sentiment')).toBe('POSITIVE');
  });

  it('getNewsArticle sends GET to /api/v1/news/:id', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(stubArticle), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getNewsArticle('a-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/news/a-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });
});

describe('Scores — badges and extended views (#156)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const stubBadge = { id: 'b-1', userId: 'u-1', type: 'WHALE_HUNTER', name: 'Whale Hunter', earnedAt: '2025-01-01T00:00:00Z' };
  const stubTopEntry = { userId: 'u-1', username: 'alice', displayName: 'Alice', avatarUrl: null, score: 95, winRate: '0.65', totalTrades: 100 };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('getTopScores sends GET to /api/v1/scores/top', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([stubTopEntry]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getTopScores();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/scores/top');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getMyBadges sends GET to /api/v1/scores/me/badges', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([stubBadge]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getMyBadges();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/scores/me/badges');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getUserScore sends GET to /api/v1/scores/:userId', async () => {
    const stub = { score: null, breakdown: null };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(stub), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getUserScore('user-123');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/scores/user-123');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getUserBadges sends GET to /api/v1/scores/:userId/badges', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([stubBadge]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getUserBadges('user-123');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/scores/user-123/badges');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getTopScores does NOT hit scores/me (route order safety)', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getTopScores();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).not.toBe('/api/v1/scores/me');
  });
});

describe('Portfolio — Polymarket-specific (#156)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('getPolymarketPortfolio sends GET to /api/v1/portfolio/polymarket/portfolio', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ entries: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getPolymarketPortfolio();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/portfolio/polymarket/portfolio');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getPolymarketEarnings sends GET to /api/v1/portfolio/polymarket/earnings', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ entries: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getPolymarketEarnings();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/portfolio/polymarket/earnings');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getPolymarketActivity sends GET to /api/v1/portfolio/polymarket/activity', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ activities: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getPolymarketActivity();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/portfolio/polymarket/activity');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getPolymarketActivity passes type filter when provided', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ activities: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getPolymarketActivity('TRADE');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('type')).toBe('TRADE');
  });

  it('getPolymarketActivity omits type param when not provided', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ activities: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getPolymarketActivity();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.has('type')).toBe(false);
  });
});

// --- Rewards API family (POLA-316 / #155) ---

describe('Rewards API', () => {
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

  it('getRewardsMarkets sends GET to /api/v1/rewards/markets', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getRewardsMarkets();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/markets');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getRewardsForMarket sends GET to /api/v1/rewards/markets/:conditionId', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getRewardsForMarket('0xabc123');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/markets/0xabc123');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getRewardsForMarket encodes conditionId', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getRewardsForMarket('id/with spaces');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/markets/id%2Fwith%20spaces');
  });

  it('getUserRewards sends GET to /api/v1/rewards/user', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rewards: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getUserRewards();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/user');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getUserRewardsTotal sends GET to /api/v1/rewards/user/total', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ total: '0', byDate: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getUserRewardsTotal();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/user/total');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getUserRewardsPercentages sends GET to /api/v1/rewards/user/percentages', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getUserRewardsPercentages();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/user/percentages');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getUserRewardsPerMarket sends GET to /api/v1/rewards/user/markets', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ markets: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getUserRewardsPerMarket();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/user/markets');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getRebates sends GET to /api/v1/rewards/rebates', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ rebates: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getRebates();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/rebates');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getMarketRewardsDetail sends GET to /api/v1/rewards/market/:marketId', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(null), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getMarketRewardsDetail('mkt/with spaces');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/market/mkt%2Fwith%20spaces');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getUserSponsoredMarkets sends GET to /api/v1/rewards/user/sponsored-markets', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ markets: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await client.getUserSponsoredMarkets();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/user/sponsored-markets');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
  });

  it('getRewardsSponsorUrl sends GET to /api/v1/rewards/sponsor-url/:marketId', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://polymarket.com/event/test/rewards' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const result = await client.getRewardsSponsorUrl('market/123');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/rewards/sponsor-url/market%2F123');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result.url).toContain('/rewards');
  });
});

describe('redeemPosition return type (#152)', () => {
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

  it('redeemPosition returns positionId not orderId', async () => {
    const redeemResponse = { positionId: 'pos-1', intentId: 'int-1', status: 'confirmed' };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(redeemResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.redeemPosition({ positionId: 'pos-1' }, 'redeem-key-123');
    expect(result).toHaveProperty('positionId', 'pos-1');
    expect(result).toHaveProperty('intentId', 'int-1');
    expect(result).not.toHaveProperty('orderId');
  });
});

// ── Cross-Venue Arbitrage (POLA-780) ────────────────────────────────────────

describe('Cross-venue arbitrage endpoints (POLA-780)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const mockOpportunity = {
    matchId: 'match-1', polymarketId: 'pm-1', kalshiId: 'k-1',
    polymarketTitle: 'BTC above 100k', kalshiTitle: 'BTC > 100k',
    polymarketYesPrice: 0.55, kalshiYesPrice: 0.48, spread: 0.07,
    recommendedAction: 'BUY Kalshi YES, SELL Polymarket YES',
    estimatedProfit: 0.07,
  };

  const mockMatch = {
    id: 'match-1', polymarketId: 'pm-1', kalshiId: 'k-1',
    verified: false, similarity: 0.92, createdAt: '2026-04-24T00:00:00Z', updatedAt: '2026-04-24T00:00:00Z',
  };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('getCrossVenueOpportunities calls GET /api/v1/arbitrage/cross-venue', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockOpportunity]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getCrossVenueOpportunities();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/cross-venue');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result[0]!.matchId).toBe('match-1');
  });

  it('getCrossVenueOpportunities passes minSpread as query param', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getCrossVenueOpportunities(5);
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('minSpread')).toBe('5');
  });

  it('getCrossVenueComparison calls GET /api/v1/arbitrage/cross-venue/:matchId/comparison', async () => {
    const mockComparison = {
      matchId: 'match-1',
      polymarket: { id: 'pm-1', title: 'BTC', yesPrice: 0.55, noPrice: 0.45, liquidity: 10000 },
      kalshi: { id: 'k-1', title: 'BTC', yesPrice: 0.48, noPrice: 0.52, liquidity: 5000 },
      spread: 0.07, updatedAt: '2026-04-24T00:00:00Z',
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockComparison), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getCrossVenueComparison('match-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/cross-venue/match-1/comparison');
    expect(result.spread).toBe(0.07);
  });

  it('listMarketMatches calls GET /api/v1/arbitrage/matches', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockMatch]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.listMarketMatches({ verified: true, limit: 10 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/matches');
    expect(url.searchParams.get('verified')).toBe('true');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(result[0]!.id).toBe('match-1');
  });

  it('getMatchesByMarket calls GET /api/v1/arbitrage/matches/market/:marketId', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockMatch]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getMatchesByMarket('pm-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/matches/market/pm-1');
  });

  it('createMarketMatch sends POST /api/v1/arbitrage/matches with polymarketId and kalshiId', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockMatch), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.createMarketMatch({ polymarketId: 'pm-1', kalshiId: 'k-1' });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/arbitrage/matches');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ polymarketId: 'pm-1', kalshiId: 'k-1' });
  });

  it('verifyMarketMatch sends POST /api/v1/arbitrage/matches/:matchId/verify', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...mockMatch, verified: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.verifyMarketMatch('match-1');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/arbitrage/matches/match-1/verify');
    expect(init.method).toBe('POST');
    expect(result.verified).toBe(true);
  });

  it('deleteMarketMatch sends DELETE /api/v1/arbitrage/matches/:matchId', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.deleteMarketMatch('match-1');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/arbitrage/matches/match-1');
    expect(init.method).toBe('DELETE');
  });

  it('syncMarketMatches sends POST /api/v1/arbitrage/matches/sync', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ matched: 12 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.syncMarketMatches();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/arbitrage/matches/sync');
    expect(init.method).toBe('POST');
    expect(result.matched).toBe(12);
  });

  it('getMarketMatch calls GET /api/v1/arbitrage/matches/:matchId', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockMatch), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getMarketMatch('match-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/matches/match-1');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result.id).toBe('match-1');
  });

  it('getCrossVenueOpportunitiesForMarket calls GET /api/v1/arbitrage/cross-venue/:marketId', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockOpportunity]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getCrossVenueOpportunitiesForMarket('pm-42');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/cross-venue/pm-42');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result).toHaveLength(1);
  });

  it('getCrossVenueOpportunitiesForMarket passes minSpread query param', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getCrossVenueOpportunitiesForMarket('pm-42', 3);
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('minSpread')).toBe('3');
  });

  it('getSpreadComparison calls GET /api/v1/arbitrage/spread', async () => {
    const mockSpread = { matchId: 'match-1', yesSpreadPct: 5.2, confidence: 0.95, verified: true };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockSpread]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getSpreadComparison();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/spread');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result[0]!.yesSpreadPct).toBe(5.2);
  });

  it('getArbitrageHistory calls GET /api/v1/arbitrage/history with query params', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getArbitrageHistory({ matchId: 'match-1', limit: 20, offset: 5 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/history');
    expect(url.searchParams.get('matchId')).toBe('match-1');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('5');
  });

  it('getArbitrageAlerts calls GET /api/v1/arbitrage/alerts', async () => {
    const mockAlert = { id: 'alert-1', minSpreadPct: 3, active: true, createdAt: '2026-04-25T00:00:00Z' };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockAlert]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getArbitrageAlerts();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/alerts');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result[0]!.id).toBe('alert-1');
  });

  it('createArbitrageAlert sends POST /api/v1/arbitrage/alerts', async () => {
    const mockAlert = { id: 'alert-2', minSpreadPct: 5, active: true, createdAt: '2026-04-25T00:00:00Z' };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockAlert), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.createArbitrageAlert({ minSpreadPct: '5', marketId: 'pm-1' });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/arbitrage/alerts');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ minSpreadPct: '5', marketId: 'pm-1' });
  });

  it('deleteArbitrageAlert sends DELETE /api/v1/arbitrage/alerts/:alertId', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.deleteArbitrageAlert('alert-1');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/arbitrage/alerts/alert-1');
    expect(init.method).toBe('DELETE');
  });
});

// ── Whale Leaderboard & Alert Filter (POLA-780) ─────────────────────────────

describe('Whale leaderboard and alert filter (POLA-780)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const mockFilter = {
    id: 'filter-1', userId: 'user-1', minSize: '1000',
    marketIds: ['m-1'], walletAddresses: ['0xabc'], sides: ['BUY'],
    active: true, createdAt: '2026-04-24T00:00:00Z', updatedAt: '2026-04-24T00:00:00Z',
  };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('getWhaleLeaderboard calls GET /api/v1/whales/leaderboard', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getWhaleLeaderboard({ period: '7d', limit: 20 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/whales/leaderboard');
    expect(url.searchParams.get('period')).toBe('7d');
    expect(url.searchParams.get('limit')).toBe('20');
  });

  it('getWhaleAlertFilter calls GET /api/v1/whales/alerts/filter', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockFilter), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getWhaleAlertFilter();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/whales/alerts/filter');
    expect(init.method).toBe('GET');
    expect(result.minSize).toBe('1000');
  });

  it('upsertWhaleAlertFilter sends PUT /api/v1/whales/alerts/filter with body', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockFilter), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.upsertWhaleAlertFilter({ minSize: '1000', sides: ['BUY'], active: true });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/whales/alerts/filter');
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string);
    expect(body.minSize).toBe('1000');
    expect(body.active).toBe(true);
  });

  it('deleteWhaleAlertFilter sends DELETE /api/v1/whales/alerts/filter', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.deleteWhaleAlertFilter();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/whales/alerts/filter');
    expect(init.method).toBe('DELETE');
  });
});

// ── Profile Endpoints (POLA-780) ────────────────────────────────────────────

describe('Profile endpoints (POLA-780)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const mockProfile = {
    id: 'user-1', username: 'trader42', displayName: 'Top Trader',
    bio: 'DeFi enthusiast', followersCount: 100, followingCount: 50,
    isFollowing: false, createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('updateMyProfile sends PATCH /api/v1/profile/me with body', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockProfile), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.updateMyProfile({ displayName: 'Top Trader', bio: 'DeFi enthusiast' });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/profile/me');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string);
    expect(body.displayName).toBe('Top Trader');
  });

  it('changeMyPassword sends POST /api/v1/profile/password with body', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.changeMyPassword({ currentPassword: 'old123', newPassword: 'new456' });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/profile/password');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.currentPassword).toBe('old123');
    expect(body.newPassword).toBe('new456');
  });

  it('updateProfileNotifications sends PATCH /api/v1/profile/notifications', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.updateProfileNotifications({ emailOnOrderFilled: true });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/profile/notifications');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string);
    expect(body.emailOnOrderFilled).toBe(true);
  });

  it('getPublicProfile calls GET /api/v1/profile/:username', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockProfile), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getPublicProfile('trader42');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/profile/trader42');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result.username).toBe('trader42');
  });

  it('getPublicProfile encodes special characters in username', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockProfile), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getPublicProfile('user/name');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toContain('user%2Fname');
  });

  it('followUser sends POST /api/v1/profile/:username/follow', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ following: true, followersCount: 101 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.followUser('trader42');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/profile/trader42/follow');
    expect(init.method).toBe('POST');
    expect(result.following).toBe(true);
    expect(result.followersCount).toBe(101);
  });
});

// ── Settings Endpoints (POLA-780) ────────────────────────────────────────────

describe('Settings endpoints (POLA-780)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('updateSettingsProfile sends PATCH /api/v1/settings/profile with platform-whitelisted fields only', async () => {
    await client.updateSettingsProfile({
      displayName: 'New Name',
      bio: 'New bio',
      avatarUrl: 'https://cdn.example.com/me.png',
      twitterHandle: 'newhandle',
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/settings/profile');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      displayName: 'New Name',
      bio: 'New bio',
      avatarUrl: 'https://cdn.example.com/me.png',
      twitterHandle: 'newhandle',
    });
    // Regression guard for the phantom `username` field (POLA-1991 / sdk-ts#192):
    // the platform DTO does not whitelist `username`, and `forbidNonWhitelisted`
    // makes any payload containing it return HTTP 400.
    expect(body).not.toHaveProperty('username');
  });

  it('getNotificationSettings deserializes the platform NotificationSettings shape', async () => {
    // Fixture matches the platform UpdateNotificationsDto exactly (channel
    // toggles + per-event `onXxx` toggles). The previous fixture used the
    // SDK's old phantom `emailOn*`/`pushOn*` names — exactly the broken
    // contract this fix closes (POLA-1996 / sdk-ts#191).
    const mockSettings = {
      emailEnabled: true,
      telegramEnabled: false,
      discordEnabled: true,
      onOrderFilled: true,
      onStrategyError: false,
      onBacktestComplete: true,
      onDailyLossLimit: false,
      onMarketResolved: true,
      onSomeoneForked: false,
      onSomeoneFollowed: true,
      onSomeoneLiked: false,
      onSomeoneCommented: true,
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockSettings), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getNotificationSettings();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/settings/notifications');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result).toEqual(mockSettings);
  });

  it('updateNotificationSettings sends PATCH /api/v1/settings/notifications with platform-whitelisted fields only', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.updateNotificationSettings({
      emailEnabled: true,
      telegramEnabled: false,
      discordEnabled: true,
      onOrderFilled: true,
      onStrategyError: false,
      onBacktestComplete: true,
      onDailyLossLimit: false,
      onMarketResolved: true,
      onSomeoneForked: false,
      onSomeoneFollowed: true,
      onSomeoneLiked: false,
      onSomeoneCommented: true,
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/settings/notifications');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      emailEnabled: true,
      telegramEnabled: false,
      discordEnabled: true,
      onOrderFilled: true,
      onStrategyError: false,
      onBacktestComplete: true,
      onDailyLossLimit: false,
      onMarketResolved: true,
      onSomeoneForked: false,
      onSomeoneFollowed: true,
      onSomeoneLiked: false,
      onSomeoneCommented: true,
    });
    // Regression guard for the phantom `emailOn*` / `pushOn*` fields
    // (POLA-1996 / sdk-ts#191): the platform DTO does not whitelist any of
    // them, and `forbidNonWhitelisted` makes any payload containing them
    // return HTTP 400. Verify none of the old shapes leak into the wire body.
    for (const phantom of [
      'emailOnOrderFilled',
      'emailOnStrategyError',
      'emailOnDailyLossLimit',
      'emailOnMarketResolved',
      'pushOnOrderFilled',
      'pushOnStrategyError',
      'pushOnWhaleAlert',
      'pushOnPriceAlert',
    ]) {
      expect(body).not.toHaveProperty(phantom);
    }
  });

  it('changePassword sends PATCH /api/v1/settings/password', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await client.changePassword({ currentPassword: 'old', newPassword: 'new' });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/settings/password');
    expect(init.method).toBe('PATCH');
  });

  it('getBetaUsage calls GET /api/v1/settings/beta-usage', async () => {
    const mockUsage = {
      requestsToday: 42, requestsThisMonth: 1500, dailyLimit: 1000,
      monthlyLimit: 30000, rateLimitPerMinute: 100, tier: 'BETA',
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockUsage), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getBetaUsage();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/settings/beta-usage');
    expect(result.tier).toBe('BETA');
  });

  it('getGasUsage calls GET /api/v1/settings/gas', async () => {
    const mockGas = {
      totalSpent: '0.025', transactionCount: 12,
      averageGasPrice: '2.1', breakdown: [],
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockGas), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getGasUsage();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/settings/gas');
    expect(result.transactionCount).toBe(12);
  });
});

// ── Support Tickets (POLA-780) ───────────────────────────────────────────────

describe('Support ticket endpoints (POLA-780)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const mockTicket = {
    id: 'ticket-1', subject: 'Cannot withdraw funds', category: 'TECHNICAL',
    priority: 'HIGH', status: 'OPEN',
    body: 'I have been trying to withdraw for 3 days.',
    messages: [], createdAt: '2026-04-24T00:00:00Z', updatedAt: '2026-04-24T00:00:00Z',
  };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('createTicket sends POST /api/v1/tickets with subject, body, category', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTicket), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.createTicket({
      subject: 'Cannot withdraw funds', body: 'I have been trying to withdraw for 3 days.',
      category: 'TECHNICAL', priority: 'HIGH',
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/tickets');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.subject).toBe('Cannot withdraw funds');
    expect(body.category).toBe('TECHNICAL');
    expect(result.id).toBe('ticket-1');
  });

  it('listTickets calls GET /api/v1/tickets with pagination', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [mockTicket], total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await client.listTickets({ page: 1, limit: 20 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/tickets');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(result.data[0]!.subject).toBe('Cannot withdraw funds');
  });

  it('getTicket calls GET /api/v1/tickets/:id', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTicket), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getTicket('ticket-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/tickets/ticket-1');
    expect(result.status).toBe('OPEN');
  });

  it('addTicketMessage sends POST /api/v1/tickets/:id/messages', async () => {
    const mockMessage = {
      id: 'msg-1', ticketId: 'ticket-1', body: 'Any updates?',
      authorUsername: 'trader42', isStaff: false, createdAt: '2026-04-24T01:00:00Z',
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockMessage), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.addTicketMessage('ticket-1', { body: 'Any updates?' });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/tickets/ticket-1/messages');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.body).toBe('Any updates?');
    expect(result.isStaff).toBe(false);
  });
});

// ── Notification Preferences (POLA-780) ─────────────────────────────────────

describe('Notification preference endpoints (POLA-780)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const mockPreferences = {
    ORDER_FILLED: { inApp: true, email: true, push: false },
    STRATEGY_ERROR: { inApp: true, email: false, push: true },
  };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  it('getNotificationPreferences calls GET /api/v1/users/me/notification-preferences', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockPreferences), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await client.getNotificationPreferences();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/users/me/notification-preferences');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result['ORDER_FILLED']!.email).toBe(true);
  });

  it('updateNotificationPreferences sends PUT /api/v1/users/me/notification-preferences', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockPreferences), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.updateNotificationPreferences({
      preferences: { ORDER_FILLED: { inApp: true, email: false, push: true } },
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/v1/users/me/notification-preferences');
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string);
    expect(body.preferences['ORDER_FILLED']!.push).toBe(true);
  });
});

describe('User venue preference endpoints (POLA-1913)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const mockPreferences: UserPreferences = {
    defaultVenue: 'polymarket',
    enabledVenues: ['polymarket', 'kalshi'],
    singlePlatformMode: false,
  };

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('getMyPreferences calls GET /api/v1/users/me/venue-preferences', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockPreferences), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await client.getMyPreferences();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(new URL(url).pathname).toBe('/api/v1/users/me/venue-preferences');
    expect(init.method).toBe('GET');
    expect(result.enabledVenues).toEqual(['polymarket', 'kalshi']);
  });

  it('updateMyPreferences PATCHes the same shape returned by getMyPreferences', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockPreferences), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const params: UpdateUserPreferencesParams = {
      defaultVenue: 'kalshi',
      singlePlatformMode: false,
    };

    await client.updateMyPreferences(params);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(new URL(url).pathname).toBe('/api/v1/users/me/venue-preferences');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual(params);
  });
});

describe('response body size limit (#184)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  function oversizedStream(prefix = '', suffix = ''): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let emitted = 0;
    const chunk = encoder.encode('x'.repeat(1024 * 1024));

    return new ReadableStream<Uint8Array>({
      start(controller) {
        if (prefix) {
          controller.enqueue(encoder.encode(prefix));
        }
      },
      pull(controller) {
        if (emitted <= 10) {
          controller.enqueue(chunk);
          emitted += 1;
          return;
        }
        if (suffix) {
          controller.enqueue(encoder.encode(suffix));
        }
        controller.close();
      },
    });
  }

  it('rejects responses with Content-Length exceeding 10 MB', async () => {
    const tenMbPlusOne = 10 * 1024 * 1024 + 1;
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(tenMbPlusOne),
        },
      }),
    );

    await expect(client.listMarkets()).rejects.toThrow('Response body too large');
  });

  it('rejects responses with Content-Length exactly at 10 MB + 1 byte with PolyforgeError code', async () => {
    const tenMbPlusOne = 10 * 1024 * 1024 + 1;
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(tenMbPlusOne),
        },
      }),
    );

    try {
      await client.listMarkets();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PolyforgeError);
      const pErr = err as PolyforgeError;
      expect(pErr.code).toBe('RESPONSE_BODY_TOO_LARGE');
      expect(pErr.message).toContain(String(tenMbPlusOne));
    }
  });

  it('allows responses with Content-Length at exactly 10 MB', async () => {
    const tenMb = 10 * 1024 * 1024;
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [], count: 0 }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(tenMb),
        },
      }),
    );

    // Should not throw — Content-Length equal to limit is allowed
    await expect(client.listMarkets()).resolves.toBeDefined();
  });

  it('allows responses without Content-Length header', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [], count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    // No Content-Length — should fall through to response.json() normally
    await expect(client.listMarkets()).resolves.toBeDefined();
  });

  it('rejects oversized JSON responses without Content-Length', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(oversizedStream('{"data":"', '"}'), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(client.listMarkets()).rejects.toMatchObject({
      code: 'RESPONSE_BODY_TOO_LARGE',
    });
  });

  it('rejects CSV responses with Content-Length exceeding 10 MB', async () => {
    const tenMbPlusOne = 10 * 1024 * 1024 + 1;
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('id,marketId\norder-1,mkt-1', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Length': String(tenMbPlusOne),
        },
      }),
    );

    await expect(client.exportOrdersCsv()).rejects.toMatchObject({
      code: 'RESPONSE_BODY_TOO_LARGE',
    });
  });

  it('rejects oversized CSV responses without Content-Length', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(oversizedStream('id,marketId\n'), {
        status: 200,
        headers: { 'Content-Type': 'text/csv' },
      }),
    );

    await expect(client.exportOrdersCsv()).rejects.toMatchObject({
      code: 'RESPONSE_BODY_TOO_LARGE',
    });
  });

  it('also guards error response bodies with Content-Length > 10 MB', async () => {
    const tenMbPlusOne = 10 * 1024 * 1024 + 1;
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'SERVER_ERROR', message: 'something went wrong' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(tenMbPlusOne),
          },
        },
      ),
    );

    try {
      await client.listMarkets();
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PolyforgeError);
      const pErr = err as PolyforgeError;
      // The safeJson guard fires inside the catch block, re-throwing RESPONSE_BODY_TOO_LARGE
      expect(pErr.code).toBe('RESPONSE_BODY_TOO_LARGE');
    }
  });
});

// ── Sports markets endpoints (POLA-1841) ───────────────────────────────────

describe('Sports markets endpoints', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('listSportsCategories GETs /sports/categories and returns the array as-is', async () => {
    const payload = [
      { category: 'NFL', label: 'NFL', seriesTickers: ['KXNFL'], marketCount: 12 },
      { category: 'NBA', label: 'NBA', seriesTickers: ['KXNBA'], marketCount: 5 },
    ];
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(payload));

    const result = await client.listSportsCategories();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('GET');
    expect(url).toContain('/api/v1/sports/categories');
    expect(new URL(url).search).toBe('');
    expect(result).toEqual(payload);
  });

  it('listSportsMarkets forwards every supported query param', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [{ id: 'm1', title: 'Will Lakers win?' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await client.listSportsMarkets({
      page: 2,
      limit: 25,
      category: 'NFL',
      search: 'lakers',
      seriesTicker: 'KXNFL',
      eventTicker: 'KXNFLGAME-26W12-KCDEN',
      liveOnly: true,
      sort: 'closing_soon',
    });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(init.method).toBe('GET');
    expect(parsed.pathname).toBe('/api/v1/sports/markets');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('limit')).toBe('25');
    expect(parsed.searchParams.get('category')).toBe('NFL');
    expect(parsed.searchParams.get('search')).toBe('lakers');
    expect(parsed.searchParams.get('seriesTicker')).toBe('KXNFL');
    expect(parsed.searchParams.get('eventTicker')).toBe('KXNFLGAME-26W12-KCDEN');
    expect(parsed.searchParams.get('liveOnly')).toBe('true');
    expect(parsed.searchParams.get('sort')).toBe('closing_soon');
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('listSportsEvents forwards category, seriesTicker and status', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [{ id: 'evt-1', status: 'LIVE' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await client.listSportsEvents({
      page: 1,
      limit: 20,
      category: 'NBA',
      seriesTicker: 'KXNBA',
      status: 'LIVE',
    });

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/api/v1/sports/events');
    expect(parsed.searchParams.get('category')).toBe('NBA');
    expect(parsed.searchParams.get('seriesTicker')).toBe('KXNBA');
    expect(parsed.searchParams.get('status')).toBe('LIVE');
    expect(result.data[0]).toMatchObject({ id: 'evt-1', status: 'LIVE' });
  });

  it('getSportsEvent URL-encodes the eventTicker path segment', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        event: { id: 'KX/NFL GAME', title: 'Game' },
        markets: [{ id: 'm1' }, { id: 'm2' }],
      }),
    );

    const result = await client.getSportsEvent('KX/NFL GAME');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('GET');
    // '/' -> %2F, ' ' -> %20
    expect(url).toContain('/api/v1/sports/events/KX%2FNFL%20GAME');
    expect(result.markets).toHaveLength(2);
    expect(result.event).toMatchObject({ id: 'KX/NFL GAME' });
  });

  it('listSportsMilestones forwards only supported query params', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        milestones: [{ id: 'milestone-1' }, { id: 'milestone-2' }],
        cursor: 'next-page-cursor',
      }),
    );

    const result = await client.listSportsMilestones({
      page: 2,
      limit: 10,
      cursor: 'cursor-1',
      eventTicker: 'KXNFLGAME-26W12-KCDEN',
      status: 'open',
    } as any);

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/api/v1/sports/milestones');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('limit')).toBe('10');
    expect(parsed.searchParams.get('eventTicker')).toBe('KXNFLGAME-26W12-KCDEN');
    expect(parsed.searchParams.get('status')).toBe('open');
    expect(parsed.searchParams.has('cursor')).toBe(false);
    expect(result.milestones).toHaveLength(2);
    expect(result.cursor).toBe('next-page-cursor');
  });

  it('getSportsLiveData URL-encodes the milestoneId and accepts null liveData', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ liveData: null }),
    );

    const result = await client.getSportsLiveData('milestone with space');
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/api/v1/sports/live-data/milestone%20with%20space');
    expect(result).toEqual({ liveData: null });
  });

  it('listSportsCombos forwards only supported query params', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        collections: [{ collectionTicker: 'COMBO-A' }],
        cursor: null,
      }),
    );

    const result = await client.listSportsCombos({
      page: 3,
      limit: 5,
      cursor: 'cursor-2',
      seriesTicker: 'KXNFL',
    } as any);
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/api/v1/sports/combos');
    expect(parsed.searchParams.get('page')).toBe('3');
    expect(parsed.searchParams.get('limit')).toBe('5');
    expect(parsed.searchParams.get('seriesTicker')).toBe('KXNFL');
    expect(parsed.searchParams.has('cursor')).toBe(false);
    expect(result.collections).toHaveLength(1);
    expect(result.cursor).toBeNull();
  });

  it('getSportsComboCollection URL-encodes the collectionTicker', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ collections: [], cursor: null }),
    );

    await client.getSportsComboCollection('combo/with space');
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/api/v1/sports/combos/combo%2Fwith%20space');
  });

  it('lookupSportsCombo POSTs the body and returns the resolved tickers', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ eventTicker: 'EVT-1', marketTicker: 'MKT-1' }),
    );

    const params = {
      collectionTicker: 'COMBO-A',
      selectedMarkets: [
        { marketTicker: 'MKT-1', eventTicker: 'EVT-1', side: 'yes' as const },
        { marketTicker: 'MKT-2', eventTicker: 'EVT-2', side: 'no' as const },
      ],
    };

    const result = await client.lookupSportsCombo(params);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('POST');
    expect(url).toContain('/api/v1/sports/combos/lookup');
    expect(JSON.parse(init.body as string)).toEqual(params);
    expect(result).toEqual({ eventTicker: 'EVT-1', marketTicker: 'MKT-1' });
  });

  it('lookupSportsCombo returns null when no combo matches', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(null));

    const result = await client.lookupSportsCombo({
      collectionTicker: 'COMBO-A',
      selectedMarkets: [],
    });

    expect(result).toBeNull();
  });

  it.each<[string, (c: PolyforgeClient) => Promise<unknown>]>([
    ['listSportsCategories', (c) => c.listSportsCategories()],
    ['listSportsMarkets', (c) => c.listSportsMarkets()],
    ['listSportsEvents', (c) => c.listSportsEvents()],
    ['getSportsEvent', (c) => c.getSportsEvent('ghost')],
    ['listSportsMilestones', (c) => c.listSportsMilestones()],
    ['getSportsLiveData', (c) => c.getSportsLiveData('ghost')],
    ['listSportsCombos', (c) => c.listSportsCombos()],
    ['getSportsComboCollection', (c) => c.getSportsComboCollection('ghost')],
    ['lookupSportsCombo', (c) =>
      c.lookupSportsCombo({ collectionTicker: 'ghost', selectedMarkets: [] }),
    ],
  ])('%s surfaces 401 UNAUTHORIZED as PolyforgeError', async (_name, call) => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ code: 'UNAUTHORIZED', message: 'Missing token' }, 401),
    );

    await expect(call(client)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });
});

describe('Misc public utility endpoints (POLA-1856)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  beforeEach(() => {
    client = new PolyforgeClient({
      apiKey: 'test-key',
      apiUrl: 'https://api.polyforge.app',
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('getAccuracyOverview GETs /accuracy and returns the AccuracyScore shape', async () => {
    const payload = {
      brierScore: 0.18,
      totalPredictions: 25,
      correctPredictions: 18,
      winRate: '0.72',
      calibration: [{ bucketMid: 0.5, frequency: 0.55, count: 10 }],
      byCategory: { Crypto: { count: 10, brierScore: 0.15 } },
    };
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(payload));

    const result = await client.getAccuracyOverview();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('GET');
    expect(url).toContain('/api/v1/accuracy');
    expect(url).not.toContain('/accuracy/me');
    expect(result).toEqual(payload);
  });

  it('getFeed forwards every supported query param and returns paginated whale trades', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [{ id: 'w1', notional: '15000' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await client.getFeed({
      minSize: '10000',
      marketId: 'm1',
      walletAddress: '0xabc',
      side: 'BUY',
      page: 2,
      limit: 50,
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(init.method).toBe('GET');
    expect(parsed.pathname).toBe('/api/v1/feed');
    expect(parsed.searchParams.get('minSize')).toBe('10000');
    expect(parsed.searchParams.get('marketId')).toBe('m1');
    expect(parsed.searchParams.get('walletAddress')).toBe('0xabc');
    expect(parsed.searchParams.get('side')).toBe('BUY');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('limit')).toBe('50');
    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('listJournal forwards mood + pagination', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'o1',
            marketId: 'm1',
            mood: 'CONFIDENT',
            note: 'High conviction',
            side: 'BUY',
            outcome: 'YES',
            price: '0.55',
            size: '100',
            status: 'CONFIRMED',
            createdAt: '2026-05-01T00:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await client.listJournal({ mood: 'CONFIDENT', page: 1, limit: 20 });
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/api/v1/journal');
    expect(parsed.searchParams.get('mood')).toBe('CONFIDENT');
    expect(parsed.searchParams.get('page')).toBe('1');
    expect(parsed.searchParams.get('limit')).toBe('20');
    expect(result.data[0].mood).toBe('CONFIDENT');
  });

  it('listNotifications GETs /notifications with pagination params', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'n1',
            userId: 'u1',
            channel: 'inApp',
            eventType: 'order_filled',
            title: 'Order filled',
            body: null,
            metadata: null,
            read: false,
            sentAt: '2026-05-01T00:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      }),
    );

    const result = await client.listNotifications({ limit: 50 });
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/api/v1/notifications');
    expect(parsed.searchParams.get('limit')).toBe('50');
    expect(result.data[0].channel).toBe('inApp');
  });

  it('getMyReferrals GETs /referrals/me and returns the MyReferrals shape', async () => {
    const payload = {
      referralCode: 'ABCDEF12',
      referralLink: 'https://polyforge.trade/ref/ABCDEF12',
      stats: { invited: 0, signedUp: 0, active: 0, creditsEarned: 0 },
      referrals: [],
    };
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(payload));

    const result = await client.getMyReferrals();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('GET');
    expect(url).toContain('/api/v1/referrals/me');
    expect(result).toEqual(payload);
  });

  it('getMyFollowing GETs /users/me/following and normalizes platform pagination', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'user-2',
            username: 'bob',
            displayName: 'Bob',
            avatarUrl: null,
          },
        ],
        total: 1,
        page: 2,
        limit: 10,
        totalPages: 1,
      }),
    );

    const result = await client.getMyFollowing({ page: 2, limit: 10 });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(init.method).toBe('GET');
    expect(parsed.pathname).toBe('/api/v1/users/me/following');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('limit')).toBe('10');
    expect(result.data[0].username).toBe('bob');
    expect(result.pagination).toEqual({ total: 1, page: 2, limit: 10, totalPages: 1 });
  });

  it('previewFees POSTs the body to /fees/preview', async () => {
    const responseBody = {
      polymarket: { venue: 'POLYMARKET', feeBps: 200, feeUsd: 1, totalCostUsd: 51, isMaker: false },
      kalshi: null,
      savings: 0,
      recommendedVenue: 'POLYMARKET',
      marketMatch: null,
    };
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(responseBody));

    const params = {
      tokenId: 'tok-1',
      side: 'BUY' as const,
      size: 100,
      price: 0.5,
      orderType: 'POST_ONLY',
    };
    const result = await client.previewFees(params);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('POST');
    expect(url).toContain('/api/v1/fees/preview');
    expect(JSON.parse(init.body as string)).toEqual(params);
    expect(result.recommendedVenue).toBe('POLYMARKET');
  });

  it('getFeeSchedules GETs /fees/schedules and returns both venue arrays', async () => {
    const payload = {
      polymarket: [
        { category: 'Crypto', role: 'TAKER', feeBps: 200, effectiveAt: '2026-01-01T00:00:00Z' },
      ],
      kalshi: [
        {
          role: 'MAKER',
          feeBps: 100,
          minPrice: 0.01,
          maxPrice: 0.99,
          effectiveAt: '2026-01-01T00:00:00Z',
        },
      ],
    };
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(payload));

    const result = await client.getFeeSchedules();
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/api/v1/fees/schedules');
    expect(result.polymarket).toHaveLength(1);
    expect(result.kalshi).toHaveLength(1);
  });

  it('listMarketAlerts URL-encodes the marketId', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ data: [] }),
    );

    await client.listMarketAlerts('market with space');
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/api/v1/markets/market%20with%20space/alerts');
  });

  it('createMarketAlert POSTs the body to /markets/:marketId/alerts', async () => {
    const responseBody = {
      id: 'alert-1',
      marketId: 'm1',
      outcome: 'YES',
      condition: 'above',
      threshold: 0.6,
      triggered: false,
      createdAt: '2026-05-01T00:00:00Z',
    };
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(responseBody, 201));

    const params = { outcome: 'YES' as const, condition: 'above' as const, threshold: 0.6 };
    const result = await client.createMarketAlert('m1', params);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('POST');
    expect(url).toContain('/api/v1/markets/m1/alerts');
    expect(JSON.parse(init.body as string)).toEqual(params);
    expect(result.id).toBe('alert-1');
  });

  it('deleteMarketAlert URL-encodes both path params', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await client.deleteMarketAlert('m 1', 'a/1');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('DELETE');
    expect(url).toContain('/api/v1/markets/m%201/alerts/a%2F1');
  });

  it('getMarketHistory forwards the period query param when supplied', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: [
          { timestamp: '2026-05-01T00:00:00Z', yesPrice: 0.5, noPrice: 0.5, volume: 100 },
        ],
      }),
    );

    const result = await client.getMarketHistory('m1', '30d');
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/api/v1/markets/m1/history');
    expect(parsed.searchParams.get('period')).toBe('30d');
    expect(result.data).toHaveLength(1);
  });

  it('getMarketHistory omits the period query param when not supplied', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: [] }));

    await client.getMarketHistory('m1');
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.search).toBe('');
  });

  it('getMarketSentimentReport GETs /markets/:id/sentiment', async () => {
    const payload = { yesPercent: 60, noPercent: 40, totalVotes: 5, userVote: null };
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(payload));

    const result = await client.getMarketSentimentReport('m1');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('GET');
    expect(url).toContain('/api/v1/markets/m1/sentiment');
    expect(result).toEqual(payload);
  });

  it('voteMarketSentiment POSTs (no body) to /markets/:id/sentiment', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ yesPercent: 60, noPercent: 40, totalVotes: 5, userVote: null }),
    );

    const result = await client.voteMarketSentiment('m1');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('POST');
    expect(url).toContain('/api/v1/markets/m1/sentiment');
    expect(result.yesPercent).toBe(60);
  });

  it('updateOrderJournal PATCHes /orders/:id/journal with mood + note', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ id: 'o1', mood: 'CONFIDENT', note: 'High conviction' }),
    );

    const params = { mood: 'CONFIDENT' as const, note: 'High conviction' };
    await client.updateOrderJournal('o1', params);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('PATCH');
    expect(url).toContain('/api/v1/orders/o1/journal');
    expect(JSON.parse(init.body as string)).toEqual(params);
  });

  it('listComboCollections forwards seriesTicker, limit, cursor', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ collections: [], cursor: 'next' }),
    );

    await client.listComboCollections({ seriesTicker: 'KXNFL', limit: 25, cursor: 'abc' });
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/api/v1/markets/combo/collections');
    expect(parsed.searchParams.get('seriesTicker')).toBe('KXNFL');
    expect(parsed.searchParams.get('limit')).toBe('25');
    expect(parsed.searchParams.get('cursor')).toBe('abc');
  });

  it('getComboCollection URL-encodes the ticker', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        collection_ticker: 'C/1',
        title: 'Combo',
        category: 'Sports',
        status: 'open',
        markets_count: 3,
      }),
    );

    await client.getComboCollection('C/1');
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/api/v1/markets/combo/collections/C%2F1');
  });

  it('lookupComboMarket POSTs the body to /markets/combo/lookup', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ event_ticker: 'EVT-1', market_ticker: 'MKT-1' }),
    );

    const params = {
      collectionTicker: 'COMBO-A',
      legs: [
        { ticker: 'MKT-1', outcome: 'yes' as const },
        { ticker: 'MKT-2', outcome: 'no' as const },
      ],
    };
    const result: ComboMarketLookup = await client.lookupComboMarket(params);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('POST');
    expect(url).toContain('/api/v1/markets/combo/lookup');
    expect(JSON.parse(init.body as string)).toEqual(params);
    expect(result.event_ticker).toBe('EVT-1');
  });

  it('lookupComboTicker remains a deprecated alias for lookupComboMarket', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ event_ticker: 'EVT-1', market_ticker: 'MKT-1' }),
    );

    await client.lookupComboTicker({ collectionTicker: 'COMBO-A', legs: [] });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(init.method).toBe('POST');
    expect(url).toContain('/api/v1/markets/combo/lookup');
  });

  it('getCorrelationCategories GETs /analytics/correlation/categories', async () => {
    const payload = {
      categories: ['Crypto', 'Politics'],
      matrix: [
        [1, 0.4],
        [0.4, 1],
      ],
      updatedAt: '2026-05-01T00:00:00Z',
    };
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(payload));

    const result = await client.getCorrelationCategories();
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/api/v1/analytics/correlation/categories');
    expect(result.categories).toEqual(['Crypto', 'Politics']);
    expect(result.matrix[0][0]).toBe(1);
  });

  it.each<[string, (c: PolyforgeClient) => Promise<unknown>]>([
    ['getAccuracyOverview', (c) => c.getAccuracyOverview()],
    ['getFeed', (c) => c.getFeed()],
    ['listJournal', (c) => c.listJournal()],
    ['listNotifications', (c) => c.listNotifications()],
    ['getMyReferrals', (c) => c.getMyReferrals()],
    ['getMyFollowing', (c) => c.getMyFollowing()],
    ['previewFees', (c) =>
      c.previewFees({ tokenId: 't', side: 'BUY', size: 1, price: 0.5 })],
    ['getFeeSchedules', (c) => c.getFeeSchedules()],
    ['listMarketAlerts', (c) => c.listMarketAlerts('m1')],
    ['createMarketAlert', (c) =>
      c.createMarketAlert('m1', { outcome: 'YES', condition: 'above', threshold: 0.5 })],
    ['deleteMarketAlert', (c) => c.deleteMarketAlert('m1', 'a1')],
    ['getMarketHistory', (c) => c.getMarketHistory('m1')],
    ['getMarketSentimentReport', (c) => c.getMarketSentimentReport('m1')],
    ['voteMarketSentiment', (c) => c.voteMarketSentiment('m1')],
    ['updateOrderJournal', (c) => c.updateOrderJournal('o1', { mood: 'CONFIDENT' })],
    ['listComboCollections', (c) => c.listComboCollections()],
    ['getComboCollection', (c) => c.getComboCollection('ghost')],
    ['lookupComboMarket', (c) => c.lookupComboMarket({ collectionTicker: 'g', legs: [] })],
    ['lookupComboTicker', (c) => c.lookupComboTicker({ collectionTicker: 'g', legs: [] })],
    ['getCorrelationCategories', (c) => c.getCorrelationCategories()],
  ])('%s surfaces 401 UNAUTHORIZED as PolyforgeError', async (_name, call) => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ code: 'UNAUTHORIZED', message: 'Missing token' }, 401),
    );

    await expect(call(client)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });
});

// ── Cross-Venue Arb Execution / Positions / Risk (POLA-1850) ────────────────

describe('Cross-venue arb execution / positions / risk endpoints (POLA-1850)', () => {
  let client: PolyforgeClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new PolyforgeClient({ apiKey: 'test-key', apiUrl: 'https://api.polyforge.app' });
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  afterEach(() => { fetchSpy.mockRestore(); });

  // ── executeArb ─────────────────────────────────────────────────────────

  it('executeArb sends POST /api/v1/arbitrage/execute with body and returns result', async () => {
    const mockResult = {
      arbPositionId: 'pos-1',
      buyLeg: { venue: 'KALSHI', intentId: 'int-buy', tokenId: 'tok-buy', price: 0.48 },
      sellLeg: { venue: 'POLYMARKET', intentId: 'int-sell', tokenId: 'tok-sell', price: 0.55 },
      entrySpreadPct: 7,
      status: 'PENDING',
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockResult), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await client.executeArb({ matchId: 'match-1', size: 100, maxSlippagePct: 0.5 }, 'arb-key-123');

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/execute');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    expect((fetchSpy.mock.calls[0][1]!.headers as Record<string, string>)['Idempotency-Key']).toBe('arb-key-123');
    expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)).toEqual({
      matchId: 'match-1', size: 100, maxSlippagePct: 0.5,
    });
    expect(result.arbPositionId).toBe('pos-1');
    expect(result.status).toBe('PENDING');
  });

  it('executeArb rejects invalid idempotencyKey client-side without calling fetch', async () => {
    await expect(client.executeArb({ matchId: 'm', size: 1 }, 'short')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('idempotencyKey'),
    });
    await expect(client.executeArb({ matchId: 'm', size: 1 }, ' key-with-spaces ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('idempotencyKey'),
    });
    await expect(client.executeArb({ matchId: 'm', size: 1 }, `valid-key\nbad`)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('idempotencyKey'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('executeArb rejects size <= 0 client-side without calling fetch', async () => {
    await expect(client.executeArb({ matchId: 'm', size: 0 }, 'arb-key-123')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('executeArb rejects size < 1 client-side without calling fetch', async () => {
    await expect(client.executeArb({ matchId: 'm', size: 0.5 }, 'arb-key-123')).rejects.toMatchObject({
      status: 0,
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('>= 1'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('executeArb rejects size > 10000 client-side without calling fetch', async () => {
    await expect(client.executeArb({ matchId: 'm', size: 10001 }, 'arb-key-123')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('<= 10000'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('executeArb rejects maxSlippagePct out of [0, 5] client-side', async () => {
    await expect(client.executeArb({ matchId: 'm', size: 1, maxSlippagePct: -0.1 }, 'arb-key-123')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(client.executeArb({ matchId: 'm', size: 1, maxSlippagePct: 5.1 }, 'arb-key-123')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('executeArb rejects non-finite maxSlippagePct', async () => {
    await expect(client.executeArb({ matchId: 'm', size: 1, maxSlippagePct: Number.NaN }, 'arb-key-123')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('executeArb surfaces backend error code verbatim on 403 VENUES_NOT_CONNECTED', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 'VENUES_NOT_CONNECTED', message: 'Both wallets must be connected' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(client.executeArb({ matchId: 'm', size: 100 }, 'arb-key-123')).rejects.toMatchObject({
      status: 403,
      code: 'VENUES_NOT_CONNECTED',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('executeArb surfaces SPREAD_TOO_LOW on 422 without retrying', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 'SPREAD_TOO_LOW', message: 'Current spread 0.5% is below minimum 1%' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(client.executeArb({ matchId: 'm', size: 100 }, 'arb-key-123')).rejects.toMatchObject({
      status: 422,
      code: 'SPREAD_TOO_LOW',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('executeArb surfaces MATCH_NOT_FOUND on 404 without retrying', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 'MATCH_NOT_FOUND', message: 'Market match not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(client.executeArb({ matchId: 'missing', size: 100 }, 'arb-key-123')).rejects.toMatchObject({
      status: 404,
      code: 'MATCH_NOT_FOUND',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // ── listArbPositions / getArbPosition ──────────────────────────────────

  it('listArbPositions calls GET /api/v1/arbitrage/positions and returns paginated shape', async () => {
    const mockResponse = { positions: [{ id: 'p1', status: 'OPEN' }], total: 1 };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await client.listArbPositions();

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/positions');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('GET');
    expect(result.total).toBe(1);
    expect(result.positions[0]!.id).toBe('p1');
  });

  it('listArbPositions forwards status/limit/offset as query params', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ positions: [], total: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    await client.listArbPositions({ status: 'OPEN', limit: 25, offset: 50 });

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('status')).toBe('OPEN');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('offset')).toBe('50');
  });

  it('getArbPosition calls GET /api/v1/arbitrage/positions/:id and url-encodes the id', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pos/1', status: 'OPEN' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    await client.getArbPosition('pos/1');

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/positions/pos%2F1');
  });

  // ── closeArbPosition ───────────────────────────────────────────────────

  it('closeArbPosition sends POST /api/v1/arbitrage/positions/:id/close and returns CLOSING', async () => {
    const mockResponse = { status: 'CLOSING', positionId: 'pos-42' };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await client.closeArbPosition('pos-42', 'close-key-123');

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/positions/pos-42/close');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    expect((fetchSpy.mock.calls[0][1]!.headers as Record<string, string>)['Idempotency-Key']).toBe('close-key-123');
    expect(result.status).toBe('CLOSING');
    expect(result.positionId).toBe('pos-42');
  });

  it('closeArbPosition rejects invalid idempotencyKey client-side without calling fetch', async () => {
    await expect(client.closeArbPosition('pos-42', 'short')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('idempotencyKey'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('closeArbPosition surfaces ARB_POSITION_NOT_FOUND on 404 without retrying', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 'ARB_POSITION_NOT_FOUND', message: 'Arb position not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(client.closeArbPosition('missing', 'close-key-123')).rejects.toMatchObject({
      status: 404,
      code: 'ARB_POSITION_NOT_FOUND',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('closeArbPosition surfaces INVALID_STATUS on 422 without retrying', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 'INVALID_STATUS', message: 'Cannot close position in CLOSED status' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(client.closeArbPosition('pos-closed', 'close-key-123')).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_STATUS',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  // ── Risk endpoints ─────────────────────────────────────────────────────

  it('getArbRiskDashboard calls GET /api/v1/arbitrage/risk/dashboard and returns dashboard shape', async () => {
    const mockDashboard = {
      openPositions: 2,
      pendingPositions: 1,
      totalDeployed: 500,
      netExposure: { polymarket: 200, kalshi: 300 },
      totalRealizedPnl: 12.5,
      totalUnrealizedPnl: -3.25,
      avgSpreadPct: 4.5,
      positionsByStatus: { OPEN: 2, PENDING: 1 },
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockDashboard), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await client.getArbRiskDashboard();

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/risk/dashboard');
    expect(result.openPositions).toBe(2);
    expect(result.netExposure.polymarket).toBe(200);
    expect(result.positionsByStatus.OPEN).toBe(2);
  });

  it('getArbSettlementRisks calls GET /api/v1/arbitrage/risk/settlement and returns array', async () => {
    const mockRisks = [
      {
        matchId: 'match-1',
        polymarketTitle: 'BTC > 100k',
        kalshiTitle: 'BTC above 100k',
        polymarketEndDate: '2026-12-31T00:00:00Z',
        kalshiEndDate: '2026-12-31T00:00:00Z',
        endDateDiffDays: 0,
        confidence: 0.92,
        riskLevel: 'LOW',
        reason: 'Markets appear well-matched',
      },
    ];
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockRisks), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await client.getArbSettlementRisks();

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/risk/settlement');
    expect(result).toHaveLength(1);
    expect(result[0]!.riskLevel).toBe('LOW');
  });

  it('refreshArbPnl sends POST /api/v1/arbitrage/risk/refresh-pnl and returns updated count', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ updated: 3 }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await client.refreshArbPnl();

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/arbitrage/risk/refresh-pnl');
    expect(fetchSpy.mock.calls[0][1]!.method).toBe('POST');
    expect(result.updated).toBe(3);
  });
});
