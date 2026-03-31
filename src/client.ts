import { PolyforgeError } from './errors.js';
import type {
  AccuracyScore,
  AiQueryResponse,
  Alert,
  ArbitrageOpportunity,
  BrowseMarketplaceParams,
  CancelOrderResponse,
  ClosePositionParams,
  CopyConfig,
  ImportStrategyParams,
  LpPosition,
  Market,
  MarketplaceListing,
  MarketplacePurchaseResult,
  MarketSentiment,
  MergePositionParams,
  NewsSignal,
  Order,
  PaginatedResponse,
  PlaceOrderParams,
  PlaceOrderResponse,
  PlaceSmartOrderParams,
  PlaceSmartOrderResponse,
  Portfolio,
  PolyforgeClientOptions,
  PortfolioReview,
  ProvideLiquidityParams,
  RedeemPositionParams,
  SmartOrder,
  SplitPositionParams,
  Strategy,
  StrategyEvent,
  StrategyExport,
  StrategyStatus,
  StrategyTemplate,
  TraderScore,
  UpdateStrategyParams,
  Webhook,
  WebhookEvent,
  WhaleTrade,
} from './types.js';

const DEFAULT_BASE_URL = 'https://localhost:3002';
const DEFAULT_TIMEOUT_MS = 15_000;

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

  constructor(options: PolyforgeClientOptions) {
    if (!options.apiKey) {
      throw new Error('apiKey is required');
    }
    this.baseUrl = (options.apiUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

    // Reject non-HTTPS URLs for non-localhost hosts to prevent credential leakage
    const parsed = new URL(this.baseUrl);
    if (
      parsed.protocol !== 'https:' &&
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1'
    ) {
      throw new Error('Non-localhost API URLs must use HTTPS');
    }
  }

  // ── Internal request helper ─────────────────────────────────────────────

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
      let errorBody: { code?: string; message?: string; requestId?: string } = {};
      try {
        errorBody = (await response.json()) as typeof errorBody;
      } catch {
        // Body may not be JSON
      }

      throw new PolyforgeError({
        status: response.status,
        code: errorBody.code ?? 'UNKNOWN_ERROR',
        message: errorBody.message ?? `Request failed with status ${response.status}`,
        requestId: errorBody.requestId ?? response.headers.get('x-request-id') ?? undefined,
      });
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  // ── Markets ─────────────────────────────────────────────────────────────

  /**
   * List available markets with optional filtering and pagination.
   */
  async listMarkets(params?: {
    search?: string;
    category?: string;
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

  // ── Strategies ──────────────────────────────────────────────────────────

  /**
   * List strategies owned by the authenticated user.
   */
  async listStrategies(params?: { status?: StrategyStatus }): Promise<Strategy[]> {
    return this.request('GET', '/api/v1/strategies', { query: params as Record<string, unknown> });
  }

  /**
   * Get a single strategy by ID.
   */
  async getStrategy(id: string): Promise<Strategy> {
    return this.request('GET', `/api/v1/strategies/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new strategy.
   */
  async createStrategy(params: { name: string; description?: string; marketId?: string }): Promise<Strategy> {
    return this.request('POST', '/api/v1/strategies', { body: params });
  }

  /**
   * Generate a strategy from a natural-language description using AI.
   */
  async createStrategyFromDescription(params: {
    description: string;
    marketId?: string;
  }): Promise<Strategy> {
    return this.request('POST', '/api/v1/strategies/from-description', { body: params });
  }

  /**
   * Start a strategy in live or paper mode.
   */
  async startStrategy(id: string, mode: 'live' | 'paper' = 'paper'): Promise<Strategy> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/start`, {
      body: { mode },
    });
  }

  /**
   * Stop a running strategy.
   */
  async stopStrategy(id: string): Promise<Strategy> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/stop`);
  }

  /**
   * List available strategy templates.
   */
  async getStrategyTemplates(): Promise<StrategyTemplate[]> {
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
  async pauseStrategy(id: string): Promise<Strategy> {
    return this.request('POST', `/api/v1/strategies/${encodeURIComponent(id)}/pause`);
  }

  /**
   * Resume a paused strategy.
   */
  async resumeStrategy(id: string): Promise<Strategy> {
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

  /**
   * List orders with optional filters.
   */
  async getOrders(params?: {
    limit?: number;
    status?: string;
    strategyId?: string;
    from?: string;
    to?: string;
  }): Promise<Order[]> {
    return this.request('GET', '/api/v1/orders', { query: params as Record<string, unknown> });
  }

  /**
   * Get the authenticated user's trader score.
   */
  async getScore(): Promise<TraderScore> {
    return this.request('GET', '/api/v1/scores/me');
  }

  // ── Social & Signals ────────────────────────────────────────────────────

  /**
   * Get the whale-trade feed.
   */
  async getWhaleFeed(params?: { minSize?: number }): Promise<WhaleTrade[]> {
    return this.request('GET', '/api/v1/whales/feed', { query: params as Record<string, unknown> });
  }

  /**
   * Get AI-generated news signals.
   */
  async getNewsSignals(params?: { minConfidence?: number }): Promise<NewsSignal[]> {
    return this.request('GET', '/api/v1/news/signals', { query: params as Record<string, unknown> });
  }

  // ── Configuration ───────────────────────────────────────────────────────

  /**
   * List configured alerts.
   */
  async listAlerts(): Promise<Alert[]> {
    return this.request('GET', '/api/v1/alerts');
  }

  /**
   * List copy-trading configurations.
   */
  async listCopyConfigs(): Promise<CopyConfig[]> {
    return this.request('GET', '/api/v1/copy');
  }

  /**
   * List registered webhooks.
   */
  async listWebhooks(): Promise<Webhook[]> {
    return this.request('GET', '/api/v1/webhooks');
  }

  /**
   * Register a new webhook.
   */
  async createWebhook(params: { url: string; events: WebhookEvent[] }): Promise<Webhook> {
    // Validate webhook URL to prevent SSRF attacks
    const parsed = new URL(params.url);
    if (parsed.protocol !== 'https:') {
      throw new Error('Webhook URL must use HTTPS');
    }
    const blockedHosts = ['127.0.0.1', 'localhost', '0.0.0.0', '169.254.169.254'];
    if (blockedHosts.includes(parsed.hostname)) {
      throw new Error('Webhook URL cannot point to localhost or internal addresses');
    }
    return this.request('POST', '/api/v1/webhooks', { body: params });
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
    return this.request<PlaceOrderResponse>('POST', '/api/v1/orders/place', { body: params });
  }

  /**
   * Cancel a pending or live order.
   */
  async cancelOrder(orderId: string): Promise<CancelOrderResponse> {
    return this.request<CancelOrderResponse>('DELETE', `/api/v1/orders/${encodeURIComponent(orderId)}`);
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
  async redeemPosition(params: RedeemPositionParams): Promise<PlaceOrderResponse> {
    return this.request('POST', '/api/v1/orders/redeem', { body: params });
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

  // ── Smart Orders ─────────────────────────────────────────────────────────

  /**
   * Place an advanced smart order (TWAP, DCA, BRACKET, or OCO).
   */
  async placeSmartOrder(params: PlaceSmartOrderParams): Promise<PlaceSmartOrderResponse> {
    return this.request('POST', '/api/v1/orders/smart', { body: params });
  }

  /**
   * List your smart orders with child order progress.
   */
  async listSmartOrders(): Promise<SmartOrder[]> {
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
    return this.request('GET', `/api/v1/news/sentiment/${marketId}`);
  }

  /**
   * Provide liquidity by placing two-sided quotes on a market token.
   */
  async provideLiquidity(params: ProvideLiquidityParams): Promise<LpPosition> {
    return this.request('POST', '/api/v1/lp/provide', { body: params });
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
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      throw err;
    }

    if (!response.ok) {
      let errorBody: { code?: string; message?: string } = {};
      try { errorBody = await response.json() as typeof errorBody; } catch { /* ignore */ }
      throw new PolyforgeError({
        status: response.status,
        code: errorBody.code ?? 'STREAM_ERROR',
        message: errorBody.message ?? `SSE stream failed with status ${response.status}`,
      });
    }

    const reader = response.body!.getReader();
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
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            yield JSON.parse(raw) as StrategyEvent;
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
