import { PolyforgeError } from './errors.js';
import type {
  AiQueryResponse,
  Alert,
  CancelOrderResponse,
  CopyConfig,
  Market,
  NewsSignal,
  Order,
  PaginatedResponse,
  PlaceOrderParams,
  PlaceOrderResponse,
  Portfolio,
  PolyforgeClientOptions,
  Strategy,
  StrategyExport,
  StrategyStatus,
  StrategyTemplate,
  TraderScore,
  Webhook,
  WebhookEvent,
  WhaleTrade,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.polyforge.io/v1';
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
    return this.request('GET', '/markets', { query: params as Record<string, unknown> });
  }

  /**
   * Get a single market by ID.
   */
  async getMarket(id: string): Promise<Market> {
    return this.request('GET', `/markets/${encodeURIComponent(id)}`);
  }

  // ── Strategies ──────────────────────────────────────────────────────────

  /**
   * List strategies owned by the authenticated user.
   */
  async listStrategies(params?: { status?: StrategyStatus }): Promise<Strategy[]> {
    return this.request('GET', '/strategies', { query: params as Record<string, unknown> });
  }

  /**
   * Get a single strategy by ID.
   */
  async getStrategy(id: string): Promise<Strategy> {
    return this.request('GET', `/strategies/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new strategy.
   */
  async createStrategy(params: { name: string; description?: string }): Promise<Strategy> {
    return this.request('POST', '/strategies', { body: params });
  }

  /**
   * Generate a strategy from a natural-language description using AI.
   */
  async createStrategyFromDescription(params: {
    description: string;
    marketId?: string;
  }): Promise<Strategy> {
    return this.request('POST', '/strategies/generate', { body: params });
  }

  /**
   * Start a strategy in live or paper mode.
   */
  async startStrategy(id: string, mode: 'live' | 'paper' = 'paper'): Promise<Strategy> {
    return this.request('POST', `/strategies/${encodeURIComponent(id)}/start`, {
      body: { mode },
    });
  }

  /**
   * Stop a running strategy.
   */
  async stopStrategy(id: string): Promise<Strategy> {
    return this.request('POST', `/strategies/${encodeURIComponent(id)}/stop`);
  }

  /**
   * List available strategy templates.
   */
  async getStrategyTemplates(): Promise<StrategyTemplate[]> {
    return this.request('GET', '/strategies/templates');
  }

  /**
   * Export a strategy as a portable JSON object.
   */
  async exportStrategy(id: string): Promise<StrategyExport> {
    return this.request('GET', `/strategies/${encodeURIComponent(id)}/export`);
  }

  // ── Portfolio & Orders ──────────────────────────────────────────────────

  /**
   * Get the authenticated user's portfolio summary.
   */
  async getPortfolio(): Promise<Portfolio> {
    return this.request('GET', '/portfolio');
  }

  /**
   * List orders with optional filters.
   */
  async getOrders(params?: { limit?: number; status?: string }): Promise<Order[]> {
    return this.request('GET', '/orders', { query: params as Record<string, unknown> });
  }

  /**
   * Get the authenticated user's trader score.
   */
  async getScore(): Promise<TraderScore> {
    return this.request('GET', '/score');
  }

  // ── Social & Signals ────────────────────────────────────────────────────

  /**
   * Get the whale-trade feed.
   */
  async getWhaleFeed(params?: { minSize?: number }): Promise<WhaleTrade[]> {
    return this.request('GET', '/whale-feed', { query: params as Record<string, unknown> });
  }

  /**
   * Get AI-generated news signals.
   */
  async getNewsSignals(params?: { minConfidence?: number }): Promise<NewsSignal[]> {
    return this.request('GET', '/news-signals', { query: params as Record<string, unknown> });
  }

  // ── Configuration ───────────────────────────────────────────────────────

  /**
   * List configured alerts.
   */
  async listAlerts(): Promise<Alert[]> {
    return this.request('GET', '/alerts');
  }

  /**
   * List copy-trading configurations.
   */
  async listCopyConfigs(): Promise<CopyConfig[]> {
    return this.request('GET', '/copy-configs');
  }

  /**
   * List registered webhooks.
   */
  async listWebhooks(): Promise<Webhook[]> {
    return this.request('GET', '/webhooks');
  }

  /**
   * Register a new webhook.
   */
  async createWebhook(params: { url: string; events: WebhookEvent[] }): Promise<Webhook> {
    return this.request('POST', '/webhooks', { body: params });
  }

  // ── AI ──────────────────────────────────────────────────────────────────

  /**
   * Ask the Polyforge AI assistant a natural-language question.
   */
  async aiQuery(query: string): Promise<AiQueryResponse> {
    return this.request('POST', '/ai/query', { body: { query } });
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
    return this.request<CancelOrderResponse>('DELETE', `/api/v1/orders/${orderId}`);
  }
}
