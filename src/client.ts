import { isIPv4, isIPv6, isIP } from 'node:net';
import { resolve4, resolve6 } from 'node:dns/promises';
import { PolyforgeError } from './errors.js';
import type {
  AccuracyScore,
  AiQueryResponse,
  Alert,
  ApiKey,
  ArbitrageOpportunity,
  BatchPlaceOrdersResult,
  BatchRequestItem,
  BatchResponse,
  BrowseMarketplaceParams,
  BulkCancelOrdersResult,
  CancelOrderResponse,
  ClosePositionParams,
  ClobBook,
  ClobPricesHistoryResult,
  CopyConfig,
  CreateApiKeyParams,
  CreateApiKeyResponse,
  CreateCopyConfigParams,
  CreateListingParams,
  CreateStrategyParams,
  DiscoverParams,
  ImportStrategyParams,
  LeaderboardParams,
  LpPosition,
  Market,
  MarketplaceListing,
  MarketplacePurchaseResult,
  MarketSearchResult,
  MarketSentiment,
  MergePositionParams,
  MidpointResult,
  NewsArticle,
  NewsSignal,
  Order,
  PaginatedResponse,
  PaperSummary,
  PlaceOrderParams,
  PlaceOrderResponse,
  PlaceSmartOrderParams,
  PlaceSmartOrderResponse,
  PolymarketActivity,
  PolymarketEarningsEntry,
  PolymarketPortfolioEntry,
  Portfolio,
  PolyforgeClientOptions,
  PortfolioReview,
  ProvideLiquidityParams,
  RateListingParams,
  RedeemPositionParams,
  RedeemPositionResponse,
  SmartOrder,
  SpreadResult,
  SplitPositionParams,
  Strategy,
  StrategyChild,
  StrategyComment,
  StrategyEvent,
  StrategyEventLogEntry,
  StrategyExport,
  StrategyLikeResult,
  StrategyReportReason,
  StrategyReportResult,
  StrategyRollbackResult,
  StrategyStatus,
  StrategyStatusResponse,
  StrategyTemplate,
  StrategyVersion,
  TickSizeResult,
  TopTraderEntry,
  TraderBadge,
  TraderScore,
  UpdateCopyConfigParams,
  UpdateListingParams,
  UpdateStrategyParams,
  WatchlistAddResult,
  WatchlistItem,
  WatchlistStatus,
  Webhook,
  WebhookEvent,
  WebhookTestResult,
  WhaleProfile,
  WhaleTrade,
  WhaleTopParams,
  OrderBook,
  PriceCandle,
  PriceHistoryParams,
  Backtest,
  ConditionalOrder,
  ConditionalOrderStatus,
  ConditionalOrderType,
  CreateAlertParams,
  CreateConditionalOrderParams,
  PortfolioPnl,
  PortfolioPnlParams,
  RunBacktestParams,
  Rebate,
  RewardsMarket,
  RiskSettings,
  UpdateRiskSettingsParams,
  UserReward,
  UserRewardsPercentages,
  UserRewardsTotal,
  CrossVenueOpportunity,
  CrossVenueComparison,
  MarketMatch,
  CreateMarketMatchParams,
  SyncMatchesResult,
  WhaleAlertFilter,
  UpsertWhaleAlertFilterParams,
  PublicProfile,
  UpdateProfileParams,
  ChangePasswordParams,
  FollowResult,
  UpdateSettingsProfileParams,
  NotificationSettings,
  UpdateNotificationSettingsParams,
  ChangePasswordSettingsParams,
  BetaUsage,
  GasUsage,
  CreateTicketParams,
  SupportTicket,
  AddTicketMessageParams,
  TicketMessage,
  EventNotificationPreferences,
  UpdateEventNotificationsParams,
  VenuePriceInfo,
  SpreadSummary,
  ArbitrageAlertSubscription,
  CreateArbitrageAlertParams,
} from './types.js';
import { KNOWN_STRATEGY_EVENTS } from './types.js';

const DEFAULT_BASE_URL = 'https://api.polyforge.app';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_STREAM_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours for long-lived SSE streams
const MAX_SSE_BUFFER_SIZE = 1_048_576; // 1 MB — prevents memory exhaustion from unbounded SSE payloads
const MAX_RESPONSE_BODY_SIZE = 10 * 1024 * 1024; // 10 MB — prevents OOM from oversized API responses

/**
 * Expand a compressed IPv6 address into its full 8-group colon-hex form.
 * E.g. "fe80::1" → "fe80:0000:0000:0000:0000:0000:0000:0001"
 */
function expandIPv6(addr: string): string {
  const halves = addr.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  const middle = Array.from({ length: missing }, () => '0000');
  const groups = [...left, ...middle, ...right];
  return groups.map((g) => g.padStart(4, '0')).join(':');
}

/**
 * Check whether a hostname or IP address points to a loopback, private,
 * link-local, CGNAT, or otherwise internal destination.  Used to prevent
 * SSRF when the caller supplies a webhook URL.
 */
export function isBlockedHost(hostname: string): boolean {
  // Strip trailing dot (DNS root label) so "localhost." is caught too.
  const host = hostname.replace(/\.+$/, '').toLowerCase();

  // Block reserved TLDs
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return true;
  }

  // Block well-known loopback names
  if (host === 'localhost') {
    return true;
  }

  // IPv4 checks
  if (isIPv4(host)) {
    const parts = host.split('.').map(Number);
    const [a, b] = parts;

    // 0.0.0.0
    if (host === '0.0.0.0') return true;
    // 127.0.0.0/8
    if (a === 127) return true;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 (CGNAT, 100.64.x.x – 100.127.x.x)
    if (a === 100 && b >= 64 && b <= 127) return true;

    return false;
  }

  // IPv6 checks — strip brackets first because URL.hostname returns
  // bracketed IPv6 (e.g. "[::1]") and net.isIPv6 requires bare addresses.
  const bareHost = host.replace(/^\[|\]$/g, '');
  if (isIPv6(bareHost)) {
    const addr = bareHost.toLowerCase();

    // ::1 (loopback)
    if (addr === '::1') return true;

    // :: (unspecified address)
    if (addr === '::') return true;

    // IPv4-mapped IPv6 — ::ffff:a.b.c.d
    const v4MappedMatch = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (v4MappedMatch) {
      return isBlockedHost(v4MappedMatch[1]);
    }

    // Expand the first 16-bit group to check prefix-based ranges.
    // Split on ':', handle '::' expansion, then inspect the first group.
    const expanded = expandIPv6(addr);
    const firstWord = parseInt(expanded.split(':')[0], 16);

    // fc00::/7 — unique local addresses (fc00::–fdff::)
    if ((firstWord & 0xfe00) === 0xfc00) return true;
    // fe80::/10 — link-local (fe80::–febf::)
    if ((firstWord & 0xffc0) === 0xfe80) return true;

    return false;
  }

  return false;
}

/**
 * Resolve a hostname to all its IPv4 and IPv6 addresses, then verify
 * that **every** resolved IP passes the SSRF blocklist.
 *
 * If the hostname is already a literal IP address, DNS resolution is
 * skipped and the literal is checked directly.
 *
 * This is a client-side best-effort check.  The server **must** perform
 * its own independent validation — DNS can change between the time this
 * check runs and the time the server delivers the webhook.
 *
 * @throws Error if the URL is non-HTTPS, points to a blocked address,
 *         or the hostname cannot be resolved.
 */
export async function validateWebhookUrl(url: string): Promise<void> {
  const parsed = new URL(url);

  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS');
  }

  const hostname = parsed.hostname;

  // Literal IP addresses skip DNS resolution entirely.
  if (isIP(hostname) !== 0) {
    if (isBlockedHost(hostname)) {
      throw new Error('Webhook URL cannot point to localhost or internal addresses');
    }
    return;
  }

  // Hostname string-level checks (reserved TLDs, "localhost", etc.)
  if (isBlockedHost(hostname)) {
    throw new Error('Webhook URL cannot point to localhost or internal addresses');
  }

  // Resolve DNS and check every returned IP.
  let ipv4s: string[] = [];
  let ipv6s: string[] = [];

  try {
    ipv4s = await resolve4(hostname);
  } catch {
    // ENODATA / ENOTFOUND — no A records, which is fine if AAAA exist.
  }

  try {
    ipv6s = await resolve6(hostname);
  } catch {
    // ENODATA / ENOTFOUND — no AAAA records.
  }

  const allIPs = [...ipv4s, ...ipv6s];

  if (allIPs.length === 0) {
    throw new Error(
      'Webhook URL hostname could not be resolved — no DNS records found',
    );
  }

  for (const ip of allIPs) {
    if (isBlockedHost(ip)) {
      throw new Error(
        `Webhook URL resolves to a blocked address (${ip})`,
      );
    }
  }
}

/**
 * Polyforge REST API client.
 *
 * @example
 * ```ts
 * const client = new PolyforgeClient({ apiKey: 'pf_live_...' });
 * const markets = await client.listMarkets({ category: 'defi', limit: 10 });
 * ```
 */
export class PolyforgeClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly streamTimeout: number;

  constructor(options: PolyforgeClientOptions) {
    if (!options.apiKey) {
      throw new Error('apiKey is required');
    }
    this.baseUrl = (options.apiUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.streamTimeout = options.streamTimeout ?? DEFAULT_STREAM_TIMEOUT_MS;

    // Reject non-HTTPS URLs for non-local hosts to prevent credential leakage.
    // Cover all loopback representations: IPv4, IPv6, and common aliases.
    const parsed = new URL(this.baseUrl);
    if (parsed.protocol !== 'https:') {
      const h = parsed.hostname;
      const isLocal =
        h === 'localhost' ||
        h === '127.0.0.1' ||
        h === '[::1]' ||
        h === '::1' ||
        h === '0.0.0.0' ||
        h.startsWith('127.') ||
        h === 'localhost.localdomain';
      if (!isLocal) {
        throw new Error('Non-localhost API URLs must use HTTPS');
      }
    }
  }

  /** Prevent API key from leaking via JSON.stringify(client). */
  toJSON(): Record<string, unknown> {
    return { baseUrl: this.baseUrl };
  }

  /** Prevent API key from leaking via util.inspect(client) or console.log(client). */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `PolyforgeClient { baseUrl: '${this.baseUrl}', apiKey: '[REDACTED]' }`;
  }

  // ── Financial parameter validation ──────────────────────────────────────

  private validateFinancialParam(name: string, value: number, allowZero = false): void {
    if (!Number.isFinite(value)) {
      throw new PolyforgeError({ status: 0, code: 'VALIDATION_ERROR', message: `${name} must be a finite number` });
    }
    if (allowZero ? value < 0 : value <= 0) {
      throw new PolyforgeError({ status: 0, code: 'VALIDATION_ERROR', message: `${name} must be ${allowZero ? 'non-negative' : 'positive'}` });
    }
  }

  // ── Internal request helper ─────────────────────────────────────────────

  /**
   * Read response body as JSON with size guard.
   * Checks Content-Length first, then enforces the same limit while reading.
   */
  private async safeJson<R>(response: Response): Promise<R> {
    return JSON.parse(await this.readResponseText(response)) as R;
  }

  private throwResponseBodyTooLarge(status: number, size: number): never {
    throw new PolyforgeError({
      status,
      code: 'RESPONSE_BODY_TOO_LARGE',
      message: `Response body too large (${size} bytes, limit ${MAX_RESPONSE_BODY_SIZE})`,
    });
  }

  private async readResponseText(response: Response): Promise<string> {
    const cl = response.headers.get('content-length');
    if (cl) {
      const size = parseInt(cl, 10);
      if (!Number.isNaN(size) && size > MAX_RESPONSE_BODY_SIZE) {
        this.throwResponseBodyTooLarge(response.status, size);
      }
    }

    if (!response.body) {
      return '';
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let body = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        size += value.byteLength;
        if (size > MAX_RESPONSE_BODY_SIZE) {
          await reader.cancel().catch(() => undefined);
          this.throwResponseBodyTooLarge(response.status, size);
        }

        body += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }

    return body + decoder.decode();
  }

  private async request<T>(
    method: string,
    path: string,
    options?: { body?: unknown; query?: Record<string, unknown> },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
    };

    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      let errorBody: { code?: string; message?: string; requestId?: string; suggestion?: string } = {};
      try {
        errorBody = await this.safeJson<typeof errorBody>(response);
      } catch (e) {
        if (e instanceof PolyforgeError) throw e; // re-throw size guard errors
        // Body may not be JSON
      }

      throw new PolyforgeError({
        status: response.status,
        code: errorBody.code ?? 'UNKNOWN_ERROR',
        message: errorBody.message ?? `Request failed with status ${response.status}`,
        requestId: errorBody.requestId ?? response.headers.get('x-request-id') ?? undefined,
        suggestion: errorBody.suggestion,
      });
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return this.safeJson<T>(response);
  }

  /**
   * Internal helper for endpoints that return non-JSON (e.g. CSV) responses.
   * Returns the raw response body as a string.
   */
  private async requestText(
    method: string,
    path: string,
    options?: { query?: Record<string, unknown> },
  ): Promise<string> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      let errorBody: { code?: string; message?: string; requestId?: string; suggestion?: string } = {};
      try {
        errorBody = await this.safeJson<typeof errorBody>(response);
      } catch (e) {
        if (e instanceof PolyforgeError) throw e; // re-throw size guard errors
        // Body may not be JSON
      }

      throw new PolyforgeError({
        status: response.status,
        code: errorBody.code ?? 'UNKNOWN_ERROR',
        message: errorBody.message ?? `Request failed with status ${response.status}`,
        requestId: errorBody.requestId ?? response.headers.get('x-request-id') ?? undefined,
        suggestion: errorBody.suggestion,
      });
    }

    return this.readResponseText(response);
  }

  // ── Markets ─────────────────────────────────────────────────────────────

  /**
   * List available markets with optional filtering and pagination.
   */
  async listMarkets(params?: {
    search?: string;
    category?: string;
    sort?: 'volume' | 'endDate' | 'firstSeenAt' | 'newest' | 'closing_soon' | 'liquidity';
    closed?: boolean;
    limit?: number;
    page?: number;
  }): Promise<PaginatedResponse<Market>> {
    return this.request('GET', '/api/v1/markets', { query: params as Record<string, unknown> });
  }

  /**
   * Get a single market by ID.
   */
  async getMarket(id: string): Promise<Market> {
    return this.request('GET', `/api/v1/markets/${encodeURIComponent(id)}`);
  }

  /**
   * Get price history for a market token.
   */
  async getPriceHistory(tokenId: string, params?: PriceHistoryParams): Promise<PriceCandle[]> {
    return this.request('GET', `/api/v1/markets/${encodeURIComponent(tokenId)}/price-history`, {
      query: params as Record<string, unknown>,
    });
  }

  /**
   * Get the order book for a market token.
   */
  async getOrderBook(tokenId: string): Promise<OrderBook> {
    return this.request('GET', `/api/v1/markets/${encodeURIComponent(tokenId)}/book`);
  }

  /**
   * Full-text search for markets by keyword.
   */
  async searchMarkets(q: string, limit?: number): Promise<MarketSearchResult> {
    return this.request('GET', '/api/v1/markets/search', {
      query: { q, ...(limit !== undefined && { limit }) },
    });
  }

  /**
   * Get the minimum price increment (tick size) and fee rate for a market token.
   */
  async getTickSize(tokenId: string): Promise<TickSizeResult> {
    return this.request('GET', `/api/v1/markets/${encodeURIComponent(tokenId)}/tick-size`);
  }

  /**
   * Get the bid-ask spread for a market token.
   */
  async getSpread(tokenId: string): Promise<SpreadResult> {
    return this.request('GET', `/api/v1/markets/${encodeURIComponent(tokenId)}/spread`);
  }

  /**
   * Get the mid-price for a market token.
   */
  async getMidpoint(tokenId: string): Promise<MidpointResult> {
    return this.request('GET', `/api/v1/markets/${encodeURIComponent(tokenId)}/midpoint`);
  }

  /**
   * Get the CLOB order book for a market token (richer than the standard order book).
   */
  async getClobBook(tokenId: string): Promise<ClobBook> {
    return this.request('GET', `/api/v1/markets/${encodeURIComponent(tokenId)}/clob-book`);
  }

  /**
   * Get CLOB price history for a market token.
   */
  async getClobPricesHistory(
    tokenId: string,
    params?: { interval?: '1m' | '5m' | '1h' | '4h' | '1d' | '1w' | 'max'; fidelity?: number },
  ): Promise<ClobPricesHistoryResult> {
    return this.request('GET', `/api/v1/markets/${encodeURIComponent(tokenId)}/clob-prices-history`, {
      query: params as Record<string, unknown>,
    });
  }

  // ── Strategies ──────────────────────────────────────────────────────────

  /**
   * List strategies owned by the authenticated user.
   */
  async listStrategies(params?: {
    status?: StrategyStatus;
    sort?: 'newest' | 'oldest' | 'name' | 'pnl';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Strategy>> {
    return this.request('GET', '/api/v1/strategies', { query: params as Record<string, unknown> });
  }

  /**
   * Get a single strategy by ID.
   */
  async getStrategy(id: string): Promise<Strategy> {
    return this.request('GET', `/api/v1/strategies/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new strategy with optional block configuration, execution settings, and visibility.
   */
  async createStrategy(params: CreateStrategyParams): Promise<Strategy> {
    return this.request('POST', '/api/v1/strategies', { body: params });
  }

  /**
   * Generate a strategy from a natural-language description using AI.
   */
  async createStrategyFromDescription(params: {
    description: string;
    marketId?: string;
  }): Promise<Strategy> {
    return this.request('POST', '/api/v1/strategies/from-description', {
      body: { description: params.description, ...(params.marketId !== undefined && { marketId: params.marketId }) },
    });
  }

  /**
   * Start a strategy. Defaults to paper mode (paperMode: true) for safety.
   */
  async startStrategy(
    id: string,
    options: { paperMode?: boolean; deploymentMode?: 'LIVE' | 'SIMULATION' } = { paperMode: true },
  ): Promise<StrategyStatusResponse> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/start`, {
      body: options,
    });
  }

  /**
   * Stop a running strategy.
   */
  async stopStrategy(id: string): Promise<StrategyStatusResponse> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/stop`);
  }

  /**
   * List available strategy templates.
   */
  async getStrategyTemplates(): Promise<PaginatedResponse<StrategyTemplate>> {
    return this.request('GET', '/api/v1/strategies/templates');
  }

  /**
   * Export a strategy as a portable JSON object.
   */
  async exportStrategy(id: string): Promise<StrategyExport> {
    return this.request('GET', `/api/v1/strategies/${encodeURIComponent(id)}/export`);
  }

  /**
   * Update a strategy's name, description, or block configuration.
   */
  async updateStrategy(id: string, params: UpdateStrategyParams): Promise<Strategy> {
    return this.request('PATCH', `/api/v1/strategies/${encodeURIComponent(id)}`, { body: params });
  }

  /**
   * Delete a strategy by ID.
   */
  async deleteStrategy(id: string): Promise<void> {
    return this.request('DELETE', `/api/v1/strategies/${encodeURIComponent(id)}`);
  }

  /**
   * Import a strategy from a .polyforge JSON export.
   */
  async importStrategy(params: ImportStrategyParams): Promise<Strategy> {
    return this.request('POST', '/api/v1/strategies/import', { body: params });
  }

  /**
   * Pause a running strategy.
   */
  async pauseStrategy(id: string): Promise<StrategyStatusResponse> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/pause`);
  }

  /**
   * Resume a paused strategy.
   */
  async resumeStrategy(id: string): Promise<StrategyStatusResponse> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/resume`);
  }

  /**
   * Fork a strategy to create a new editable copy.
   */
  async forkStrategy(id: string): Promise<Strategy> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/fork`);
  }

  // ── Portfolio & Orders ──────────────────────────────────────────────────

  /**
   * Get the authenticated user's portfolio summary.
   */
  async getPortfolio(): Promise<Portfolio> {
    return this.request('GET', '/api/v1/portfolio');
  }

  /** Get portfolio profit-and-loss breakdown with history. */
  async getPortfolioPnl(params?: PortfolioPnlParams): Promise<PortfolioPnl> {
    return this.request('GET', '/api/v1/portfolio/pnl', { query: params as Record<string, unknown> });
  }

  /**
   * Get raw Polymarket portfolio view (requires connected Polymarket wallet).
   */
  async getPolymarketPortfolio(): Promise<{ entries: PolymarketPortfolioEntry[] }> {
    return this.request('GET', '/api/v1/portfolio/polymarket/portfolio');
  }

  /**
   * Get raw Polymarket earnings data (requires connected Polymarket wallet).
   */
  async getPolymarketEarnings(): Promise<{ entries: PolymarketEarningsEntry[] }> {
    return this.request('GET', '/api/v1/portfolio/polymarket/earnings');
  }

  /**
   * Get Polymarket activity feed, filterable by type (requires connected Polymarket wallet).
   */
  async getPolymarketActivity(type?: string): Promise<{ activities: PolymarketActivity[] }> {
    return this.request('GET', '/api/v1/portfolio/polymarket/activity', {
      query: type !== undefined ? { type } : undefined,
    });
  }

  /**
   * List orders with optional filters.
   */
  async getOrders(params?: {
    limit?: number;
    page?: number;
    status?: string;
    strategyId?: string;
    marketId?: string;
    from?: string;
    to?: string;
  }): Promise<PaginatedResponse<Order>> {
    return this.request('GET', '/api/v1/orders', { query: params as Record<string, unknown> });
  }

  /**
   * Get the authenticated user's trader score.
   */
  async getScore(): Promise<TraderScore> {
    return this.request('GET', '/api/v1/scores/me');
  }

  /**
   * Get the top-trader leaderboard ranked by score.
   */
  async getTopScores(): Promise<TopTraderEntry[]> {
    return this.request('GET', '/api/v1/scores/top');
  }

  /**
   * Get the authenticated user's earned badges.
   */
  async getMyBadges(): Promise<TraderBadge[]> {
    return this.request('GET', '/api/v1/scores/me/badges');
  }

  /**
   * Get another user's public trader score by user ID.
   */
  async getUserScore(userId: string): Promise<TraderScore> {
    return this.request('GET', `/api/v1/scores/${encodeURIComponent(userId)}`);
  }

  /**
   * Get another user's earned badges by user ID.
   */
  async getUserBadges(userId: string): Promise<TraderBadge[]> {
    return this.request('GET', `/api/v1/scores/${encodeURIComponent(userId)}/badges`);
  }

  // ── CSV Exports ─────────────────────────────────────────────────────────

  /**
   * Export all orders as a CSV file. Returns the raw CSV string.
   */
  async exportOrdersCsv(): Promise<string> {
    return this.requestText('GET', '/api/v1/orders/export/csv');
  }

  /**
   * Export portfolio positions as a CSV file. Returns the raw CSV string.
   */
  async exportPortfolioCsv(): Promise<string> {
    return this.requestText('GET', '/api/v1/portfolio/export/csv');
  }

  // ── Social & Signals ────────────────────────────────────────────────────

  // ── Strategy Social ─────────────────────────────────────────────────────

  /**
   * Like or unlike a strategy (toggle). Returns the new like state and count.
   */
  async likeStrategy(id: string): Promise<StrategyLikeResult> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/like`);
  }

  /**
   * List comments on a strategy with optional pagination.
   */
  async listStrategyComments(id: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<StrategyComment>> {
    return this.request('GET', `/api/v1/strategies/${encodeURIComponent(id)}/comments`, {
      query: params as Record<string, unknown>,
    });
  }

  /**
   * Add a comment to a strategy.
   */
  async addStrategyComment(id: string, content: string): Promise<StrategyComment> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/comments`, {
      body: { content },
    });
  }

  /**
   * Delete a comment on a strategy (must be the comment author).
   */
  async deleteStrategyComment(strategyId: string, commentId: string): Promise<void> {
    return this.request('DELETE', `/api/v1/strategies/${encodeURIComponent(strategyId)}/comments/${encodeURIComponent(commentId)}`);
  }

  /**
   * List child strategies (forks) of a strategy.
   */
  async listStrategyChildren(id: string): Promise<{ children: StrategyChild[] }> {
    return this.request('GET', `/api/v1/strategies/${encodeURIComponent(id)}/children`);
  }

  /**
   * Report a strategy for violating guidelines.
   */
  async reportStrategy(id: string, reason: StrategyReportReason, description?: string): Promise<StrategyReportResult> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/report`, {
      body: { reason, ...(description !== undefined && { description }) },
    });
  }

  // ── Strategy Versioning ────────────────────────────────────────────────

  /**
   * List all versions of a strategy.
   */
  async listStrategyVersions(id: string): Promise<StrategyVersion[]> {
    return this.request('GET', `/api/v1/strategies/${encodeURIComponent(id)}/versions`);
  }

  /**
   * Rollback a strategy to a previous version.
   */
  async rollbackStrategy(id: string, versionId: string): Promise<StrategyRollbackResult> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/rollback`);
  }

  // ── Strategy Event Log ─────────────────────────────────────────────────

  /**
   * Get the event log for a strategy with optional limit.
   */
  async getStrategyEventLog(id: string, params?: { limit?: number }): Promise<StrategyEventLogEntry[]> {
    return this.request('GET', `/api/v1/strategies/${encodeURIComponent(id)}/event-log`, {
      query: params as Record<string, unknown>,
    });
  }

  // ── Social & Signals ──────────────────────────────────────────────────

  // -- Backtests --

  /** List backtests with optional filtering and pagination. */
  async listBacktests(params?: {
    strategyId?: string;
    status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Backtest>> {
    return this.request('GET', '/api/v1/backtests', { query: params as Record<string, unknown> });
  }

  /** Get a single backtest by ID. */
  async getBacktest(id: string): Promise<Backtest> {
    return this.request('GET', `/api/v1/backtests/${encodeURIComponent(id)}`);
  }

  /** Run a new backtest. */
  async runBacktest(params: RunBacktestParams): Promise<Backtest> {
    return this.request('POST', '/api/v1/backtests', { body: params });
  }

  /** Run a quick (synchronous) backtest that returns results immediately. */
  async runQuickBacktest(params: RunBacktestParams): Promise<Backtest> {
    return this.request('POST', '/api/v1/backtests/quick', { body: params });
  }

  /** Get orders generated during a backtest. */
  async getBacktestOrders(id: string): Promise<Order[]> {
    return this.request('GET', `/api/v1/backtests/${encodeURIComponent(id)}/orders`);
  }

  // -- Conditional Orders --

  /** List conditional orders with optional filtering and pagination. */
  async listConditionalOrders(params?: {
    status?: ConditionalOrderStatus;
    type?: ConditionalOrderType;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ConditionalOrder>> {
    return this.request('GET', '/api/v1/orders/conditional', { query: params as Record<string, unknown> });
  }

  /** Create a conditional order. */
  async createConditionalOrder(params: CreateConditionalOrderParams): Promise<ConditionalOrder> {
    return this.request('POST', '/api/v1/orders/conditional', { body: params });
  }

  /** Get a single conditional order by ID. */
  async getConditionalOrder(id: string): Promise<ConditionalOrder> {
    return this.request('GET', `/api/v1/orders/conditional/${encodeURIComponent(id)}`);
  }

  /** Cancel a conditional order by ID. */
  async cancelConditionalOrder(id: string): Promise<void> {
    return this.request('DELETE', `/api/v1/orders/conditional/${encodeURIComponent(id)}`);
  }

  // ── Whales ────────────────────────────────────────────────────────────────

  /** Get the whale-trade feed. */
  async getWhaleFeed(params?: {
    minSize?: number;
    marketId?: string;
    walletAddress?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<WhaleTrade>> {
    return this.request('GET', '/api/v1/whales/feed', { query: params as Record<string, unknown> });
  }

  /** Get top whale wallets ranked by volume, PnL, win rate, or trade count. */
  async getTopWhales(params?: WhaleTopParams): Promise<WhaleProfile[]> {
    return this.request('GET', '/api/v1/whales/top', { query: params as Record<string, unknown> });
  }

  /** Get the full profile of a specific whale wallet address. */
  async getWhaleProfile(address: string): Promise<WhaleProfile> {
    return this.request('GET', `/api/v1/whales/${encodeURIComponent(address)}`);
  }

  /** Follow a whale wallet. */
  async followWhale(address: string): Promise<{ following: boolean }> {
    return this.request('POST', `/api/v1/whales/${encodeURIComponent(address)}/follow`);
  }

  /** Unfollow a whale wallet. */
  async unfollowWhale(address: string): Promise<{ following: boolean }> {
    return this.request('POST', `/api/v1/whales/${encodeURIComponent(address)}/unfollow`);
  }

  /** List whale wallets you are currently following. */
  async getFollowingWhales(): Promise<WhaleProfile[]> {
    return this.request('GET', '/api/v1/whales/following');
  }

  /** Get the smart-money leaderboard ranked by realized P&L. */
  async getWhaleLeaderboard(params?: { period?: '24h' | '7d' | '30d' | 'all'; limit?: number }): Promise<WhaleProfile[]> {
    return this.request('GET', '/api/v1/whales/leaderboard', { query: params as Record<string, unknown> });
  }

  /** Get your current whale alert filter settings. */
  async getWhaleAlertFilter(): Promise<WhaleAlertFilter> {
    return this.request('GET', '/api/v1/whales/alerts/filter');
  }

  /** Create or update your whale alert filter. */
  async upsertWhaleAlertFilter(params: UpsertWhaleAlertFilterParams): Promise<WhaleAlertFilter> {
    return this.request('PUT', '/api/v1/whales/alerts/filter', { body: params });
  }

  /** Delete your whale alert filter. */
  async deleteWhaleAlertFilter(): Promise<void> {
    return this.request('DELETE', '/api/v1/whales/alerts/filter');
  }

  /**
   * Get AI-generated news signals.
   */
  async getNewsSignals(params?: {
    minConfidence?: number;
    marketId?: string;
    direction?: 'BUY' | 'SELL';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<NewsSignal>> {
    return this.request('GET', '/api/v1/news/signals', { query: params as Record<string, unknown> });
  }

  /**
   * List news articles with optional source and sentiment filters.
   */
  async listNews(params?: {
    source?: string;
    sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<NewsArticle>> {
    return this.request('GET', '/api/v1/news', { query: params as Record<string, unknown> });
  }

  /**
   * Get a single news article by ID.
   */
  async getNewsArticle(id: string): Promise<NewsArticle> {
    return this.request('GET', `/api/v1/news/${encodeURIComponent(id)}`);
  }

  // ── Discover & Leaderboard ───────────────────────────────────────────────

  /** Discover public strategies filtered by sort, category, or search term. */
  async discoverStrategies(
    params?: DiscoverParams,
  ): Promise<PaginatedResponse<Strategy>> {
    return this.request('GET', '/api/v1/discover', { query: params as Record<string, unknown> });
  }

  /** Get the trader leaderboard ranked by realized P&L over a time period. */
  async getLeaderboard(
    params?: LeaderboardParams,
  ): Promise<PaginatedResponse<{ userId: string; pnl: number; rank: number }>> {
    return this.request('GET', '/api/v1/leaderboard', { query: params as Record<string, unknown> });
  }

  // ── Paper trading ─────────────────────────────────────────────────────────

  /** Get a summary of the authenticated user's paper trading account. */
  async getPaperSummary(): Promise<PaperSummary> {
    return this.request('GET', '/api/v1/paper/summary');
  }

  /** Reset the paper trading account to its initial balance. */
  async resetPaperAccount(): Promise<{ reset: boolean; newBalance: number }> {
    return this.request('POST', '/api/v1/paper/reset');
  }

  // ── Batch API ─────────────────────────────────────────────────────────────

  /**
   * Execute multiple API requests in a single round-trip.
   * Results are returned in the same order as `items`.
   */
  async batchRequests(items: BatchRequestItem[]): Promise<BatchResponse> {
    return this.request('POST', '/api/v1/batch', { body: { items } });
  }

  // ── API Keys ────────────────────────────────────────────────────────────

  /**
   * List all API keys for the authenticated user.
   * The raw token is never returned — only the prefix is available for identification.
   */
  async listApiKeys(): Promise<ApiKey[]> {
    return this.request('GET', '/api/v1/api-keys');
  }

  /**
   * Create a new API key. The raw `token` is returned only once in the response
   * and cannot be retrieved later — store it securely.
   */
  async createApiKey(params: CreateApiKeyParams): Promise<CreateApiKeyResponse> {
    return this.request('POST', '/api/v1/api-keys', { body: params });
  }

  /**
   * Revoke an API key by ID. The key is permanently deactivated.
   */
  async revokeApiKey(id: string): Promise<void> {
    return this.request('DELETE', `/api/v1/api-keys/${encodeURIComponent(id)}`);
  }

  // ── Configuration ───────────────────────────────────────────────────────

  /**
   * List configured alerts.
   */
  async listAlerts(): Promise<PaginatedResponse<Alert>> {
    return this.request('GET', '/api/v1/alerts');
  }

  /** Create a new alert. */
  async createAlert(params: CreateAlertParams): Promise<Alert> {
    return this.request('POST', '/api/v1/alerts', { body: params });
  }

  /** Delete an alert by ID. */
  async deleteAlert(id: string): Promise<void> {
    return this.request('DELETE', `/api/v1/alerts/${encodeURIComponent(id)}`);
  }

  // ── Copy trading ─────────────────────────────────────────────────────────

  /** List copy-trading configurations. */
  async listCopyConfigs(): Promise<PaginatedResponse<CopyConfig>> {
    return this.request('GET', '/api/v1/copy');
  }

  /** Create a new copy-trading configuration. */
  async createCopyConfig(params: CreateCopyConfigParams): Promise<CopyConfig> {
    return this.request('POST', '/api/v1/copy', { body: params });
  }

  /** Get a single copy-trading configuration by ID. */
  async getCopyConfig(id: string): Promise<CopyConfig> {
    return this.request('GET', `/api/v1/copy/${encodeURIComponent(id)}`);
  }

  /** Update a copy-trading configuration. */
  async updateCopyConfig(id: string, params: UpdateCopyConfigParams): Promise<CopyConfig> {
    return this.request('PATCH', `/api/v1/copy/${encodeURIComponent(id)}`, { body: params });
  }

  /** Pause a copy-trading configuration (stops mirroring trades). */
  async pauseCopyConfig(id: string): Promise<CopyConfig> {
    return this.request('POST', `/api/v1/copy/${encodeURIComponent(id)}/pause`);
  }

  /** Resume a paused copy-trading configuration. */
  async resumeCopyConfig(id: string): Promise<CopyConfig> {
    return this.request('POST', `/api/v1/copy/${encodeURIComponent(id)}/resume`);
  }

  /** Delete (stop) a copy-trading configuration. */
  async deleteCopyConfig(id: string): Promise<{ deleted: boolean }> {
    return this.request('DELETE', `/api/v1/copy/${encodeURIComponent(id)}`);
  }

  /** Get trades executed by a copy-trading configuration. */
  async getCopyTrades(
    id: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<Order>> {
    return this.request('GET', `/api/v1/copy/${encodeURIComponent(id)}/trades`, {
      query: params as Record<string, unknown>,
    });
  }

  /**
   * List registered webhooks.
   */
  async listWebhooks(): Promise<PaginatedResponse<Webhook>> {
    return this.request('GET', '/api/v1/webhooks');
  }

  /**
   * Register a new webhook.
   */
  async createWebhook(params: { url: string; events: WebhookEvent[] }): Promise<Webhook> {
    // Validate webhook URL to prevent SSRF attacks.
    // Resolves DNS to detect rebinding — see validateWebhookUrl() JSDoc.
    await validateWebhookUrl(params.url);
    return this.request('POST', '/api/v1/webhooks', { body: params });
  }

  /**
   * Delete a webhook by ID.
   */
  async deleteWebhook(id: string): Promise<void> {
    return this.request('DELETE', `/api/v1/webhooks/${encodeURIComponent(id)}`);
  }

  /**
   * Send a test delivery to a webhook and return the result.
   */
  async testWebhook(id: string): Promise<WebhookTestResult> {
    return this.request('POST', `/api/v1/webhooks/${encodeURIComponent(id)}/test`);
  }

  // ── Watchlist ──────────────────────────────────────────────────────────────

  /**
   * List all markets on the authenticated user's watchlist.
   */
  async getWatchlist(): Promise<WatchlistItem[]> {
    return this.request('GET', '/api/v1/watchlist');
  }

  /**
   * Add a market to the watchlist.
   */
  async addToWatchlist(marketId: string): Promise<WatchlistAddResult> {
    return this.request('POST', '/api/v1/watchlist', { body: { marketId } });
  }

  /**
   * Remove a market from the watchlist.
   */
  async removeFromWatchlist(marketId: string): Promise<void> {
    return this.request('DELETE', `/api/v1/watchlist/${encodeURIComponent(marketId)}`);
  }

  /**
   * Check whether a specific market is on the watchlist.
   */
  async getWatchlistStatus(marketId: string): Promise<WatchlistStatus> {
    return this.request('GET', `/api/v1/watchlist/${encodeURIComponent(marketId)}/status`);
  }

  // ── AI ──────────────────────────────────────────────────────────────────

  /**
   * Ask the Polyforge AI assistant a natural-language question.
   */
  async aiQuery(query: string): Promise<AiQueryResponse> {
    return this.request('POST', '/api/v1/ai/query', { body: { query } });
  }

  // ── Direct Trading ────────────────────────────────────────────────────────

  /**
   * Place a direct buy or sell order on a prediction market.
   */
  async placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResponse> {
    this.validateFinancialParam('size', params.size);
    this.validateFinancialParam('price', params.price);
    return this.request<PlaceOrderResponse>('POST', '/api/v1/orders/place', { body: params });
  }

  /**
   * Cancel a pending or live order.
   */
  async cancelOrder(orderId: string): Promise<CancelOrderResponse> {
    return this.request<CancelOrderResponse>('DELETE', `/api/v1/orders/${encodeURIComponent(orderId)}`);
  }

  /**
   * Place multiple orders in a single request (1–15 orders).
   */
  async placeBatchOrders(orders: PlaceOrderParams[]): Promise<BatchPlaceOrdersResult> {
    return this.request('POST', '/api/v1/orders/batch', { body: { orders } });
  }

  /**
   * Cancel multiple orders by ID in a single request (1–3000 order IDs).
   */
  async cancelOrdersBulk(orderIds: string[]): Promise<BulkCancelOrdersResult> {
    return this.request('DELETE', '/api/v1/orders/bulk', { body: { orderIds } });
  }

  /**
   * Close an open position (sell all shares at market price).
   */
  async closePosition(params: ClosePositionParams): Promise<PlaceOrderResponse> {
    return this.request('POST', '/api/v1/orders/close-position', { body: params });
  }

  /**
   * Redeem winning shares after a market resolves.
   */
  async redeemPosition(params: RedeemPositionParams): Promise<RedeemPositionResponse> {
    return this.request<RedeemPositionResponse>('POST', '/api/v1/orders/redeem', { body: params });
  }

  /**
   * Split a position into smaller positions.
   */
  async splitPosition(params: SplitPositionParams): Promise<PlaceOrderResponse> {
    return this.request('POST', '/api/v1/orders/split', { body: params });
  }

  /**
   * Merge multiple positions into one.
   */
  async mergePosition(params: MergePositionParams): Promise<PlaceOrderResponse> {
    return this.request('POST', '/api/v1/orders/merge', { body: params });
  }

  // ── Arbitrage ────────────────────────────────────────────────────────────

  /**
   * Scan all active markets for merge arbitrage opportunities (YES + NO < $1.00).
   */
  async getArbitrageOpportunities(minMargin?: number): Promise<ArbitrageOpportunity[]> {
    return this.request('GET', '/api/v1/arbitrage', {
      query: minMargin !== undefined ? { minMargin } : undefined,
    });
  }

  /** List cross-venue arbitrage opportunities between Polymarket and Kalshi. */
  async getCrossVenueOpportunities(minSpread?: number): Promise<CrossVenueOpportunity[]> {
    return this.request('GET', '/api/v1/arbitrage/cross-venue', {
      query: minSpread !== undefined ? { minSpread } : undefined,
    });
  }

  /** Get detailed price comparison for a matched market pair. */
  async getCrossVenueComparison(matchId: string): Promise<CrossVenueComparison> {
    return this.request('GET', `/api/v1/arbitrage/cross-venue/${encodeURIComponent(matchId)}/comparison`);
  }

  /** List matched markets across venues. */
  async listMarketMatches(params?: { verified?: boolean; limit?: number; offset?: number }): Promise<MarketMatch[]> {
    return this.request('GET', '/api/v1/arbitrage/matches', { query: params as Record<string, unknown> });
  }

  /** Get all matches for a specific market (either venue). */
  async getMatchesByMarket(marketId: string): Promise<MarketMatch[]> {
    return this.request('GET', `/api/v1/arbitrage/matches/market/${encodeURIComponent(marketId)}`);
  }

  /** Manually match two markets across venues. */
  async createMarketMatch(params: CreateMarketMatchParams): Promise<MarketMatch> {
    return this.request('POST', '/api/v1/arbitrage/matches', { body: params });
  }

  /** Verify/confirm an auto-matched market pair. */
  async verifyMarketMatch(matchId: string): Promise<MarketMatch> {
    return this.request('POST', `/api/v1/arbitrage/matches/${encodeURIComponent(matchId)}/verify`);
  }

  /** Remove a market match (unmatch). */
  async deleteMarketMatch(matchId: string): Promise<void> {
    return this.request('DELETE', `/api/v1/arbitrage/matches/${encodeURIComponent(matchId)}`);
  }

  /** Trigger a manual cross-venue matching pass. */
  async syncMarketMatches(): Promise<SyncMatchesResult> {
    return this.request('POST', '/api/v1/arbitrage/matches/sync');
  }

  /** Get a single market match by ID. */
  async getMarketMatch(matchId: string): Promise<MarketMatch> {
    return this.request('GET', `/api/v1/arbitrage/matches/${encodeURIComponent(matchId)}`);
  }

  /** Cross-venue arbitrage opportunities for a specific market. */
  async getCrossVenueOpportunitiesForMarket(marketId: string, minSpread?: number): Promise<CrossVenueOpportunity[]> {
    return this.request('GET', `/api/v1/arbitrage/cross-venue/${encodeURIComponent(marketId)}`, {
      query: minSpread !== undefined ? { minSpread } : undefined,
    });
  }

  /** Get bid/ask spread comparison across all matched venues. */
  async getSpreadComparison(): Promise<SpreadSummary[]> {
    return this.request('GET', '/api/v1/arbitrage/spread');
  }

  /** Get historical arbitrage opportunity snapshots. */
  async getArbitrageHistory(params?: { matchId?: string; limit?: number; offset?: number }): Promise<unknown> {
    return this.request('GET', '/api/v1/arbitrage/history', { query: params as Record<string, unknown> });
  }

  /** List user's active arbitrage alert subscriptions. */
  async getArbitrageAlerts(): Promise<ArbitrageAlertSubscription[]> {
    return this.request('GET', '/api/v1/arbitrage/alerts');
  }

  /** Create an arbitrage alert subscription. */
  async createArbitrageAlert(params: CreateArbitrageAlertParams): Promise<ArbitrageAlertSubscription> {
    return this.request('POST', '/api/v1/arbitrage/alerts', { body: params });
  }

  /** Deactivate an arbitrage alert subscription. */
  async deleteArbitrageAlert(alertId: string): Promise<void> {
    return this.request('DELETE', `/api/v1/arbitrage/alerts/${encodeURIComponent(alertId)}`);
  }

  // ── Smart Orders ─────────────────────────────────────────────────────────

  /**
   * Place an advanced smart order (TWAP, DCA, BRACKET, or OCO).
   */
  async placeSmartOrder(params: PlaceSmartOrderParams): Promise<PlaceSmartOrderResponse> {
    this.validateFinancialParam('totalSize', params.totalSize);
    return this.request('POST', '/api/v1/orders/smart', { body: params });
  }

  /**
   * List your smart orders with child order progress.
   */
  async listSmartOrders(): Promise<PaginatedResponse<SmartOrder>> {
    return this.request('GET', '/api/v1/orders/smart');
  }

  /**
   * Cancel a pending or active smart order and its child orders.
   */
  async cancelSmartOrder(id: string): Promise<{ cancelled: boolean }> {
    return this.request('DELETE', `/api/v1/orders/smart/${encodeURIComponent(id)}`);
  }

  // ── Marketplace ──────────────────────────────────────────────────────────

  /**
   * Browse marketplace listings with optional sort and tag filter.
   */
  async browseMarketplace(
    params?: BrowseMarketplaceParams,
  ): Promise<{ items: MarketplaceListing[]; total: number; limit: number; offset: number }> {
    return this.request('GET', '/api/v1/marketplace', {
      query: params as Record<string, unknown>,
    });
  }

  /**
   * Get a single marketplace listing by ID.
   */
  async getMarketplaceListing(id: string): Promise<MarketplaceListing> {
    return this.request('GET', `/api/v1/marketplace/${encodeURIComponent(id)}`);
  }

  /**
   * Purchase a marketplace strategy. Receive a private fork in your account.
   */
  async purchaseStrategy(listingId: string): Promise<MarketplacePurchaseResult> {
    return this.request('POST', `/api/v1/marketplace/${encodeURIComponent(listingId)}/purchase`);
  }

  /** Rate a purchased marketplace strategy (1–5 stars). */
  async rateListing(id: string, params: RateListingParams): Promise<void> {
    return this.request('POST', `/api/v1/marketplace/${encodeURIComponent(id)}/rate`, { body: params });
  }

  // ── Marketplace seller ────────────────────────────────────────────────────

  /** List your own marketplace listings (sell-side). */
  async getMyListings(): Promise<MarketplaceListing[]> {
    return this.request('GET', '/api/v1/marketplace/my/listings');
  }

  /** List strategies you have purchased from the marketplace. */
  async getMyPurchases(): Promise<MarketplacePurchaseResult[]> {
    return this.request('GET', '/api/v1/marketplace/my/purchases');
  }

  /** Create a new marketplace listing for one of your strategies. */
  async createListing(params: CreateListingParams): Promise<MarketplaceListing> {
    return this.request('POST', '/api/v1/marketplace', { body: params });
  }

  /** Update an existing marketplace listing (title, description, price, status, tags). */
  async updateListing(id: string, params: UpdateListingParams): Promise<MarketplaceListing> {
    return this.request('PATCH', `/api/v1/marketplace/${encodeURIComponent(id)}`, { body: params });
  }

  // ── Accuracy & Portfolio Review ──────────────────────────────────────────

  /**
   * Get prediction accuracy and calibration score for the authenticated user.
   */
  async getAccuracy(): Promise<AccuracyScore> {
    return this.request('GET', '/api/v1/accuracy/me');
  }

  /**
   * Get AI-generated portfolio review and optimization suggestions.
   */
  async getPortfolioReview(): Promise<PortfolioReview> {
    return this.request('GET', '/api/v1/ai/portfolio-review');
  }

  /**
   * Get aggregated news sentiment for a specific market.
   */
  async getMarketSentiment(marketId: string): Promise<MarketSentiment> {
    return this.request('GET', `/api/v1/news/sentiment/${encodeURIComponent(marketId)}`);
  }

  // ── Risk Settings ────────────────────────────────────────────────────────

  /**
   * Get the current risk / circuit-breaker settings for the authenticated user.
   */
  async getRiskSettings(): Promise<RiskSettings> {
    return this.request('GET', '/api/v1/settings/risk');
  }

  /**
   * Update risk settings. Only the supplied fields are changed.
   */
  async updateRiskSettings(params: UpdateRiskSettingsParams): Promise<RiskSettings> {
    return this.request('PATCH', '/api/v1/settings/risk', { body: params });
  }

  /**
   * Reset the circuit breaker after it has been tripped. Returns the updated
   * risk settings with `circuitBreakerTripped: false`.
   */
  async resetCircuitBreaker(): Promise<RiskSettings> {
    return this.request('POST', '/api/v1/settings/risk/reset');
  }

  /**
   * Provide liquidity by placing two-sided quotes on a market token.
   */
  async provideLiquidity(params: ProvideLiquidityParams): Promise<LpPosition> {
    this.validateFinancialParam('amountUsdc', params.amountUsdc);
    return this.request('POST', '/api/v1/lp/provide', { body: params });
  }

  // ── Rewards ─────────────────────────────────────────────────────────────

  /** List markets that currently distribute liquidity rewards. */
  async getRewardsMarkets(): Promise<RewardsMarket[]> {
    return this.request('GET', '/api/v1/rewards/markets');
  }

  /** Get reward configuration for a specific market by condition ID. */
  async getRewardsForMarket(conditionId: string): Promise<RewardsMarket> {
    return this.request('GET', `/api/v1/rewards/markets/${encodeURIComponent(conditionId)}`);
  }

  /** Get the authenticated user's reward history. */
  async getUserRewards(): Promise<{ rewards: UserReward[] }> {
    return this.request('GET', '/api/v1/rewards/user');
  }

  /** Get the authenticated user's total rewards with daily breakdown. */
  async getUserRewardsTotal(): Promise<UserRewardsTotal> {
    return this.request('GET', '/api/v1/rewards/user/total');
  }

  /** Get the authenticated user's reward distribution percentages per market. */
  async getUserRewardsPercentages(): Promise<UserRewardsPercentages> {
    return this.request('GET', '/api/v1/rewards/user/percentages');
  }

  /** Get the authenticated user's rewards broken down by market. */
  async getUserRewardsPerMarket(): Promise<{ markets: UserReward[] }> {
    return this.request('GET', '/api/v1/rewards/user/markets');
  }

  /** Get the authenticated user's fee rebate history. */
  async getRebates(): Promise<{ rebates: Rebate[] }> {
    return this.request('GET', '/api/v1/rewards/rebates');
  }

  // ── Profile ──────────────────────────────────────────────────────────────

  /** Update the authenticated user's own profile. */
  async updateMyProfile(params: UpdateProfileParams): Promise<PublicProfile> {
    return this.request('PATCH', '/api/v1/profile/me', { body: params });
  }

  /** Change the authenticated user's password. */
  async changeMyPassword(params: ChangePasswordParams): Promise<void> {
    return this.request('POST', '/api/v1/profile/password', { body: params });
  }

  /** Update the authenticated user's notification preferences (profile-level). */
  async updateProfileNotifications(preferences: Record<string, boolean>): Promise<void> {
    return this.request('PATCH', '/api/v1/profile/notifications', { body: preferences });
  }

  /** Get a public user profile by username. */
  async getPublicProfile(username: string): Promise<PublicProfile> {
    return this.request('GET', `/api/v1/profile/${encodeURIComponent(username)}`);
  }

  /** Follow or unfollow a user by username. Returns the new follow state. */
  async followUser(username: string): Promise<FollowResult> {
    return this.request('POST', `/api/v1/profile/${encodeURIComponent(username)}/follow`);
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  /** Update the authenticated user's settings profile (username, display name, etc.). */
  async updateSettingsProfile(params: UpdateSettingsProfileParams): Promise<void> {
    return this.request('PATCH', '/api/v1/settings/profile', { body: params });
  }

  /** Get the authenticated user's notification channel settings. */
  async getNotificationSettings(): Promise<NotificationSettings> {
    return this.request('GET', '/api/v1/settings/notifications');
  }

  /** Update the authenticated user's notification channel settings. */
  async updateNotificationSettings(params: UpdateNotificationSettingsParams): Promise<NotificationSettings> {
    return this.request('PATCH', '/api/v1/settings/notifications', { body: params });
  }

  /** Change the authenticated user's password (settings route). */
  async changePassword(params: ChangePasswordSettingsParams): Promise<void> {
    return this.request('PATCH', '/api/v1/settings/password', { body: params });
  }

  /** Get the authenticated user's beta API usage stats. */
  async getBetaUsage(): Promise<BetaUsage> {
    return this.request('GET', '/api/v1/settings/beta-usage');
  }

  /** Get the authenticated user's gas/transaction fee usage summary. */
  async getGasUsage(): Promise<GasUsage> {
    return this.request('GET', '/api/v1/settings/gas');
  }

  // ── Support Tickets ───────────────────────────────────────────────────────

  /** Create a new support ticket. */
  async createTicket(params: CreateTicketParams): Promise<SupportTicket> {
    return this.request('POST', '/api/v1/tickets', { body: params });
  }

  /** List all support tickets for the authenticated user. */
  async listTickets(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<SupportTicket>> {
    return this.request('GET', '/api/v1/tickets', { query: params as Record<string, unknown> });
  }

  /** Get a specific support ticket by ID. */
  async getTicket(id: string): Promise<SupportTicket> {
    return this.request('GET', `/api/v1/tickets/${encodeURIComponent(id)}`);
  }

  /** Add a message to an existing support ticket. */
  async addTicketMessage(ticketId: string, params: AddTicketMessageParams): Promise<TicketMessage> {
    return this.request('POST', `/api/v1/tickets/${encodeURIComponent(ticketId)}/messages`, { body: params });
  }

  // ── Notification Preferences ──────────────────────────────────────────────

  /** Get per-event notification preferences (inApp / email / push per event type). */
  async getNotificationPreferences(): Promise<EventNotificationPreferences> {
    return this.request('GET', '/api/v1/users/me/notification-preferences');
  }

  /** Update per-event notification preferences. */
  async updateNotificationPreferences(params: UpdateEventNotificationsParams): Promise<EventNotificationPreferences> {
    return this.request('PUT', '/api/v1/users/me/notification-preferences', { body: params });
  }

  // ── Strategy Execution Watching (SSE) ────────────────────────────────────

  /**
   * Stream live execution events for a running strategy via Server-Sent Events.
   *
   * Yields `StrategyEvent` objects as they arrive. The first event is always
   * `{ type: 'CONNECTED' }` confirming the stream is live.
   *
   * @param id       - Strategy UUID
   * @param signal   - Optional AbortSignal to stop the stream
   *
   * @example
   * ```ts
   * const ac = new AbortController();
   * for await (const event of client.watchStrategy('strat-uuid', ac.signal)) {
   *   if (event.type === 'ORDER_FILLED') console.log('Order filled!', event.data);
   *   if (event.type === 'STRATEGY_STOPPED') { ac.abort(); break; }
   * }
   * ```
   */
  async *watchStrategy(
    id: string,
    signal?: AbortSignal,
  ): AsyncGenerator<StrategyEvent> {
    const url = `${this.baseUrl}/api/v1/strategies/${encodeURIComponent(id)}/events`;
    // Merge user-provided signal with a timeout signal to prevent indefinite hangs
    const timeoutSignal = AbortSignal.timeout(this.streamTimeout);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: combinedSignal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      throw err;
    }

    if (!response.ok) {
      let errorBody: { code?: string; message?: string } = {};
      try { errorBody = await this.safeJson<typeof errorBody>(response); } catch (e) { if (e instanceof PolyforgeError) throw e; /* ignore non-JSON bodies */ }
      throw new PolyforgeError({
        status: response.status,
        code: errorBody.code ?? 'STREAM_ERROR',
        message: errorBody.message ?? `SSE stream failed with status ${response.status}`,
      });
    }

    if (!response.body) {
      throw new PolyforgeError({
        status: response.status,
        code: 'STREAM_ERROR',
        message: 'SSE response body is null — the server returned no readable stream',
      });
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        let done: boolean;
        let value: Uint8Array | undefined;
        try {
          ({ done, value } = await reader.read());
        } catch {
          break; // connection closed or aborted
        }
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        if (buf.length > MAX_SSE_BUFFER_SIZE) {
          throw new PolyforgeError({
            status: 0,
            code: 'STREAM_ERROR',
            message: `SSE event exceeded maximum buffer size (${MAX_SSE_BUFFER_SIZE} bytes)`,
          });
        }
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            // Validate expected fields exist before yielding
            if (typeof parsed.type !== 'string') continue;
            if (!KNOWN_STRATEGY_EVENTS.has(parsed.type)) {
              console.warn(`[polyforge-sdk] Unknown strategy event type: "${parsed.type}"`);
            }
            yield parsed as StrategyEvent;
          } catch {
            // skip malformed frame
          }
        }
      }
    } finally {
      reader.cancel().catch(() => undefined);
    }
  }
}
