# Changelog

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
