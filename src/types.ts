// ── Enums & Unions ──────────────────────────────────────────────────────────

export type StrategyStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'PAPER';

export type WebhookEvent =
  | 'strategy.started'
  | 'strategy.stopped'
  | 'strategy.error'
  | 'order.filled'
  | 'order.cancelled'
  | 'order.failed'
  | 'position.opened'
  | 'position.closed'
  | 'alert.triggered'
  | 'whale.detected'
  | 'signal.generated';

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
export type OrderStatus = 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'FAILED';

// ── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
}

// ── Markets ─────────────────────────────────────────────────────────────────

export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoUrl?: string;
}

export interface Market {
  id: string;
  name: string;
  baseToken: Token;
  quoteToken: Token;
  category: string;
  price: number;
  volume24h: number;
  change24h: number;
  liquidity: number;
  createdAt: string;
}

// ── Strategies ──────────────────────────────────────────────────────────────

export interface StrategyBlock {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
  connections: string[];
}

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  status: StrategyStatus;
  blocks: StrategyBlock[];
  marketId?: string;
  pnl: number;
  tradeCount: number;
  winRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  blocks: StrategyBlock[];
  popularity: number;
}

export interface StrategyExport {
  strategy: Strategy;
  version: string;
  exportedAt: string;
  checksum: string;
}

// ── Portfolio & Orders ──────────────────────────────────────────────────────

export interface Position {
  id: string;
  marketId: string;
  marketName: string;
  side: OrderSide;
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  openedAt: string;
}

export interface Portfolio {
  totalValue: number;
  availableBalance: number;
  unrealizedPnl: number;
  realizedPnl: number;
  positions: Position[];
  updatedAt: string;
}

export interface Order {
  id: string;
  marketId: string;
  marketName: string;
  strategyId?: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: number;
  size: number;
  filledSize: number;
  filledPrice?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Social & Signals ────────────────────────────────────────────────────────

export interface WhaleTrade {
  id: string;
  wallet: string;
  marketId: string;
  marketName: string;
  side: OrderSide;
  size: number;
  usdValue: number;
  timestamp: string;
}

export interface NewsSignal {
  id: string;
  headline: string;
  source: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  relatedMarkets: string[];
  publishedAt: string;
}

// ── Configuration ───────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  name: string;
  condition: string;
  marketId?: string;
  enabled: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
}

export interface CopyConfig {
  id: string;
  sourceWallet: string;
  label?: string;
  maxPositionSize: number;
  enabled: boolean;
  totalCopiedTrades: number;
  createdAt: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  enabled: boolean;
  lastDeliveredAt?: string;
  createdAt: string;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface TraderScore {
  overall: number;
  profitability: number;
  consistency: number;
  riskManagement: number;
  volume: number;
  rank: number;
  percentile: number;
  updatedAt: string;
}

// ── AI ──────────────────────────────────────────────────────────────────────

export interface AiQueryResponse {
  answer: string;
  confidence: number;
  sources: string[];
  suggestedActions?: string[];
}

// ── Direct Trading ──────────────────────────────────────────────────────────

export interface PlaceOrderParams {
  tokenId: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  size: number;
  price: number;
  orderType?: 'GTC' | 'FOK' | 'GTD';
}

export interface PlaceOrderResponse {
  orderId: string;
  intentId: string;
  status: string;
}

export interface CancelOrderResponse {
  orderId: string;
  status: string;
}

// ── Strategy Events (SSE) ────────────────────────────────────────────────────

/** Event type fired over the strategy SSE stream. */
export type StrategyEventType =
  | 'CONNECTED'
  | 'STRATEGY_STARTED'
  | 'STRATEGY_STOPPED'
  | 'STRATEGY_PAUSED'
  | 'STRATEGY_RESUMED'
  | 'STRATEGY_ERROR'
  | 'ORDER_PLACED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_FILLED'
  | 'ORDER_PARTIAL'
  | 'ORDER_CANCELLED'
  | 'ORDER_FAILED'
  | 'ORDER_ERROR'
  | 'BACKTEST_PROGRESS'
  | 'BACKTEST_COMPLETED'
  | 'BACKTEST_FAILED'
  | string;

/** A single event received from the strategy execution SSE stream. */
export interface StrategyEvent {
  /** Event type identifier. */
  type: StrategyEventType;
  /** The strategy this event belongs to. */
  strategyId: string;
  /** Event-specific payload (varies per type). */
  data: Record<string, unknown> | null;
  /** Unix ms timestamp when the event was emitted server-side. */
  timestamp: number;
}

// ── Client Options ──────────────────────────────────────────────────────────

export interface PolyforgeClientOptions {
  apiUrl?: string;
  apiKey: string;
  timeout?: number;
}
