// ── Enums & Unions ──────────────────────────────────────────────────────────

export type StrategyStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'PAPER' | 'ARCHIVED';

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
export type OrderType = 'GTC' | 'GTD' | 'FOK';
export type OrderStatus = 'PENDING' | 'SUBMITTED' | 'LIVE' | 'MATCHED' | 'DELAYED' | 'MINED' | 'CONFIRMED' | 'PARTIAL' | 'CANCELLED' | 'UNMATCHED' | 'FAILED' | 'ERROR';

// ── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Markets ─────────────────────────────────────────────────────────────────

export interface Token {
  id: string;
  outcome?: string;
  price?: number;
}

export interface Market {
  id: string;
  title: string;
  description?: string;
  category: string;
  endDate?: string | null;
  resolved?: boolean;
  tokens: Token[];
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

export type StrategyVisibility = 'PRIVATE' | 'PUBLIC' | 'UNLISTED';
export type StrategyExecMode = 'TICK' | 'EVENT' | 'HYBRID';

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  status: StrategyStatus;
  visibility: StrategyVisibility;
  execMode: StrategyExecMode;
  tickMs: number;
  triggers: StrategyBlock[];
  conditions: StrategyBlock[];
  actions: StrategyBlock[];
  safety: StrategyBlock[];
  logicBlocks: StrategyBlock[];
  calcBlocks: StrategyBlock[];
  tags: string[];
  variables: StrategyVariable[];
  canvas?: Record<string, unknown>;
  marketId?: string;
  pnl: number;
  tradeCount: number;
  winRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyVariable {
  name: string;
  type: 'number' | 'string' | 'boolean';
  defaultValue?: string;
  description?: string;
}

/** Response from strategy lifecycle operations (start/stop/pause/resume). */
export interface StrategyStatusResponse {
  status: StrategyStatus;
  startedAt?: string;
  stoppedAt?: string;
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
  tokenId: string;
  outcome: 'YES' | 'NO';
  side: OrderSide;
  size: string;
  avgPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  realizedPnl: string;
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
  tokenId: string;
  outcome: 'YES' | 'NO';
  strategyId?: string;
  intentId?: string;
  side: OrderSide;
  orderType: OrderType;
  status: OrderStatus;
  price: string;
  size: string;
  fillSize: string;
  fillPrice?: string;
  fee?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Social & Signals ────────────────────────────────────────────────────────

export interface WhaleTrade {
  id: string;
  walletAddress: string;
  marketId: string;
  tokenId: string;
  side: OrderSide;
  outcome: 'YES' | 'NO';
  size: string;
  price: string;
  notional: string;
  txHash: string | null;
  detectedAt: string;
  market: {
    id: string;
    title: string;
    slug: string;
    image: string | null;
  };
}

export interface NewsSignal {
  id: string;
  articleId: string;
  marketId: string;
  direction: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  confidence: number;
  reasoning: string | null;
  createdAt: string;
  article: {
    id: string;
    title: string;
    source: string;
    url: string;
    imageUrl: string | null;
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    publishedAt: string;
  };
  market: {
    id: string;
    title: string;
    slug: string;
    image: string | null;
  };
}

// ── API Keys ───────────────────────────────────────────────────────────────

export type ApiKeyScope = 'READ' | 'WRITE' | 'TRADE' | 'STRATEGY' | 'WEBHOOK';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyParams {
  name: string;
  scopes?: ApiKeyScope[];
}

export interface CreateApiKeyResponse extends Pick<ApiKey, 'id' | 'name' | 'prefix' | 'scopes' | 'createdAt'> {
  token: string;
}

// ── Configuration ───────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  tokenId: string;
  direction: 'above' | 'below';
  price: string;
  persistent: boolean;
  enabled: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
}

export type CopyMode = 'PERCENTAGE' | 'FIXED' | 'MIRROR';

export interface CopyConfig {
  id: string;
  targetWallet: string;
  mode?: CopyMode;
  sizeValue?: string;
  maxExposure?: string;
  maxDailyLoss?: string;
  priceOffset?: string;
  enabled: boolean;
  createdAt: string;
}

export interface CreateCopyConfigParams {
  /** Ethereum wallet address to copy (0x…). */
  targetWallet: string;
  mode?: CopyMode;
  sizeValue?: string;
  maxExposure?: string;
  maxDailyLoss?: string;
  priceOffset?: string;
}

export interface UpdateCopyConfigParams {
  mode?: CopyMode;
  sizeValue?: string;
  maxExposure?: string;
  maxDailyLoss?: string;
  priceOffset?: string;
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

/** Individual fields of the trader_scores table. */
export interface TraderScoreData {
  id: string;
  userId: string;
  score: number;
  winRate: string;
  sharpeRatio: string;
  avgReturn: string;
  totalTrades: number;
  profitFactor: string;
  maxDrawdown: string;
  consistency: string;
  updatedAt: string;
}

/** Weighted component in the score breakdown. */
export interface TraderScoreComponent {
  value: string | number;
  weight: number;
  weighted: number;
}

/** Detailed breakdown of how the score was computed. */
export interface TraderScoreBreakdown {
  score: number;
  components: {
    winRate: TraderScoreComponent;
    sharpe: TraderScoreComponent;
    profitFactor: TraderScoreComponent;
    consistency: TraderScoreComponent;
    avgReturn: TraderScoreComponent;
    tradeVolume: TraderScoreComponent;
    drawdown: TraderScoreComponent;
  };
  totalTrades: number;
  updatedAt: string;
}

/** Full response from GET /api/v1/scores/me. */
export interface TraderScore {
  score: TraderScoreData | null;
  breakdown: TraderScoreBreakdown | null;
}

// ── AI ──────────────────────────────────────────────────────────────────────

export interface AiQueryResponse {
  query: string;
  intent: string;
  filters: Record<string, unknown>;
  data: unknown;
  summary: string;
}

// ── Strategy Management ──────────────────────────────────────────────────────

export interface CreateStrategyParams {
  name: string;
  description?: string;
  visibility?: StrategyVisibility;
  execMode?: StrategyExecMode;
  tickMs?: number;
  triggers?: StrategyBlock[];
  conditions?: StrategyBlock[];
  actions?: StrategyBlock[];
  safety?: StrategyBlock[];
  logicBlocks?: StrategyBlock[];
  calcBlocks?: StrategyBlock[];
  tags?: string[];
  variables?: StrategyVariable[];
  canvas?: Record<string, unknown>;
  marketId?: string;
  marketSlots?: MarketSlot[];
}

export interface MarketSlot {
  slotId: string;
  marketId: string;
  tokenId?: string;
}

export interface UpdateStrategyParams {
  name?: string;
  description?: string;
  visibility?: StrategyVisibility;
  execMode?: StrategyExecMode;
  tickMs?: number;
  triggers?: StrategyBlock[];
  conditions?: StrategyBlock[];
  actions?: StrategyBlock[];
  safety?: StrategyBlock[];
  logicBlocks?: StrategyBlock[];
  calcBlocks?: StrategyBlock[];
  tags?: string[];
  variables?: StrategyVariable[];
  canvas?: Record<string, unknown>;
  marketId?: string;
  marketSlots?: MarketSlot[];
}

export interface ImportStrategyPayload {
  name: string;
  description?: string;
  triggers?: StrategyBlock[];
  conditions?: StrategyBlock[];
  actions?: StrategyBlock[];
  safety?: StrategyBlock[];
  logicBlocks?: StrategyBlock[];
  calcBlocks?: StrategyBlock[];
  marketId?: string;
}

export interface ImportStrategyParams {
  polyforge: string;
  exportedAt?: string;
  strategy: ImportStrategyPayload;
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
  size?: string;
}

export interface RedeemPositionParams {
  positionId?: string;
  marketId?: string;
}

export interface SplitPositionParams {
  tokenId: string;
  amount: string;
}

export interface MergePositionParams {
  tokenId: string;
  amount: string;
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
  marketId: string;
  tokenId: string;
  amountUsdc: number;
  targetSpread?: number;
}

export interface LpPosition {
  buyOrderId: string;
  sellOrderId: string;
  tokenId: string;
  buyPrice: string;
  sellPrice: string;
  size: string;
}

// ── Strategy Social ────────────────────────────────────────────────────────

export type StrategyReportReason = 'SPAM' | 'HARMFUL' | 'MISLEADING' | 'OTHER';

export interface StrategyLikeResult {
  liked: boolean;
  likeCount: number;
}

export interface StrategyComment {
  id: string;
  strategyId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; username: string; displayName: string | null };
}

export interface StrategyChild {
  id: string;
  name: string;
  status: string;
}

export interface StrategyReportResult {
  reportId: string;
}

// ── Strategy Versioning ────────────────────────────────────────────────────

export interface StrategyVersion {
  id: string;
  strategyId: string;
  version: number;
  triggers: unknown;
  conditions: unknown;
  actions: unknown;
  safety: unknown;
  createdAt: string;
}

export interface StrategyRollbackResult {
  message: string;
  version: number;
}

// ── Strategy Event Log ─────────────────────────────────────────────────────

export interface StrategyEventLogEntry {
  id: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
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
  strategyId?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  quickMode?: boolean;
  strategyBlocks?: Record<string, unknown>;
  marketBindings?: Record<string, string>;
}

// ── Alerts (create/delete) ──────────────────────────────────────────────────

export interface CreateAlertParams {
  tokenId: string;
  direction: 'above' | 'below';
  price: string;
  persistent?: boolean;
}

// ── Conditional Orders ──────────────────────────────────────────────────────

export type ConditionalOrderStatus = 'PENDING' | 'TRIGGERED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

export interface ConditionalOrder {
  id: string;
  marketId: string;
  tokenId: string;
  type: ConditionalOrderType;
  side: OrderSide;
  outcome: 'YES' | 'NO';
  size: number;
  triggerPrice: number;
  limitPrice?: string;
  trailingPct?: string;
  expiresAt?: string;
  status: ConditionalOrderStatus;
  createdAt: string;
  triggeredAt: string | null;
}

export type ConditionalOrderType = 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'LIMIT' | 'PEGGED';

export interface CreateConditionalOrderParams {
  marketId: string;
  tokenId: string;
  type: ConditionalOrderType;
  side: OrderSide;
  outcome: 'YES' | 'NO';
  size: number;
  triggerPrice: number;
  limitPrice?: string;
  trailingPct?: string;
  expiresAt?: string;
}

// ── Portfolio PnL ──────────────────────────────────────────────────────────

export interface PortfolioPnlParams {
  period?: '7d' | '30d' | '90d' | 'allTime';
  strategyId?: string;
}

export interface PortfolioPnl {
  snapshots: Array<{ time: string | null; pnl: string }>;
  totalPnl: string;
  winRate: string;
}

// ── Watchlist ──────────────────────────────────────────────────────────────

export interface WatchlistItem {
  marketId: string;
  slug: string;
  title: string;
  currentPrice: number;
  volume24h: number;
  priceDelta24h: number;
  watched: true;
}

export interface WatchlistStatus {
  marketId: string;
  watched: boolean;
}

export interface WatchlistAddResult {
  marketId: string;
  addedAt: string;
}

// ── Webhook Test ──────────────────────────────────────────────────────────────

export interface WebhookTestResult {
  success: boolean;
  statusCode: number;
}

// ── Price History & Order Book ──────────────────────────────────────────────

export interface PriceHistoryParams {
  resolution?: '1m' | '1h' | '1d';
  from?: string;
  to?: string;
  limit?: number;
}

export interface PriceHistoryEntry {
  timestamp: string;
  price: number;
  volume?: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

// ── Whale extended ──────────────────────────────────────────────────────────

export interface WhaleProfile {
  walletAddress: string;
  stats: {
    totalVolume: string;
    totalPnl: string;
    tradeCount: number;
    winRate: string;
  } | null;
  recentTrades: Array<{
    id: string;
    marketName: string;
    side: string;
    outcome: string;
    size: string;
    price: string;
    timestamp: string;
  }>;
  sparkline: number[];
  isFollowing: boolean;
}

export interface WhaleTopParams {
  sortBy?: 'volume' | 'pnl' | 'winRate' | 'tradeCount';
  period?: '24h' | '7d' | '30d' | 'all';
  limit?: number;
}

// ── Discover & Leaderboard ──────────────────────────────────────────────────

export interface DiscoverParams {
  sort?: 'popular' | 'newest' | 'top_pnl' | 'most_forked';
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface LeaderboardParams {
  period?: '7d' | '30d' | 'allTime';
  page?: number;
  limit?: number;
}

// ── Paper trading ───────────────────────────────────────────────────────────

export interface PaperSummary {
  balance: number;
  pnl: number;
  tradeCount: number;
  openPositions: number;
}

// ── Batch API ───────────────────────────────────────────────────────────────

export interface BatchRequestItem {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  path: string;
  body?: Record<string, unknown>;
}

export interface BatchResponse {
  results: Array<{
    status: number;
    body: unknown;
  }>;
}

// ── Marketplace seller ──────────────────────────────────────────────────────

export interface CreateListingParams {
  strategyId: string;
  title: string;
  description?: string;
  priceUsdc: number;
  tags?: string[];
}

export interface UpdateListingParams {
  title?: string;
  description?: string;
  priceUsdc?: number;
  tags?: string[];
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'DELISTED';
}

export interface RateListingParams {
  /** Rating from 1 to 5. */
  rating: number;
  review?: string;
}

// ── Risk Settings ───────────────────────────────────────────────────────────

export interface RiskSettings {
  drawdownEnabled: boolean;
  drawdownLookbackHours: number;
  drawdownThresholdPct: number;
  circuitBreakerTripped: boolean;
  circuitBreakerTrippedAt: string | null;
}

export interface UpdateRiskSettingsParams {
  drawdownEnabled?: boolean;
  /** Lookback window in hours (1–168). */
  drawdownLookbackHours?: number;
  /** Drawdown threshold as a decimal, e.g. 0.10 = 10% (0.01–0.99). */
  drawdownThresholdPct?: number;
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
