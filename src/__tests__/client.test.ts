import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PolyforgeClient, isBlockedHost, validateWebhookUrl } from '../client';
import { PolyforgeError } from '../errors';
import { KNOWN_STRATEGY_EVENTS } from '../types';
import type { StrategyStatusResponse, PaginatedResponse, Strategy, OrderStatus, StrategyStatus, Order, Position, ImportStrategyParams, ClosePositionParams, RedeemPositionParams, ProvideLiquidityParams, ConditionalOrderStatus, CreateAlertParams, CreateConditionalOrderParams, ConditionalOrder, CopyConfig, Alert, CopyMode, ConditionalOrderType, OrderType, Market, Token, RunBacktestParams, CreateStrategyParams, TraderScore, TraderScoreData, TraderScoreBreakdown, WhaleTrade, NewsSignal, AiQueryResponse, SplitPositionParams, MergePositionParams, StrategyVisibility, StrategyExecMode, PortfolioPnlParams, PortfolioPnl, PriceHistoryEntry, OrderBook } from '../types';

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
        { id: 's1', name: 'Alpha', status: 'IDLE' as StrategyStatus, visibility: 'PRIVATE', execMode: 'TICK', tickMs: 1000, triggers: [], conditions: [], actions: [], safety: [], logicBlocks: [], calcBlocks: [], tags: [], variables: [], pnl: 0, tradeCount: 0, winRate: 0, createdAt: '', updatedAt: '' },
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

  it('sends { marketId, size } not { tokenId, spread, size }', async () => {
    const params: ProvideLiquidityParams = { marketId: 'mkt-1', size: 100 };
    await client.provideLiquidity(params);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ marketId: 'mkt-1', size: 100 });
    expect(body).not.toHaveProperty('tokenId');
    expect(body).not.toHaveProperty('spread');
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
    await client.createConditionalOrder(params);
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
    await client.createConditionalOrder(params);
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

describe('CopyConfig matches platform fields (#50)', () => {
  it('uses targetWallet not sourceWallet', () => {
    const config: CopyConfig = {
      id: 'cc-1',
      targetWallet: '0xabc123',
      mode: 'PERCENTAGE',
      sizeValue: '50',
      maxExposure: '1000',
      maxDailyLoss: '100',
      priceOffset: '0.01',
      enabled: true,
      createdAt: '2026-04-13T00:00:00Z',
    };
    expect(config.targetWallet).toBe('0xabc123');
    expect((config as any).sourceWallet).toBeUndefined();
    expect((config as any).label).toBeUndefined();
    expect((config as any).maxPositionSize).toBeUndefined();
    expect((config as any).totalCopiedTrades).toBeUndefined();
  });

  it('has mode, sizeValue, maxExposure, maxDailyLoss, priceOffset fields', () => {
    const config: CopyConfig = {
      id: 'cc-2',
      targetWallet: '0xdef456',
      mode: 'FIXED',
      sizeValue: '100',
      maxExposure: '5000',
      enabled: false,
      createdAt: '',
    };
    expect(config.mode).toBe('FIXED');
    expect(config.sizeValue).toBe('100');
    expect(config.maxExposure).toBe('5000');
  });

  it('CopyMode accepts all 3 platform values', () => {
    const modes: CopyMode[] = ['PERCENTAGE', 'FIXED', 'MIRROR'];
    expect(modes).toHaveLength(3);
  });

  it('allows optional fields to be omitted', () => {
    const config: CopyConfig = {
      id: 'cc-3',
      targetWallet: '0x789',
      enabled: true,
      createdAt: '',
    };
    expect(config.mode).toBeUndefined();
    expect(config.sizeValue).toBeUndefined();
    expect(config.maxExposure).toBeUndefined();
    expect(config.maxDailyLoss).toBeUndefined();
    expect(config.priceOffset).toBeUndefined();
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

describe('OrderType uses platform values GTC/GTD/FOK/FAK (#36)', () => {
  it('should accept all 4 platform order types', () => {
    const types: OrderType[] = ['GTC', 'GTD', 'FOK', 'FAK'];
    expect(types).toHaveLength(4);
  });

  it('should not accept exchange-style order types', () => {
    // Type-level check: these old values should NOT compile.
    // Runtime check ensures the type is correctly constrained.
    const validTypes = new Set<OrderType>(['GTC', 'GTD', 'FOK', 'FAK']);
    expect(validTypes.has('GTC')).toBe(true);
    expect(validTypes.has('FAK')).toBe(true);
    // Old values are no longer valid
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
  it('should return wrapped { score, breakdown } matching GET /api/v1/scores/me', () => {
    const scoreData: TraderScoreData = {
      id: 'ts-1',
      userId: 'u-1',
      score: 85,
      winRate: '0.62',
      sharpeRatio: '1.5000',
      avgReturn: '0.0800',
      totalTrades: 120,
      profitFactor: '2.1000',
      maxDrawdown: '-0.1500',
      consistency: '0.78',
      updatedAt: '2026-04-13T00:00:00Z',
    };
    const ts: TraderScore = {
      score: scoreData,
      breakdown: {
        score: 85,
        components: {
          winRate: { value: '0.62', weight: 0.25, weighted: 0.155 },
          sharpe: { value: '1.5000', weight: 0.2, weighted: 0.3 },
          profitFactor: { value: '2.1000', weight: 0.15, weighted: 0.315 },
          consistency: { value: '0.78', weight: 0.15, weighted: 0.117 },
          avgReturn: { value: '0.0800', weight: 0.1, weighted: 0.008 },
          tradeVolume: { value: 120, weight: 0.1, weighted: 12 },
          drawdown: { value: '-0.1500', weight: 0.05, weighted: -0.0075 },
        },
        totalTrades: 120,
        updatedAt: '2026-04-13T00:00:00Z',
      },
    };
    expect(ts.score?.score).toBe(85);
    expect(ts.score?.totalTrades).toBe(120);
    expect(ts.score?.avgReturn).toBe('0.0800');
    expect(ts.breakdown?.components.winRate.weight).toBe(0.25);
    // Phantom fields from old type must not exist
    expect((ts.score as any)?.rank).toBeUndefined();
  });

  it('should allow null score and breakdown for new users', () => {
    const ts: TraderScore = { score: null, breakdown: null };
    expect(ts.score).toBeNull();
    expect(ts.breakdown).toBeNull();
  });
});

describe('WhaleTrade fields match platform (#104)', () => {
  it('should use detectedAt, Decimal strings, and nested market from WhaleAlert model', () => {
    const wt: WhaleTrade = {
      id: 'wt-1',
      walletAddress: '0xabc123',
      marketId: 'mkt-1',
      tokenId: 'tok-1',
      side: 'BUY',
      outcome: 'YES',
      size: '5000.000000',
      price: '0.650000',
      notional: '3250.000000',
      txHash: '0xdeadbeef',
      detectedAt: '2026-04-13T00:00:00.000Z',
      market: { id: 'mkt-1', title: 'Test Market', slug: 'test-market', image: null },
    };
    expect(wt.walletAddress).toBe('0xabc123');
    expect(wt.detectedAt).toBeDefined();
    expect(wt.txHash).toBe('0xdeadbeef');
    expect(wt.market.title).toBe('Test Market');
    // Prisma Decimal fields serialize as strings
    expect(typeof wt.size).toBe('string');
    expect(typeof wt.notional).toBe('string');
    // Old phantom field must not exist
    expect((wt as any).timestamp).toBeUndefined();
  });
});

describe('NewsSignal fields match platform (#105)', () => {
  it('should include nested article and market objects from Prisma include', () => {
    const ns: NewsSignal = {
      id: 'ns-1',
      articleId: 'art-123',
      marketId: 'mkt-1',
      direction: 'BUY',
      outcome: 'YES',
      confidence: 90,
      reasoning: 'Strong buy signal',
      createdAt: '2026-04-13T00:00:00Z',
      article: {
        id: 'art-123',
        title: 'Breaking news',
        source: 'reuters',
        url: 'https://example.com/article',
        imageUrl: null,
        sentiment: 'POSITIVE',
        publishedAt: '2026-04-13T00:00:00Z',
      },
      market: { id: 'mkt-1', title: 'Test Market', slug: 'test-market', image: null },
    };
    expect(ns.direction).toBe('BUY');
    expect(ns.article.title).toBe('Breaking news');
    expect(ns.article.source).toBe('reuters');
    expect(ns.market.title).toBe('Test Market');
    // headline/source are on article, not on signal directly
    expect((ns as any).headline).toBeUndefined();
    expect((ns as any).source).toBeUndefined();
  });
});

describe('AiQueryResponse fields match platform (#103)', () => {
  it('should use query/intent/filters/data/summary shape', () => {
    const resp: AiQueryResponse = {
      query: 'what is BTC price?',
      intent: 'market_lookup',
      filters: { category: 'crypto' },
      data: [{ marketId: 'mkt-1', price: 0.65 }],
      summary: 'BTC market is at 0.65',
    };
    expect(resp.query).toBe('what is BTC price?');
    expect(resp.intent).toBe('market_lookup');
    expect(resp.summary).toBeDefined();
    // These fields do NOT exist in the platform response
    expect((resp as any).answer).toBeUndefined();
    expect((resp as any).confidence).toBeUndefined();
    expect((resp as any).sources).toBeUndefined();
    expect((resp as any).suggestedActions).toBeUndefined();
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
      new Response(JSON.stringify({ data: [], total: 0, page: 1, limit: 10, totalPages: 0, hasNext: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
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
  it('should use snapshots/totalPnl/winRate matching GET /api/v1/portfolio/pnl', () => {
    const pnl: PortfolioPnl = {
      snapshots: [
        { time: '2026-04-10T00:00:00.000Z', pnl: '125.50' },
        { time: '2026-04-11T00:00:00.000Z', pnl: '-30.25' },
      ],
      totalPnl: '95.25',
      winRate: '0',
    };
    expect(pnl.snapshots).toHaveLength(2);
    expect(pnl.totalPnl).toBe('95.25');
    expect(typeof pnl.totalPnl).toBe('string');
    // Phantom fields from old type must not exist
    expect((pnl as any).dailyPnl).toBeUndefined();
    expect((pnl as any).weeklyPnl).toBeUndefined();
    expect((pnl as any).monthlyPnl).toBeUndefined();
    expect((pnl as any).realizedPnl).toBeUndefined();
    expect((pnl as any).unrealizedPnl).toBeUndefined();
    expect((pnl as any).history).toBeUndefined();
  });

  it('should handle empty result', () => {
    const pnl: PortfolioPnl = { snapshots: [], totalPnl: '0.00', winRate: '0' };
    expect(pnl.snapshots).toHaveLength(0);
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

  it('getWatchlistStatus sends GET to /api/v1/watchlist/status/:marketId', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ marketId: 'mkt-1', watched: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    await client.getWatchlistStatus('mkt-1');
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/watchlist/status/mkt-1');
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

  it('getPriceHistory passes query params', async () => {
    await client.getPriceHistory('token-1', { resolution: '1d', from: '2026-01-01T00:00:00Z', to: '2026-01-31T00:00:00Z', limit: 100 });
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get('resolution')).toBe('1d');
    expect(url.searchParams.get('from')).toBe('2026-01-01T00:00:00Z');
    expect(url.searchParams.get('to')).toBe('2026-01-31T00:00:00Z');
    expect(url.searchParams.get('limit')).toBe('100');
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
});
