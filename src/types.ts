// ── Enums & Unions ──────────────────────────────────────────────────────────

export type StrategyStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'PAPER';

export type WebhookEvent =
  | 'ORDER_FILLED'
  | 'STRATEGY_ERROR'
  | 'WHALE_TRADE'
  | 'NEWS_SIGNAL'
  | 'BACKTEST_COMPLETE'
  | 'DAILY_LOSS_LIMIT'
  | 'MARKET_RESOLVED'
  | 'PRICE_ALERT';

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

// ── Strategy Management ──────────────────────────────────────────────────────

export interface UpdateStrategyParams {
  name?: string;
  description?: string;
  blocks?: StrategyBlock[];
  marketId?: string;
}

export interface ImportStrategyParams {
  data: StrategyExport;
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

export interface ClosePositionParams {
  tokenId: string;
  size?: number;
}

export interface RedeemPositionParams {
  tokenId: string;
  conditionId?: string;
}

export interface SplitPositionParams {
  tokenId: string;
  size: number;
  price: number;
}

export interface MergePositionParams {
  tokenIds: string[];
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
  | (string & {}); // Allows unknown server event types while preserving autocomplete

/**
 * Set of known strategy event types for runtime validation.
 * Events not in this set are still yielded but trigger a console warning.
 */
export const KNOWN_STRATEGY_EVENTS: ReadonlySet<string> = new Set<StrategyEventType>([
  'CONNECTED', 'STRATEGY_STARTED', 'STRATEGY_STOPPED',
  'STRATEGY_PAUSED', 'STRATEGY_RESUMED', 'STRATEGY_ERROR',
  'ORDER_PLACED', 'ORDER_SUBMITTED', 'ORDER_FILLED',
  'ORDER_PARTIAL', 'ORDER_CANCELLED', 'ORDER_FAILED', 'ORDER_ERROR',
  'BACKTEST_PROGRESS', 'BACKTEST_COMPLETED', 'BACKTEST_FAILED',
]);

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

// ── Arbitrage ────────────────────────────────────────────────────────────────

export interface ArbitrageOpportunity {
  marketId: string;
  marketTitle: string;
  category: string;
  endDate: string | null;
  yesTokenId: string;
  noTokenId: string;
  yesPrice: string;
  noPrice: string;
  sum: string;
  marginPct: string;
  costPerUnit: string;
  profitPerUnit: string;
}

// ── Smart Orders ─────────────────────────────────────────────────────────────

export type SmartOrderType = 'TWAP' | 'DCA' | 'BRACKET' | 'OCO';
export type SmartOrderStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export interface PlaceSmartOrderParams {
  type: SmartOrderType;
  tokenId: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  totalSize: number;
  // TWAP / DCA
  slices?: number;
  intervalMinutes?: number;
  limitPrice?: number;
  // BRACKET
  entryPrice?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  // OCO
  priceA?: number;
  priceB?: number;
}

export interface SmartOrderChildOrder {
  id: string;
  status: string;
  fillSize: string | null;
  fillPrice: string | null;
  createdAt: string;
}

export interface SmartOrder {
  id: string;
  type: SmartOrderType;
  status: SmartOrderStatus;
  marketId: string;
  tokenId: string;
  outcome: string;
  side: string;
  totalSize: string;
  config: Record<string, unknown>;
  slicesFilled: number;
  slicesTotal: number;
  nextExecuteAt: string | null;
  completedAt: string | null;
  createdAt: string;
  orders: SmartOrderChildOrder[];
}

export interface PlaceSmartOrderResponse {
  smartOrderId: string;
  type: SmartOrderType;
  status: string;
  slicesTotal: number;
}

// ── Marketplace ──────────────────────────────────────────────────────────────

export interface MarketplaceListing {
  id: string;
  strategyId: string;
  sellerId: string;
  title: string;
  description: string | null;
  priceUsdc: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'DELISTED';
  purchaseCount: number;
  forkCount: number;
  avgRating: string | null;
  ratingCount: number;
  tags: string[];
  createdAt: string;
  seller: { id: string; name: string; avatarUrl: string | null };
  strategy: { id: string; name: string; description: string | null };
}

export interface MarketplacePurchaseResult {
  purchaseId: string;
  forkedStrategyId: string;
  priceUsdc: number;
  platformFee: number;
  sellerNet: number;
}

export interface BrowseMarketplaceParams {
  tag?: string;
  sort?: 'newest' | 'popular' | 'rating' | 'price_asc' | 'price_desc';
  limit?: number;
  offset?: number;
}

// ── Accuracy & Portfolio Review ──────────────────────────────────────────────

export interface AccuracyScore {
  brierScore: number | null;
  totalPredictions: number;
  correctPredictions: number;
  winRate: string;
  calibration: Array<{ bucketMid: number; frequency: number; count: number }>;
  byCategory: Record<string, { count: number; brierScore: number }>;
}

export interface PortfolioReview {
  review: string;
  suggestions: string[];
  score: number;
  generatedAt: string;
}

export interface MarketSentiment {
  marketId: string;
  score: number;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signalCount: number;
  lastUpdated: string | null;
}

export interface ProvideLiquidityParams {
  tokenId: string;
  spread: number;
  size: number;
}

export interface LpPosition {
  buyOrderId: string;
  sellOrderId: string;
  tokenId: string;
  buyPrice: string;
  sellPrice: string;
  size: string;
}

// ── Backtests ──────────────────────────────────────────────────────────────

export interface Backtest {
  id: string;
  strategyId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startDate: string;
  endDate: string;
  initialBalance: number;
  finalBalance: number;
  pnl: number;
  tradeCount: number;
  winRate: number;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface RunBacktestParams {
  strategyId: string;
  dateRangeStart: string;
  dateRangeEnd: string;
}

// ── Alerts (create/delete) ──────────────────────────────────────────────────

export interface CreateAlertParams {
  name: string;
  condition: string;
  marketId?: string;
}

// ── Conditional Orders ──────────────────────────────────────────────────────

export type ConditionalOrderStatus = 'PENDING' | 'TRIGGERED' | 'CANCELLED' | 'EXPIRED';

export interface ConditionalOrder {
  id: string;
  marketId: string;
  side: OrderSide;
  size: number;
  triggerPrice: number;
  limitPrice?: number;
  status: ConditionalOrderStatus;
  createdAt: string;
  triggeredAt: string | null;
}

export interface CreateConditionalOrderParams {
  marketId: string;
  side: OrderSide;
  size: number;
  triggerPrice: number;
  limitPrice?: number;
}

// ── Portfolio PnL ──────────────────────────────────────────────────────────

export interface PortfolioPnl {
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  history: Array<{ date: string; pnl: number; cumulativePnl: number }>;
}

// ── Client Options ──────────────────────────────────────────────────────────

export interface PolyforgeClientOptions {
  apiUrl?: string;
  apiKey: string;
  /** Timeout for regular API requests in milliseconds (default: 15000). */
  timeout?: number;
  /** Timeout for SSE streams in milliseconds (default: 24 hours). */
  streamTimeout?: number;
}
