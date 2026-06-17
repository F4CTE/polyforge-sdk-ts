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
export type OrderType = 'GTC' | 'GTD' | 'FOK' | 'FAK' | 'POST_ONLY';
export type OrderStatus = 'PENDING' | 'SUBMITTED' | 'LIVE' | 'MATCHED' | 'DELAYED' | 'MINED' | 'CONFIRMED' | 'PARTIAL' | 'CANCELLED' | 'UNMATCHED' | 'FAILED' | 'ERROR';

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
  marketSlots?: MarketSlot[];
  kalshiSubaccount?: number;
  pnl?: number;
  tradeCount?: number;
  winRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyVariable {
  id: string;
  name: string;
  expression: string;
}

export interface ImportStrategyVariable {
  name: string;
  expression: string;
}

/** Response from strategy lifecycle operations (start/stop/pause/resume). */
export interface StrategyStatusResponse {
  status: StrategyStatus;
  startedAt?: string;
  stoppedAt?: string;
}

/** Execution health metrics for a strategy. */
export interface StrategyHealth {
  fillRate: number | null;
  avgLatencyMs: number;
  errorCount24h: number;
  slippageBps: number;
  winRate: number | null;
  totalPnl: number | null;
  maxDrawdown: number | null;
  totalOrders: number;
  filledOrders: number;
  lastUpdated: string | null;
}

export interface StrategyBlockValidationIssue {
  blockId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface StrategyBlockValidationResult {
  valid: boolean;
  issues: StrategyBlockValidationIssue[];
}

export interface StrategyBlockTypeInfo {
  type: string;
  label: string;
  description: string;
  category: string;
  configSchema: Record<string, unknown>;
}

export interface StrategyUpdatePreview {
  strategyId: string;
  preview: Record<string, unknown>;
  warnings: string[];
}

export interface StrategyDecisionExplanation {
  strategyId: string;
  explanation: string;
  confidence: number;
  factors: Array<{ name: string; impact: string }>;
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

export type PositionOutcome = 'YES' | 'NO';
export type PositionResolutionStatus = 'UNRESOLVED' | 'RESOLVING' | 'RESOLVED' | 'DISPUTED';

export interface Position {
  id: string;
  marketId: string;
  marketTitle: string;
  marketCategory: string | null;
  tokenId: string;
  side: PositionOutcome;
  size: string;
  avgEntryPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  resolutionStatus: PositionResolutionStatus;
}

export interface Portfolio {
  positions: Position[];
  totalUnrealizedPnl: string;
  totalRealizedPnl: string;
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
  marketId: string;
  marketName: string;
  side: string;
  size: number;
  usdValue: number;
  wallet: string;
  timestamp: string;
}

export interface NewsSignal {
  id: string;
  headline: string;
  source: string;
  sentiment: string;
  confidence: number;
  relatedMarkets: string[];
  signal: string;
  publishedAt: string;
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

export type CopyStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'ERROR';

export interface CopyConfig {
  id: string;
  userId: string;
  targetWallet: string;
  mode: CopyMode;
  sizeValue: string;
  maxExposure: string;
  maxDailyLoss: string;
  priceOffset: string;
  status: CopyStatus;
  totalPnl: string;
  totalCopied: number;
  createdAt: string;
  updatedAt: string;
  stoppedAt: string | null;
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
  active: boolean;
  lastDeliveredAt?: string;
  createdAt: string;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface TraderScore {
  overall: number;
  rank: number;
  profitability: number;
  consistency: number;
  riskManagement: number;
  volume: number;
  percentile: number;
  updatedAt: string;
}

// ── AI ──────────────────────────────────────────────────────────────────────

export interface AiQueryResponse {
  answer: string;
  confidence: number;
  sources: string[];
  suggestedActions: string[];
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
  kalshiSubaccount?: number;
}

export interface MarketSlot {
  slot: string;
  label?: string;
  defaultMarketId?: string;
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
  kalshiSubaccount?: number;
}

export interface ImportStrategyPayload {
  name: string;
  description?: string;
  execMode?: StrategyExecMode;
  tickMs?: number;
  visibility?: StrategyVisibility;
  tags?: string[];
  variables?: ImportStrategyVariable[];
  blocks?: ImportStrategyBlocks;
  canvas?: Record<string, unknown>;
}

export interface ImportStrategyBlocks {
  triggers?: ImportStrategyBlock[];
  conditions?: ImportStrategyBlock[];
  actions?: ImportStrategyBlock[];
  safety?: ImportStrategyBlock[];
}

export interface ImportStrategyBlock {
  type: string;
  config?: Record<string, unknown>;
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
  /** Order size in USDC. Must be a positive number (>= 1). */
  size: number;
  price: number;
  orderType?: OrderType;
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

export interface RedeemPositionResponse {
  positionId: string;
  intentId: string;
  status: string;
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
export type KnownStrategyEventType =
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
  | 'BACKTEST_FAILED';

export type StrategyEventType = KnownStrategyEventType | (string & {}); // Allows unknown server event types while preserving autocomplete

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

// ── WebSocket Gateway Events ─────────────────────────────────────────────────

export type RealtimeClientMessage =
  | { type: 'PING' }
  | { type: 'SUBSCRIBE_PRICES'; tokenIds: string[] }
  | { type: 'UNSUBSCRIBE_PRICES'; tokenIds: string[] }
  | { type: 'SUBSCRIBE_STRATEGY'; strategyId: string }
  | { type: 'UNSUBSCRIBE_STRATEGY'; strategyId: string }
  | { type: 'SUBSCRIBE_WHALES' }
  | { type: 'UNSUBSCRIBE_WHALES' };

export type RealtimeGatewayEventType =
  | 'AUTH_OK'
  | 'PONG'
  | 'PRICE_UPDATE'
  | 'WHALE_TRADE'
  | 'NEWS_SIGNAL'
  | 'NOTIFICATION'
  | 'MARKET_SETTLEMENT'
  | 'ERROR';

export type RealtimeEventType = RealtimeGatewayEventType | KnownStrategyEventType;

export interface RealtimePriceUpdate {
  tokenId: string;
  price: number;
  timestamp: number;
}

export interface RealtimeMarketSettlement {
  ticker: string;
  settlementValue: string;
  result: string | null;
}

export type RealtimeServerEvent =
  | { type: 'AUTH_OK'; timestamp: number }
  | { type: 'PONG'; timestamp: number }
  | { type: 'PRICE_UPDATE'; data: RealtimePriceUpdate; timestamp: number }
  | { type: 'WHALE_TRADE'; data: Record<string, unknown>; timestamp: number }
  | { type: 'NEWS_SIGNAL'; data: Record<string, unknown>; timestamp: number }
  | { type: 'NOTIFICATION'; data: Record<string, unknown>; timestamp: number }
  | { type: 'MARKET_SETTLEMENT'; data: RealtimeMarketSettlement; timestamp: number }
  | { type: 'ERROR'; message: string; timestamp?: number }
  | { type: KnownStrategyEventType; data: { strategyId?: string } & Record<string, unknown>; timestamp: number };

export interface PolyforgeWebSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener?(type: 'open', listener: () => void): void;
  addEventListener?(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener?(type: 'close', listener: (event: { code: number; reason?: string }) => void): void;
  addEventListener?(type: 'error', listener: (event: unknown) => void): void;
  onopen?: (() => void) | null;
  onmessage?: ((event: { data: unknown }) => void) | null;
  onclose?: ((event: { code: number; reason?: string }) => void) | null;
  onerror?: ((event: unknown) => void) | null;
}

export interface PolyforgeWebSocketConstructor {
  new (url: string): PolyforgeWebSocketLike;
}

export interface PolyforgeRealtimeOptions {
  /** Override the computed `{apiUrl}/ws` endpoint. Mostly useful for tests. */
  wsUrl?: string;
  /** Optional WebSocket constructor for Node runtimes or tests. Defaults to globalThis.WebSocket. */
  WebSocket?: PolyforgeWebSocketConstructor;
  /** Whether non-terminal closes reconnect automatically. Defaults to true. */
  reconnect?: boolean;
  /** Initial reconnect delay in milliseconds. Defaults to 500. */
  reconnectMinDelayMs?: number;
  /** Maximum reconnect delay in milliseconds. Defaults to 10000. */
  reconnectMaxDelayMs?: number;
}

export interface PolyforgeRealtimeConnectionOptions extends PolyforgeRealtimeOptions {
  apiUrl: string;
  token: string;
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
  /** Total order size in USDC. Must be a positive number (>= 1). */
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

export type StrategyReportReason = 'SPAM' | 'INAPPROPRIATE' | 'MISLEADING' | 'OTHER';

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
  period: string;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  winRate: number;
  tradeCount: number;
  bestTrade: number;
  worstTrade: number;
  dataPoints: Array<Record<string, unknown>>;
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
  /**
   * Candle bucket size.
   *
   * Recommended maximum windows when using `from` / `to`:
   * - `1m`: 7 days.
   * - `1h`: 1 year.
   * - `1d`: 10 years.
   */
  resolution?: '1m' | '1h' | '1d';
  /** ISO timestamp lower bound for returned candles. */
  from?: string;
  /** ISO timestamp upper bound for returned candles. */
  to?: string;
  /** Maximum number of candles to request. */
  limit?: number;
}

export interface PriceCandle {
  bucket: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
}

/** @deprecated Use {@link PriceCandle} instead. */
export type PriceHistoryEntry = PriceCandle;

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

export interface AccuracyLeaderboardParams {
  period?: '7d' | '30d' | 'allTime';
  /** 1-100. Defaults to 20 server-side. */
  limit?: number;
  /** Platform-native page number. Takes precedence over offset when supplied. */
  page?: number;
  /** Zero-based row offset. Converted to the platform page/limit contract. */
  offset?: number;
  /** Reserved for future cursor pagination. The current API is page-based. */
  cursor?: string;
}

export interface AccuracyLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  pnl: string;
  winRate: string;
  tradeCount: number;
}

export interface SystemHealthPublic {
  status: string;
  service?: string;
  version?: string;
  uptime?: number;
}

export interface SystemHealthAuthenticated extends SystemHealthPublic {
  db?: {
    connections?: number;
    status?: string;
  };
  redis?: {
    memoryUsageMb?: number;
    status?: string;
  };
  queueDepth?: number;
  services?: Record<string, unknown>;
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
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
}

export interface BatchResponse {
  results: Array<{
    id: string;
    status: number;
    body: unknown;
  }>;
}

// ── Actions Catalog ────────────────────────────────────────────────────────

export interface ActionParameter {
  name: string;
  type: string;
  required: boolean;
  in?: 'path' | 'query' | 'body';
  description?: string;
  enum?: string[];
  default?: unknown;
  max?: number;
  min?: number;
}

export interface ActionDefinition {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  scope: 'READ' | 'WRITE' | 'TRADE';
  category: string;
  parameters?: ActionParameter[];
}

export interface ActionsSchema {
  version: string;
  actions: ActionDefinition[];
}

// ── Strategy capability discovery ───────────────────────────────────────────

export type StrategyCapabilityCategory =
  | 'triggers'
  | 'conditions'
  | 'actions'
  | 'safety'
  | 'logicBlocks'
  | 'calcBlocks'
  | string;

export interface StrategyCapability {
  type: string;
  label?: string;
  description?: string;
  category?: StrategyCapabilityCategory;
  configSchema?: Record<string, unknown>;
  examples?: unknown[];
  [key: string]: unknown;
}

export interface StrategyCapabilities {
  version?: string;
  capabilities: Record<string, StrategyCapability[]>;
  [key: string]: unknown;
}

export interface StrategyDesignPattern {
  name: string;
  description?: string;
  useCases?: string[];
  blocks?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StrategyDesignPatterns {
  version?: string;
  patterns: StrategyDesignPattern[];
  [key: string]: unknown;
}

export interface StrategyExample {
  name: string;
  description?: string;
  strategy?: Record<string, unknown>;
  blocks?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StrategyExamples {
  version?: string;
  examples: StrategyExample[];
  [key: string]: unknown;
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

// ── Markets — extended data ──────────────────────────────────────────────────

export interface MarketSearchResult {
  results: unknown[];
}

export interface TickSizeResult {
  tokenId: string;
  tickSize: string;
  feeRate: string;
}

export interface SpreadResult {
  tokenId: string;
  spread: string;
}

export interface MidpointResult {
  tokenId: string;
  midpoint: string;
}

export interface ClobBook {
  tokenId: string;
  bids: unknown[];
  asks: unknown[];
  spread: string;
  midpoint: string;
  timestamp: number;
}

export interface ClobPricesHistoryResult {
  tokenId: string;
  interval: string;
  history: unknown[];
}

// ── Orders — bulk ────────────────────────────────────────────────────────────

export interface BatchPlaceOrdersResult {
  results: Array<{ orderId: string; intentId: string; status: string }>;
}

export interface BulkCancelOrdersResult {
  cancelled: string[];
  errors: Array<{ orderId: string; reason: string }>;
}

// ── News — articles ──────────────────────────────────────────────────────────

export type NewsSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  imageUrl: string | null;
  sentiment: NewsSentiment;
  publishedAt: string;
  signals?: NewsSignal[];
}

// ── Scores — extended ────────────────────────────────────────────────────────

export interface TopTraderEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  score: number;
  winRate: string;
  totalTrades: number;
}

export interface TraderBadge {
  id: string;
  userId: string;
  type: string;
  name: string;
  earnedAt: string;
}

// ── Portfolio — Polymarket ───────────────────────────────────────────────────

export interface PolymarketPortfolioEntry {
  asset: string;
  size: string;
  avgPrice: string;
  realizedPnl: string;
  unrealizedPnl: string;
}

export interface PolymarketEarningsEntry {
  date: string;
  earnings: string;
  volume: string;
  winRate: string;
}

export interface PolymarketActivity {
  id: string;
  type: string;
  amount: string;
  asset: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface GetPolymarketActivityParams {
  type?: 'TRADE' | 'SPLIT' | 'MERGE' | 'REDEEM' | 'REWARD' | 'CONVERSION' | 'MAKER_REBATE' | 'REFERRAL_REWARD';
  offset?: number;
  limit?: number;
}

// ── Rewards ────────────────────────────────────────────────────────────────

export interface RewardsMarket {
  conditionId: string;
  rewardsDaily: string;
  rewardsMaxSpread: string;
  rewardsMinSize: string;
  startDate: string;
  endDate: string;
}

export interface UserReward {
  date: string;
  amount: string;
  market: string;
}

export interface UserRewardsTotal {
  total: string;
  byDate: Array<{ date: string; amount: string }>;
}

export interface UserRewardsPercentages {
  [conditionId: string]: number;
}

export interface Rebate {
  date: string;
  amount: string;
  feesPaid: string;
}

export interface RewardsMarketDetail {
  conditionId: string;
  rate_per_day: string;
  total_rewards: string;
  remaining_reward_amount: string;
  max_spread: string;
  min_size: string;
  start_date?: string;
  end_date?: string;
}

export interface UserSponsoredMarkets {
  markets: Array<Record<string, unknown>>;
}

export interface RewardsSponsorUrl {
  url: string;
}

// ── Cross-Venue Arbitrage ──────────────────────────────────────────────────

export interface CrossVenueOpportunity {
  matchId: string;
  polymarketId: string;
  kalshiId: string;
  polymarketTitle: string;
  kalshiTitle: string;
  polymarketYesPrice: number;
  kalshiYesPrice: number;
  spread: number;
  recommendedAction: string;
  estimatedProfit: number;
}

export interface CrossVenueComparison {
  matchId: string;
  polymarket: {
    id: string;
    title: string;
    yesPrice: number;
    noPrice: number;
    liquidity: number;
  };
  kalshi: {
    id: string;
    title: string;
    yesPrice: number;
    noPrice: number;
    liquidity: number;
  };
  spread: number;
  updatedAt: string;
}

export interface MarketMatch {
  id: string;
  polymarketId: string;
  kalshiId: string;
  verified: boolean;
  similarity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarketMatchParams {
  polymarketId: string;
  kalshiId: string;
}

export interface SyncMatchesResult {
  matched: number;
  created?: number;
  updated?: number;
}

export interface VenuePriceInfo {
  marketId?: string;
  title?: string;
  yesBid?: number;
  noAsk?: number;
}

export interface SpreadSummary {
  matchId: string;
  polymarket?: VenuePriceInfo;
  kalshi?: VenuePriceInfo;
  yesSpreadPct: number;
  noSpreadPct?: number;
  confidence: number;
  verified: boolean;
}

export interface ArbitrageAlertSubscription {
  id: string;
  minSpreadPct: number;
  marketId?: string;
  active: boolean;
  triggeredAt?: string;
  createdAt: string;
}

export interface CreateArbitrageAlertParams {
  minSpreadPct: string;
  marketId?: string;
}

// ── Cross-Venue Arb Execution / Positions / Risk (POLA-1850) ────────────────
//
// Trading-impact surface: `executeArb` and `closeArbPosition` place real orders
// on Polymarket and Kalshi. Both endpoints are rate-limited to 5 requests per
// minute per user (HTTP 429 on exceed). `closeArbPosition` uses sweep semantics:
// GTC orders priced at extreme tick boundaries (0.001 SELL / 0.999 BUY) behave
// as market-order sweeps — slippage is bounded only by venue depth, not by the
// on-paper price. `matchId` is UUID-validated server-side. Backend error codes
// (VENUES_NOT_CONNECTED, MATCH_NOT_FOUND, COMPARISON_UNAVAILABLE,
// SPREAD_TOO_LOW, TOKEN_RESOLUTION_FAILED, ARB_POSITION_NOT_FOUND,
// INVALID_STATUS) are passed through verbatim via `PolyforgeError.code`.

export type ArbPositionStatus =
  | 'PENDING'
  | 'PARTIAL'
  | 'OPEN'
  | 'CLOSING'
  | 'CLOSED'
  | 'FAILED';

export type Venue = 'POLYMARKET' | 'KALSHI' | 'POLYMARKET_US';

export interface ArbExecuteParams {
  matchId: string;
  /** Position size in USDC, applied to both legs. Server bounds: 1..10000. */
  size: number;
  /** Max acceptable slippage % from quoted prices (default 0.5). Server bounds: 0..5. */
  maxSlippagePct?: number;
}

export interface ArbExecutionLeg {
  venue: Venue;
  intentId: string;
  tokenId: string;
  price: number;
}

export interface ArbExecutionResult {
  arbPositionId: string;
  buyLeg: ArbExecutionLeg;
  sellLeg: ArbExecutionLeg;
  entrySpreadPct: number;
  status: ArbPositionStatus;
}

/**
 * Cross-venue arbitrage position. Decimal fields are serialized as strings
 * by the API to preserve precision — parse with `Number()` only when arithmetic
 * is needed.
 */
export interface ArbPosition {
  id: string;
  userId: string;
  matchId: string;
  status: ArbPositionStatus;

  buyVenue: Venue;
  buyOrderId: string | null;
  buyTokenId: string;
  buyPrice: string;
  buySize: string;
  buyFillPrice: string | null;
  buyFillSize: string | null;

  sellVenue: Venue;
  sellOrderId: string | null;
  sellTokenId: string;
  sellPrice: string;
  sellSize: string;
  sellFillPrice: string | null;
  sellFillSize: string | null;

  entrySpreadPct: string;
  currentSpreadPct: string | null;
  realizedPnl: string | null;
  unrealizedPnl: string | null;

  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArbPositionsResponse {
  positions: ArbPosition[];
  total: number;
}

export interface ArbCloseResponse {
  status: 'CLOSING';
  positionId: string;
}

export interface ArbRiskDashboard {
  openPositions: number;
  pendingPositions: number;
  totalDeployed: number;
  netExposure: { polymarket: number; kalshi: number };
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  avgSpreadPct: number;
  /** Counts keyed by `ArbPositionStatus`. Status keys not present have count 0. */
  positionsByStatus: Partial<Record<ArbPositionStatus, number>>;
}

export interface ArbSettlementRisk {
  matchId: string;
  polymarketTitle: string;
  kalshiTitle: string;
  polymarketEndDate: string | null;
  kalshiEndDate: string | null;
  endDateDiffDays: number | null;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
}

export interface ArbPnlRefreshResult {
  updated: number;
}

// ── Whale Alert Filter ──────────────────────────────────────────────────────

export interface WhaleAlertFilter {
  id: string;
  userId: string;
  minSize?: string;
  marketIds?: string[];
  walletAddresses?: string[];
  sides?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertWhaleAlertFilterParams {
  minSize?: string;
  marketIds?: string[];
  walletAddresses?: string[];
  sides?: ('BUY' | 'SELL')[];
  active?: boolean;
}

// ── Public Profile ──────────────────────────────────────────────────────────

export interface PublicProfile {
  id: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  createdAt: string;
}

export interface UpdateProfileParams {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface ChangePasswordParams {
  currentPassword: string;
  newPassword: string;
}

export interface FollowResult {
  following: boolean;
  followersCount: number;
}

// ── Public User Profile Lookups ─────────────────────────────────────────────

/** Single point on a public user's PnL curve. Date is `YYYY-MM-DD`. */
export interface UserPerformancePoint {
  date: string;
  pnl: number;
  cumPnl: number;
}

/** Public summary of one of a user's strategies. */
export interface UserStrategySummary {
  id: string;
  name: string;
  description: string;
  winRate: number;
  tradeCount: number;
  priceUsdc: number;
  forkCount: number;
  likeCount: number;
  isLiked: boolean;
}

/** Resolved-position activity entry shown on a user's profile. */
export interface UserActivityEntry {
  id: string;
  marketQuestion: string;
  outcome: string;
  side: string;
  size: number;
  pnl: number;
  resolvedAt: string;
}

/** Badge entry returned by the public-profile endpoint (id is the badge type). */
export interface UserProfileBadge {
  id: string;
  unlockedAt: string;
}

/** Pared-down user record returned by `me/following`. */
export interface FollowedUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface GetMyFollowingParams {
  page?: number;
  /** 1-100. Defaults to 20 server-side. */
  limit?: number;
}

// ── Settings ────────────────────────────────────────────────────────────────

export interface UpdateSettingsProfileParams {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  twitterHandle?: string;
}

/**
 * Notification settings as exposed by `GET/PATCH /api/v1/settings/notifications`.
 *
 * Mirrors the platform `UpdateNotificationsDto`
 * (`services/api-service/src/settings/dto/update-notifications.dto.ts`):
 * three channel toggles (`emailEnabled`, `telegramEnabled`, `discordEnabled`)
 * plus per-event toggles named `onXxx`. The platform's global
 * `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` rejects
 * any field not listed here with HTTP 400 — so this interface must stay an
 * exact mirror of the DTO. (closes #191)
 */
export interface NotificationSettings {
  emailEnabled?: boolean;
  telegramEnabled?: boolean;
  discordEnabled?: boolean;
  onOrderFilled?: boolean;
  onStrategyError?: boolean;
  onBacktestComplete?: boolean;
  onDailyLossLimit?: boolean;
  onMarketResolved?: boolean;
  onSomeoneForked?: boolean;
  onSomeoneFollowed?: boolean;
  onSomeoneLiked?: boolean;
  onSomeoneCommented?: boolean;
}

export type UpdateNotificationSettingsParams = Partial<NotificationSettings>;

/**
 * Notification preferences for `PATCH /api/v1/profile/notifications`.
 *
 * Mirrors the platform `UpdateProfileNotificationsDto`
 * (`services/api-service/src/profile/dto/update-profile-notifications.dto.ts`):
 * three channel toggles (`emailEnabled`, `telegramEnabled`, `discordEnabled`)
 * plus per-event toggles and `onTicketReply`. The platform uses
 * `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` and
 * rejects unknown fields with HTTP 400 — keep this type in sync with the
 * platform DTO. (closes #237)
 */
export interface ProfileNotificationPreferences {
  emailEnabled?: boolean;
  telegramEnabled?: boolean;
  discordEnabled?: boolean;
  onOrderFilled?: boolean;
  onStrategyError?: boolean;
  onBacktestComplete?: boolean;
  onDailyLossLimit?: boolean;
  onMarketResolved?: boolean;
  onSomeoneForked?: boolean;
  onSomeoneFollowed?: boolean;
  onSomeoneLiked?: boolean;
  onSomeoneCommented?: boolean;
  onTicketReply?: boolean;
}

export type UpdateProfileNotificationsParams = Partial<ProfileNotificationPreferences>;

export interface ChangePasswordSettingsParams {
  currentPassword: string;
  newPassword: string;
}

export interface BetaUsage {
  requestsToday: number;
  requestsThisMonth: number;
  dailyLimit: number;
  monthlyLimit: number;
  rateLimitPerMinute: number;
  tier: string;
}

export interface GasUsage {
  totalSpent: string;
  transactionCount: number;
  averageGasPrice: string;
  breakdown: Array<{ type: string; amount: string; count: number }>;
}

export interface UserPreferences {
  defaultVenue: string;
  enabledVenues: string[];
  singlePlatformMode: boolean;
}

export interface UpdateUserPreferencesParams {
  defaultVenue?: string;
  enabledVenues?: string[];
  singlePlatformMode?: boolean;
}

// ── Support Tickets ─────────────────────────────────────────────────────────

export type TicketCategory = 'GENERAL' | 'BILLING' | 'TECHNICAL' | 'ACCOUNT' | 'BUG' | 'FEATURE_REQUEST';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'AWAITING_USER' | 'AWAITING_ADMIN' | 'CLOSED';

export interface CreateTicketParams {
  subject: string;
  body: string;
  category?: TicketCategory;
  priority?: TicketPriority;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  body: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AddTicketMessageParams {
  body: string;
}

// ── Notification Preferences ────────────────────────────────────────────────

export type NotificationChannel = 'inApp' | 'email' | 'push';

export interface EventNotificationPreferences {
  [eventType: string]: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
}

export interface UpdateEventNotificationsParams {
  preferences: EventNotificationPreferences;
}

// ── Misc Public Utility Endpoints (POLA-1856) ───────────────────────────────

/** Pagination filter accepted by `GET /api/v1/feed`. */
export interface FeedQueryParams {
  /** Numeric string lower bound on whale-trade notional, e.g. "10000". */
  minSize?: string;
  marketId?: string;
  walletAddress?: string;
  side?: 'BUY' | 'SELL';
  page?: number;
  /** 1–100. Defaults to 20 server-side. */
  limit?: number;
}

/** Pagination + mood filter accepted by `GET /api/v1/journal`. */
export type JournalMood =
  | 'CONFIDENT'
  | 'UNCERTAIN'
  | 'FOMO'
  | 'DISCIPLINED'
  | 'REVENGE';

export interface JournalQueryParams {
  page?: number;
  /** 1–100. Defaults to 20 server-side. */
  limit?: number;
  mood?: JournalMood;
}

/** A row in the journal page (orders that have been annotated with a mood). */
export interface JournalEntry {
  id: string;
  marketId: string;
  mood: JournalMood | string | null;
  note: string | null;
  side: string;
  outcome: string;
  price: string;
  size: string;
  status: string;
  createdAt: string;
}

/** Body for `PATCH /api/v1/orders/:id/journal`. */
export interface UpdateOrderJournalParams {
  mood: JournalMood;
  /** Optional free-text note, up to 2000 chars. */
  note?: string;
}

/** Pagination filter accepted by `GET /api/v1/notifications`. */
export interface ListNotificationsParams {
  page?: number;
  /** 1–100. Defaults to 20 server-side. */
  limit?: number;
}

/** A row in the notification history page. */
export interface NotificationHistoryEntry {
  id: string;
  userId: string;
  channel: string;
  eventType: string;
  title: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  sentAt: string;
}

/** Response shape for `GET /api/v1/referrals/me`. */
export interface MyReferrals {
  referralCode: string;
  referralLink: string;
  stats: {
    invited: number;
    signedUp: number;
    active: number;
    creditsEarned: number;
  };
  referrals: Array<Record<string, unknown>>;
}

/** Body for `POST /api/v1/fees/preview`. */
export interface FeePreviewParams {
  tokenId: string;
  side: 'BUY' | 'SELL';
  /** Order size (contracts). */
  size: number;
  /** Order price (0.001–0.999). */
  price: number;
  /** Optional order type, e.g. "POST_ONLY" to flag maker. */
  orderType?: string;
}

/** Per-venue fee estimate returned by the preview endpoint. */
export interface VenueFeeEstimate {
  venue: string;
  feeBps: number;
  feeUsd: number;
  totalCostUsd: number;
  isMaker: boolean;
}

/** Response shape for `POST /api/v1/fees/preview`. */
export interface FeePreviewResult {
  polymarket: VenueFeeEstimate;
  kalshi: VenueFeeEstimate | null;
  savings: number;
  recommendedVenue: string;
  marketMatch: { matchId: string; confidence: number } | null;
}

/** Single Polymarket fee schedule row. */
export interface PolymarketFeeScheduleEntry {
  category: string | null;
  role: string;
  feeBps: number;
  effectiveAt: string;
}

/** Single Kalshi fee schedule row. */
export interface KalshiFeeScheduleEntry {
  role: string;
  feeBps: number;
  minPrice: number | null;
  maxPrice: number | null;
  effectiveAt: string;
}

/** Response shape for `GET /api/v1/fees/schedules`. */
export interface FeeSchedules {
  polymarket: PolymarketFeeScheduleEntry[];
  kalshi: KalshiFeeScheduleEntry[];
}

/** A single per-market price alert. */
export interface MarketAlert {
  id: string;
  marketId: string;
  outcome: string;
  condition: 'above' | 'below' | string;
  threshold: number;
  triggered: boolean;
  createdAt: string;
}

/** Body for `POST /api/v1/markets/:marketId/alerts`. */
export interface CreateMarketAlertParams {
  outcome: 'YES' | 'NO' | 'Yes' | 'No';
  condition: 'above' | 'below';
  /** 0.01–0.99. */
  threshold: number;
}

/**
 * Period filter accepted by `GET /api/v1/markets/:marketId/history`.
 *
 * Recommended maximum request windows:
 * - `1d`: use for intraday views.
 * - `7d`: default short-term window.
 * - `30d`: medium-term trend window.
 * - `90d`: longest currently supported market-history window.
 *
 * For candle APIs that expose explicit intervals, keep windows bounded around
 * `1m` <= 7 days, `5m` <= 30 days, `1h` <= 1 year, and `1d` <= 10 years.
 */
export type MarketHistoryPeriod = '1d' | '7d' | '30d' | '90d';

/** Single bucket in the per-market history series. */
export interface MarketHistoryEntry {
  timestamp: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
}

/** Response shape for `GET /api/v1/markets/:marketId/history`. */
export interface MarketHistory {
  data: MarketHistoryEntry[];
}

export type MarketSentimentVoteDirection = 'YES' | 'NO';

/** Request body for `POST /api/v1/markets/:marketId/sentiment`. */
export interface VoteMarketSentimentParams {
  direction: MarketSentimentVoteDirection;
  confidence: number;
}

/** Authenticated user's vote inside a market sentiment report. */
export interface MarketSentimentVote {
  direction: MarketSentimentVoteDirection;
  confidence: number;
}

/** Response shape for `GET /api/v1/markets/:marketId/sentiment`. */
export interface MarketSentimentReport {
  yesPercent: number;
  noPercent: number;
  totalVotes: number;
  userVote: MarketSentimentVote | null;
}

/** Query filter accepted by `GET /api/v1/markets/combo/collections`. */
export interface ListComboCollectionsParams {
  seriesTicker?: string;
  limit?: number;
  cursor?: string;
}

/** A single Kalshi multivariate (combo) collection. */
export interface ComboCollection {
  collection_ticker: string;
  title: string;
  category: string;
  status: string;
  markets_count: number;
  series_ticker?: string;
}

/** Page shape for `GET /api/v1/markets/combo/collections`. */
export interface ComboCollectionsPage {
  collections: ComboCollection[];
  cursor: string;
}

/** Single leg of a combo lookup request. */
export interface ComboLookupLeg {
  ticker: string;
  outcome: 'yes' | 'no';
}

/** Body for `POST /api/v1/markets/combo/lookup`. */
export interface ComboLookupParams {
  collectionTicker: string;
  legs: ComboLookupLeg[];
}

/** Response shape for `POST /api/v1/markets/combo/lookup`. */
export interface ComboTickerLookup {
  event_ticker: string;
  market_ticker: string;
}

export type ComboMarketLookup = ComboTickerLookup;

/** Response shape for `GET /api/v1/analytics/correlation/categories`. */
export interface CorrelationCategoriesReport {
  categories: string[];
  matrix: number[][];
  updatedAt: string;
}

// ── Sports (POLA-1841) ──────────────────────────────────────────────────────
//
// Server contract is intentionally permissive: many of the underlying payloads
// originate from upstream Kalshi proxies and are forwarded as `Record<string,
// unknown>` / `unknown[]` by the API. The SDK mirrors that fidelity rather
// than inventing strict types that would drift the moment the server changes.

export type SportsCategoryKey =
  | 'NFL'
  | 'NBA'
  | 'MLB'
  | 'NHL'
  | 'SOCCER'
  | 'TENNIS'
  | 'GOLF'
  | 'F1'
  | 'UFC'
  | 'BOXING'
  | 'COLLEGE_FOOTBALL'
  | 'COLLEGE_BASKETBALL'
  | 'CRICKET'
  | 'OTHER'
  | (string & {});

export interface SportsCategorySummary {
  category: SportsCategoryKey;
  label: string;
  seriesTickers: string[];
  marketCount: number;
}

export type SportsMarketsSort = 'volume' | 'closing_soon' | 'newest';

export interface ListSportsMarketsParams {
  page?: number;
  limit?: number;
  category?: SportsCategoryKey;
  search?: string;
  seriesTicker?: string;
  eventTicker?: string;
  liveOnly?: boolean;
  sort?: SportsMarketsSort;
}

export type SportsEventStatus =
  | 'SCHEDULED'
  | 'PREGAME'
  | 'LIVE'
  | 'HALFTIME'
  | 'FINAL';

export interface ListSportsEventsParams {
  page?: number;
  limit?: number;
  category?: SportsCategoryKey;
  seriesTicker?: string;
  status?: SportsEventStatus;
}

export interface SportsEventDetail {
  event: Record<string, unknown>;
  markets: Record<string, unknown>[];
}

export interface ListSportsMilestonesParams {
  page?: number;
  limit?: number;
  eventTicker?: string;
  status?: string;
}

export interface SportsMilestonesPage {
  milestones: unknown[];
  cursor: string | null;
}

export interface SportsLiveData {
  liveData: unknown | null;
}

export interface ListSportsCombosParams {
  page?: number;
  limit?: number;
  seriesTicker?: string;
}

export interface SportsComboCollection {
  collectionTicker: string;
  title: string;
  description: string;
  markets: unknown[];
}

export interface SportsCombosPage {
  collections: unknown[];
  cursor: string | null;
}

export type SportsComboSide = 'yes' | 'no';

export interface SportsComboSelection {
  marketTicker: string;
  eventTicker: string;
  side: SportsComboSide;
}

export interface LookupSportsComboParams {
  collectionTicker: string;
  selectedMarkets: SportsComboSelection[];
}

export interface SportsComboLookupResult {
  eventTicker: string;
  marketTicker: string;
}

// ── GDPR Personal Data Export ───────────────────────────────────────────────

/** Top-level JSON response shape for `GET /api/v1/me/export`. */
export interface PersonalDataExport {
  generatedAt: string;
  formatVersion: string;
  _meta: { collectionsTruncated: string[]; maxRecordsPerCollection: number };
  account: Record<string, unknown>;
  settings: Record<string, unknown>;
  security: Record<string, unknown>;
  trading: Record<string, unknown>;
  communications: Record<string, unknown>;
  social: Record<string, unknown>;
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
