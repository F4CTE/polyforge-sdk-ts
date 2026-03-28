# Changelog

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
