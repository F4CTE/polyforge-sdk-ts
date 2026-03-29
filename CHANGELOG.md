# Changelog

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
