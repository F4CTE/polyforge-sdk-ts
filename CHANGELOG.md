# Changelog

## [1.6.4] — 2026-04-05

### Fixed
- **CRITICAL SSRF bypass**: `isBlockedHost` now strips brackets from IPv6 hostnames before calling `net.isIPv6()` — previously `URL.hostname` returned bracketed addresses (e.g. `[::1]`) which `isIPv6` rejected, making the entire IPv6 validation branch unreachable (closes #15)

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
