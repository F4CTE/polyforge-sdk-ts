# Changelog

## [1.19.1] — 2026-04-14

### Security
- **SSE buffer cap** — `watchStrategy()` now enforces a `MAX_SSE_BUFFER_SIZE` (1 MB) on the internal SSE read buffer. A malicious or misconfigured server sending a single event larger than 1 MB will cause the stream to throw a `PolyforgeError` (`STREAM_ERROR`) instead of consuming unbounded memory. (closes #43)

## [1.19.0] — 2026-04-14

### Added
- **Quick backtest** — `runQuickBacktest(params)` covering POST `/api/v1/backtests/quick` for synchronous backtest execution. (closes #58)
- **Backtest orders** — `getBacktestOrders(id)` covering GET `/api/v1/backtests/:id/orders` to retrieve orders generated during a backtest. (closes #58)

## [1.18.0] — 2026-04-14

### Added
- **Strategy social endpoints** — `likeStrategy(id)`, `listStrategyComments(id, params?)`, `addStrategyComment(id, content)`, `deleteStrategyComment(strategyId, commentId)`, `listStrategyChildren(id)`, `reportStrategy(id, reason, description?)` covering POST/GET/DELETE on `/api/v1/strategies/:id/like|comments|children|report`. (closes #54)
- **Strategy versioning endpoints** — `listStrategyVersions(id)`, `rollbackStrategy(id, versionId)` covering GET `/api/v1/strategies/:id/versions` and POST `/api/v1/strategies/:id/versions/:versionId/rollback`. (closes #54)
- **Strategy event log** — `getStrategyEventLog(id, params?)` covering GET `/api/v1/strategies/:id/event-log` with optional `limit` query param. (closes #54)
- New exported types: `StrategyComment`, `StrategyChild`, `StrategyLikeResult`, `StrategyReportReason`, `StrategyReportResult`, `StrategyVersion`, `StrategyRollbackResult`, `StrategyEventLogEntry`.

## [1.17.0] — 2026-04-14

### Added
- **API key management** — `listApiKeys()`, `createApiKey()`, `revokeApiKey()` methods covering GET/POST/DELETE `/api/v1/api-keys`. New exported types: `ApiKey`, `ApiKeyScope`, `CreateApiKeyParams`, `CreateApiKeyResponse`. The `token` field is only available in the `createApiKey` response (shown once, never retrievable again). (closes #53)
- **CSV export methods** — `exportOrdersCsv()` and `exportPortfolioCsv()` for GET `/api/v1/orders/export/csv` and GET `/api/v1/portfolio/export/csv`. Returns raw CSV string. Adds internal `requestText()` helper for non-JSON responses. (closes #55)

## [1.16.0] — 2026-04-14

### Breaking Changes
- **`TraderScore`**: Now wraps the response as `{ score: TraderScoreData | null, breakdown: TraderScoreBreakdown | null }` to match GET `/api/v1/scores/me`. Access score fields via `result.score.score`, `result.score.winRate`, etc. New exported types: `TraderScoreData`, `TraderScoreBreakdown`, `TraderScoreComponent`. Removed phantom `rank` field, added `avgReturn`. Decimal fields (`winRate`, `sharpeRatio`, etc.) are now typed as `string` matching Prisma serialization. (closes #102)
- **`WhaleTrade`**: `timestamp` renamed to `detectedAt` (matches Prisma `WhaleAlert` model). `size`, `price`, `notional` changed from `number` to `string` (Prisma Decimal serialization). Added `txHash: string | null` and nested `market` object. (closes #104)
- **`NewsSignal`**: Removed top-level `headline` and `source` (these live on the nested `article` object). Added `reasoning`, nested `article` and `market` objects. `outcome` is now required, not optional. (closes #105)
- **`PortfolioPnl`**: Replaced `dailyPnl`/`weeklyPnl`/`monthlyPnl`/`realizedPnl`/`unrealizedPnl`/`history` with `snapshots: Array<{time, pnl}>`, `totalPnl: string`, `winRate: string` to match GET `/api/v1/portfolio/pnl`. (closes #106)

### Unchanged
- **`AiQueryResponse`**: Verified correct — already matches POST `/api/v1/ai/query` response (`query`, `intent`, `filters`, `data`, `summary`). Issue #103 was a false positive from cross-SDK comparison. (closes #103)

## [1.15.0] — 2026-04-13

### Added
- `getPriceHistory(tokenId, params?)`: GET `/api/v1/markets/:tokenId/price-history` with optional `resolution`, `from`, `to`, `limit` query params (closes #52)
- `getOrderBook(tokenId)`: GET `/api/v1/markets/:tokenId/book` returning bids and asks (closes #52)
- Types: `PriceHistoryParams`, `PriceHistoryEntry`, `OrderBookLevel`, `OrderBook`

## [1.14.0] — 2026-04-13

### Added
- `getWatchlist()`: list all markets on the user's watchlist (closes #56)
- `addToWatchlist(marketId)`: add a market to the watchlist (closes #56)
- `removeFromWatchlist(marketId)`: remove a market from the watchlist (closes #56)
- `getWatchlistStatus(marketId)`: check if a market is on the watchlist (closes #56)
- `deleteWebhook(id)`: delete a webhook by ID (closes #57)
- `testWebhook(id)`: send a test delivery to a webhook (closes #57)
- Types: `WatchlistItem`, `WatchlistStatus`, `WatchlistAddResult`, `WebhookTestResult`

## [1.13.0] — 2026-04-13

### Added
- `getConditionalOrder(id)`: GET a single conditional order by ID (closes #65)
- `cancelConditionalOrder(id)`: DELETE/cancel a conditional order by ID (closes #65)
- `getPortfolioPnl()`: add optional `period` (`'7d' | '30d' | '90d' | 'allTime'`) and `strategyId` query parameters (closes #19)
- `PortfolioPnlParams` type for PnL query filtering

## [1.12.0] — 2026-04-13

### Added
- `listMarkets()`: add `sort` and `closed` query parameters matching platform `MarketQueryDto` (closes #74)
- `listStrategies()`: add `sort`, `page`, and `limit` query parameters matching platform `StrategyQueryDto` (closes #79)
- `getOrders()`: add `marketId` and `page` query parameters matching platform `OrderQueryDto` (closes #75)
- `listBacktests()`: add `strategyId`, `status`, `page`, `limit` query parameters matching platform `BacktestQueryDto` (closes #72)
- `listConditionalOrders()`: add `status`, `type`, `page`, `limit` query parameters matching platform `ConditionalOrderQueryDto` (closes #73)

## [1.11.0] — 2026-04-13

### Fixed
- **BREAKING** `TraderScore`: replace `overall` with `score`, remove `profitability`/`riskManagement`/`volume`/`percentile`, add `totalTrades`/`winRate`/`sharpeRatio`/`profitFactor`/`maxDrawdown` to match platform scoring entity (closes #18)
- **BREAKING** `WhaleTrade`: rename `wallet` → `walletAddress`, `usdValue` → `notional`, remove `marketName` (not returned), add `tokenId`/`outcome`/`price` (closes #18)
- **BREAKING** `NewsSignal`: replace `sentiment` (BULLISH/BEARISH/NEUTRAL) with `direction` (BUY/SELL), replace `relatedMarkets: string[]` with `marketId: string`, rename `publishedAt` → `createdAt`, add optional `outcome`/`articleId` (closes #18)
- **BREAKING** `AiQueryResponse`: replace `{ answer, confidence, sources, suggestedActions }` with `{ query, intent, filters, data, summary }` to match platform AI query response shape (closes #18)
- **BREAKING** `Order`: rename `type` → `orderType`, remove `marketName` (not returned), add `tokenId`/`outcome`/`intentId` (closes #18)
- **BREAKING** `Position`: remove `marketName` (not returned), add `tokenId`/`outcome` (closes #18)
- **BREAKING** `SplitPositionParams`: replace `{ tokenId, size, price }` with `{ tokenId, amount }` (string decimal) to match platform `SplitPositionDto` (closes #24)
- **BREAKING** `MergePositionParams`: replace `{ tokenIds: string[] }` with `{ tokenId, amount }` (string decimal) to match platform `MergePositionDto` (closes #24)
- **BREAKING** `Strategy`: replace flat `blocks: StrategyBlock[]` with categorized `triggers`/`conditions`/`actions`/`safety`/`logicBlocks`/`calcBlocks` arrays; add `visibility`/`execMode`/`tickMs`/`tags`/`variables`/`canvas` fields (closes #31)
- **BREAKING** `createStrategy()`: expand params from `{ name, description?, marketId? }` to full `CreateStrategyParams` with all 15+ fields matching platform `CreateStrategyDto` (closes #32)
- `UpdateStrategyParams`: expand to include categorized block arrays, visibility, execMode, tickMs, tags, variables, canvas, marketSlots
- `ImportStrategyPayload`: replace flat `blocks` with categorized block arrays

### Added
- `CreateStrategyParams` type for full strategy creation matching platform DTO
- `StrategyVisibility` type: `'PRIVATE' | 'PUBLIC' | 'UNLISTED'`
- `StrategyExecMode` type: `'TICK' | 'EVENT' | 'HYBRID'`
- `StrategyVariable` interface for strategy variable definitions
- `MarketSlot` interface for market slot bindings

## [1.10.0] — 2026-04-13

### Security
- **SSE null-body guard**: replace `response.body!` non-null assertion with explicit null check that throws `PolyforgeError` with code `STREAM_ERROR` — prevents unhandled `TypeError` crash when a proxy or HTTP/1.0 server returns a null body (closes #16)

### Fixed
- **BREAKING** `Market`: rename `name` to `title`, replace `baseToken`/`quoteToken` with `tokens: Token[]` array, add optional `description`, `endDate`, `resolved` fields to match platform Prisma schema (closes #17)
- **BREAKING** `Token`: replace `{ symbol, name, address, decimals, logoUrl? }` with `{ id, outcome?, price? }` to match platform Token entity (closes #17)
- **BREAKING** `OrderType`: replace exchange-style values (`MARKET | LIMIT | STOP | STOP_LIMIT`) with platform prediction-market values (`GTC | GTD | FOK | FAK`) — fixes type mismatches on `Order.type` and removes misleading exports (closes #36)
- **BREAKING** `RunBacktestParams`: make `strategyId` optional, make `dateRangeStart`/`dateRangeEnd` optional, add `quickMode`, `strategyBlocks`, `marketBindings` optional fields to match platform `CreateBacktestDto` (closes #14)
- Confirm `CreateAlertParams` already matches platform `CreateAlertDto` (closes #12)
- Confirm `CreateConditionalOrderParams` already matches platform DTO (closes #13)

## [1.9.0] — 2026-04-13

### Fixed
- **BREAKING** `ConditionalOrderStatus`: add `FAILED` value to match platform's 5-value enum (closes #37)
- **BREAKING** `CreateAlertParams`: replace `{ name, condition, marketId? }` with `{ tokenId, direction, price, persistent? }` to match platform `CreateAlertDto` — old fields caused 422 errors (closes #48)
- **BREAKING** `Alert`: response type updated to match — `name`/`condition`/`marketId` replaced by `tokenId`/`direction`/`price`/`persistent` (closes #48)
- **BREAKING** `CreateConditionalOrderParams`: add required `tokenId`, `type`, `outcome` fields; change `limitPrice` from `number` to `string` (NumberString); add optional `trailingPct` and `expiresAt` (closes #49)
- **BREAKING** `ConditionalOrder`: response type updated with new fields `tokenId`, `type`, `outcome`, `trailingPct`, `expiresAt`; `limitPrice` changed to `string` (closes #49)
- **BREAKING** `CopyConfig`: rename `sourceWallet` → `targetWallet`, remove `label`/`maxPositionSize`/`totalCopiedTrades`, add `mode`/`sizeValue`/`maxExposure`/`maxDailyLoss`/`priceOffset` to match platform (closes #50)

### Added
- `ConditionalOrderType` type: `'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'LIMIT' | 'PEGGED'`
- `CopyMode` type: `'PERCENTAGE' | 'FIXED' | 'MIRROR'`

## [1.8.0] — 2026-04-13

### Fixed
- **BREAKING** `ProvideLiquidityParams`: replace `{ tokenId, spread, size }` with `{ marketId, size }` to match platform `ProvideLiquidityDto` (closes #25)
- **BREAKING** `RedeemPositionParams`: replace `{ tokenId, conditionId }` with `{ positionId?, marketId? }` to match platform `RedeemDto` (closes #26)
- **BREAKING** `ImportStrategyParams`: replace `{ data: StrategyExport }` with `{ polyforge, exportedAt?, strategy }` to match platform import DTO; body is now sent directly without wrapping (closes #27)
- **BREAKING** `ClosePositionParams.size`: change from `number` to `string` (NumberString) to match platform (closes #28)
- **BREAKING** `OrderStatus`: replace 5-value enum (`OPEN | FILLED | PARTIALLY_FILLED | CANCELLED | FAILED`) with platform's 12-value enum (`PENDING | SUBMITTED | LIVE | MATCHED | DELAYED | MINED | CONFIRMED | PARTIAL | CANCELLED | UNMATCHED | FAILED | ERROR`) (closes #29)
- **BREAKING** `StrategyStatus`: add `ERROR` and `ARCHIVED` to match platform's 6-value enum (closes #30)
- **BREAKING** `Order`: monetary fields `price`, `size`, `fillSize`, `fillPrice`, `fee` changed from `number` to `string` for decimal precision; renamed `filledSize` → `fillSize`, `filledPrice` → `fillPrice`, added `fee` field (closes #33)
- **BREAKING** `Position`: monetary fields `size`, `avgPrice`, `currentPrice`, `unrealizedPnl`, `realizedPnl` changed from `number` to `string`; renamed `entryPrice` → `avgPrice` (closes #33)

### Added
- `ImportStrategyPayload` interface for the strategy object inside import params

## [1.7.1] — 2026-04-13

### Fixed
- `PolyforgeError`: add optional `suggestion` field to capture platform error response hints that help users fix common issues; the field is extracted from the JSON error body `suggestion` property (closes #89)

## [1.7.0] — 2026-04-13

### Fixed
- **BREAKING** Strategy lifecycle methods (`startStrategy`, `stopStrategy`, `pauseStrategy`, `resumeStrategy`): return `StrategyStatusResponse` instead of `Strategy` — the platform returns `{"status":"RUNNING"}` not a full strategy object; callers accessing `strategy.name` etc. got `undefined` (closes #61)
- **BREAKING** List endpoints (`listStrategies`, `getOrders`, `listBacktests`, `listConditionalOrders`, `getWhaleFeed`, `getNewsSignals`, `listAlerts`, `listCopyConfigs`, `listWebhooks`, `getStrategyTemplates`, `listSmartOrders`): return `PaginatedResponse<T>` instead of `T[]` — the platform wraps all list responses in `{"data":[...],"total":N,...}` (closes #78)

## [1.6.9] — 2026-04-13

### Fixed
- **BREAKING** `PlaceSmartOrderParams`: rename `intervalSeconds` back to `intervalMinutes` to match platform `PlaceSmartOrderDto` — TWAP/DCA orders had `intervalSeconds` silently stripped, falling back to default interval (closes #88, regression of #62)

## [1.6.8] — 2026-04-13

### Fixed
- **BREAKING** `aiQuery()`: send `{ query }` instead of `{ question }` to match platform `AiQueryDto` — AI queries were returning HTTP 400 (closes #84, regression of #46)
- **BREAKING** `createStrategyFromDescription()`: send `{ description }` instead of `{ query }` to match platform `CreateFromDescriptionDto` — AI strategy creation was returning HTTP 400 (closes #85, regression of #40)
- **BREAKING** `WebhookEvent`: change values from dot.notation (`order.filled`) to SCREAMING_SNAKE_CASE (`ORDER_FILLED`) to match platform `CreateWebhookDto` validation — webhook creation was returning HTTP 400 (closes #86, regression of #42)
- **BREAKING** `startStrategy()`: send lowercase `mode` (`"live"`, `"paper"`) instead of uppercase — strategy start was returning HTTP 400 (closes #87, regression of #41)

## [1.6.7] — 2026-04-12

### Fixed
- **BREAKING** `PlaceSmartOrderParams`: rename `intervalMinutes` to `intervalSeconds` to match platform contract — TWAP/DCA orders were executing 60x too fast (closes #62)
- `RunBacktestParams`: remove phantom `initialBalance` field that is silently stripped by the platform's `CreateBacktestDto` (closes #64)

## [Unreleased]

### Security
- **SSRF DNS rebinding prevention**: `createWebhook()` now resolves hostnames to IP addresses via DNS (A + AAAA) before checking the SSRF blocklist — prevents attackers from pointing a domain at an internal IP to bypass hostname-only validation; literal IPs skip DNS; unresolvable domains are rejected; documents that server must validate independently (closes #45, closes #39)

### Security
- Extend HTTPS enforcement to cover all loopback representations (`[::1]`, `0.0.0.0`, `127.0.0.x`, `localhost.localdomain`) — previously only `localhost` and `127.0.0.1` were exempted, allowing credential leakage over HTTP on non-standard local addresses (closes #71)

### Security
- **StrategyEventType**: replace `| string` catch-all with `| (string & {})` to preserve TypeScript autocomplete; add `KNOWN_STRATEGY_EVENTS` set and runtime `console.warn` for unrecognized SSE event types (closes #80)

### Security
- **CI**: switch from self-hosted runner to `ubuntu-latest` for `pull_request` events and add `permissions: contents: read` to restrict GITHUB_TOKEN scope (closes #69)
- **deps**: add npm `overrides` to pin `vite >= 8.0.5`, fixing 3 HIGH advisories (GHSA-4w7w-66w2-5vf9, GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583) in transitive vitest dependency (closes #68)

## [1.6.5] — 2026-04-12

### Security
- **Default base URL changed to production** — `https://localhost:3002` → `https://api.polyforge.app`; prevents TLS failures that encourage `NODE_TLS_REJECT_UNAUTHORIZED=0` workarounds (closes #44)
- **API key serialisation guards** — added `toJSON()` and `[Symbol.for('nodejs.util.inspect.custom')]()` to `PolyforgeClient` to prevent API key leakage via `JSON.stringify()` or `util.inspect()` (closes #38)
- **Financial parameter validation** — `placeOrder()`, `placeSmartOrder()`, `provideLiquidity()` now validate that size/price/spread/totalSize are finite positive numbers before sending to the API; rejects `NaN`, `Infinity`, negative, and zero values (closes #34)
- **Separate stream timeout** — added `streamTimeout` option (default: 24 hours) for SSE streams; `watchStrategy()` no longer killed by the 15-second request timeout (closes #35)

## [1.6.4] — 2026-04-05

### Fixed
- **CRITICAL SSRF bypass**: `isBlockedHost` now strips brackets from IPv6 hostnames before calling `net.isIPv6()` — previously `URL.hostname` returned bracketed addresses making the entire IPv6 validation branch unreachable (closes #15)
- **BREAKING**: `aiQuery()` sends `{ question }` instead of `{ query }` to match platform `AiQueryDto` (closes #46)
- **BREAKING**: `RunBacktestParams` uses `dateRangeStart`/`dateRangeEnd` instead of `startDate`/`endDate` to match platform (closes #47)
- **BREAKING**: `WebhookEvent` values reverted from SCREAMING_SNAKE_CASE to dot.notation to match actual platform events (closes #42)
- **BREAKING**: `createStrategyFromDescription()` sends `{ query }` instead of `{ description }` to match platform (closes #40)
- **BREAKING**: `startStrategy()` sends uppercase `"LIVE"`/`"PAPER"` mode values to match platform (closes #41)
- Removed duplicate type imports that prevented build

## [1.6.3] — 2026-04-03

### Added
- Missing platform endpoints: backtests (list, get, run), portfolio PnL, conditional orders (list, create), alert CRUD (create, delete) (closes #8)

## [1.6.2] — 2026-04-03

### Fixed
- **SSRF blocklist**: replaced naive hostname-only check with comprehensive `isBlockedHost()` validation covering IPv4 loopback (127.0.0.0/8), RFC 1918 ranges (10/8, 172.16/12, 192.168/16), link-local (169.254/16), CGNAT (100.64/10), IPv6 loopback (::1), IPv6 unique-local (fc00::/7), IPv6 link-local (fe80::/10), IPv4-mapped IPv6 (::ffff:*), reserved TLDs (.local, .internal, .localhost), and trailing-dot bypass (closes #6)
- **BREAKING**: `WebhookEvent` values changed from dot-notation (`'order.filled'`, `'strategy.error'`, etc.) to SCREAMING_SNAKE_CASE (`'ORDER_FILLED'`, `'STRATEGY_ERROR'`, etc.) to match the values the platform actually sends; the previous 11 dot-notation values are replaced by the 8 canonical event types: `ORDER_FILLED`, `STRATEGY_ERROR`, `WHALE_TRADE`, `NEWS_SIGNAL`, `BACKTEST_COMPLETE`, `DAILY_LOSS_LIMIT`, `MARKET_RESOLVED`, `PRICE_ALERT` (closes #7)

## [1.6.1] — 2026-03-30

### Fixed
- `MarketSentiment` interface: renamed `label` → `direction` to match the actual API response field (`direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'`)

## [1.6.0] — 2026-03-30

### Added
- `getAccuracy()` — `GET /api/v1/accuracy/me`; returns `AccuracyScore` with Brier score, win rate, calibration buckets array, and per-category breakdown
- `getPortfolioReview()` — `GET /api/v1/ai/portfolio-review`; returns `PortfolioReview` with AI-generated review text, suggestions list, and score (1–10)
- `getMarketSentiment(marketId)` — `GET /api/v1/news/sentiment/:marketId`; returns `MarketSentiment` with score (−100 to +100) and BULLISH / BEARISH / NEUTRAL label
- `provideLiquidity(params)` — `POST /api/v1/lp/provide`; accepts `ProvideLiquidityParams`; returns `LpPosition` with buy and sell order IDs
- New types: `AccuracyScore`, `PortfolioReview`, `MarketSentiment`, `ProvideLiquidityParams`, `LpPosition`

## [1.5.0] — 2026-03-30

### Added
- `getArbitrageOpportunities(minMargin?)` — `GET /api/v1/arbitrage`; returns `ArbitrageOpportunity[]`
- `placeSmartOrder(params)` — `POST /api/v1/orders/smart`; supports TWAP, DCA, BRACKET, OCO types
- `listSmartOrders()` — `GET /api/v1/orders/smart`; returns `SmartOrder[]` with child order progress
- `cancelSmartOrder(id)` — `DELETE /api/v1/orders/smart/:id`
- `browseMarketplace(params?)` — `GET /api/v1/marketplace`; supports `sort`, `tag`, `limit`, `offset`
- `getMarketplaceListing(id)` — `GET /api/v1/marketplace/:id`
- `purchaseStrategy(listingId)` — `POST /api/v1/marketplace/:id/purchase`; returns `MarketplacePurchaseResult`
- New types: `ArbitrageOpportunity`, `SmartOrderType`, `SmartOrderStatus`, `PlaceSmartOrderParams`, `SmartOrderChildOrder`, `SmartOrder`, `PlaceSmartOrderResponse`, `MarketplaceListing`, `MarketplacePurchaseResult`, `BrowseMarketplaceParams`

## [1.4.0] — 2026-03-29

### Fixed
- `getScore()` path corrected: `/api/v1/score` → `/api/v1/scores/me`
- `getWhaleFeed()` path corrected: `/api/v1/whale-feed` → `/api/v1/whales/feed`
- `getNewsSignals()` path corrected: `/api/v1/news-signals` → `/api/v1/news/signals`
- `listCopyConfigs()` path corrected: `/api/v1/copy-configs` → `/api/v1/copy`

### Added
- `updateStrategy(id, params)` — `PATCH /api/v1/strategies/:id`
- `deleteStrategy(id)` — `DELETE /api/v1/strategies/:id`
- `importStrategy(params)` — `POST /api/v1/strategies/import`
- `pauseStrategy(id)` — `POST /api/v1/strategies/:id/pause`
- `resumeStrategy(id)` — `POST /api/v1/strategies/:id/resume`
- `forkStrategy(id)` — `POST /api/v1/strategies/:id/fork`
- `closePosition(params)` — `POST /api/v1/orders/close-position`
- `redeemPosition(params)` — `POST /api/v1/orders/redeem`
- `splitPosition(params)` — `POST /api/v1/orders/split`
- `mergePosition(params)` — `POST /api/v1/orders/merge`
- `getOrders()` now accepts `strategyId`, `from`, `to` filter params
- New types: `UpdateStrategyParams`, `ImportStrategyParams`, `ClosePositionParams`, `RedeemPositionParams`, `SplitPositionParams`, `MergePositionParams`

## [1.3.0] — 2026-03-29

### Added
- `watchStrategy(id, signal?)` — `AsyncGenerator<StrategyEvent>` that streams live execution events from the strategy SSE endpoint; handles connection close, abort signals, and malformed frames gracefully
- `StrategyEvent` interface — `{ type, strategyId, data, timestamp }`
- `StrategyEventType` union type covering all known event types (`CONNECTED`, `STRATEGY_*`, `ORDER_*`, `BACKTEST_*`)
- Both types exported from the package root (`index.ts`)

## [1.2.1] — 2026-03-28

### Fixed
- `placeOrder()` path corrected from `/orders/place` to `/api/v1/orders/place`
- `cancelOrder()` path corrected from `/orders/{id}` to `/api/v1/orders/{id}`; added `encodeURIComponent` on the order ID

## [1.2.0] — 2026-03-28

### Fixed
- Align all API paths to canonical `/api/v1/*` pattern matching backend
- Fix strategy endpoint: `/strategies/generate` → `/api/v1/strategies/from-description`
- Change default URL from `https://api.polyforge.io/v1` to `http://localhost:3002`

### Added
- Smoke tests for client instantiation, URL construction, error class (vitest)

## [1.1.0] — 2026-03-27

### Added
- `placeOrder()` — place direct buy/sell orders
- `cancelOrder()` — cancel pending or live orders
- `PlaceOrderParams`, `PlaceOrderResponse`, `CancelOrderResponse` types

## [1.0.0] — 2026-03-27

### Added
- Initial release — typed REST client for Polyforge API
- 20 methods covering markets, strategies, portfolio, orders, whale feed, news, webhooks, AI
- Dual ESM/CJS exports
- `PolyforgeError` class with status, code, requestId
