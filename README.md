# @polyforge/sdk

Official TypeScript SDK for the **Polyforge** trading platform REST API. Zero dependencies -- uses the native `fetch` API available in Node.js 18+.

## Installation

```bash
npm install @polyforge/sdk
```

## Quick Start

```typescript
import { PolyforgeClient } from '@polyforge/sdk';

const client = new PolyforgeClient({ apiKey: 'pf_live_...' });

// List DeFi markets
const markets = await client.listMarkets({ category: 'defi', limit: 10 });
console.log(markets.data);

// Create and start a strategy
const strategy = await client.createStrategy({ name: 'Mean Reversion BTC' });
await client.startStrategy(strategy.id, 'paper');
```

## Configuration

```typescript
const client = new PolyforgeClient({
  apiKey: 'pf_live_...',       // Required -- your Polyforge API key
  apiUrl: 'https://...',       // Optional -- defaults to http://localhost:3002
  timeout: 30_000,             // Optional -- request timeout in ms (default: 15000)
});
```

## API Reference

### Markets

| Method | Description |
|--------|-------------|
| `listMarkets(params?)` | List markets with search, category filter, and pagination |
| `getMarket(id)` | Get a single market by ID |

### Strategies

| Method | Description |
|--------|-------------|
| `listStrategies(params?)` | List your strategies, optionally filter by status |
| `getStrategy(id)` | Get a strategy by ID |
| `createStrategy(params)` | Create a blank strategy |
| `createStrategyFromDescription(params)` | AI-generate a strategy from natural language |
| `startStrategy(id, mode?)` | Start a strategy (`'live'` or `'paper'`) |
| `stopStrategy(id)` | Stop a running strategy |
| `getStrategyTemplates()` | List community strategy templates |
| `exportStrategy(id)` | Export a strategy as portable JSON |
| `watchStrategy(id, signal?)` | Stream live execution events via SSE |

### Live Execution Watching

`watchStrategy` returns an `AsyncGenerator<StrategyEvent>` that yields events as they arrive over a persistent SSE connection. The first event is always `{ type: 'CONNECTED' }`.

```typescript
const ac = new AbortController();

for await (const event of client.watchStrategy('strat-uuid', ac.signal)) {
  switch (event.type) {
    case 'ORDER_FILLED':
      console.log('Filled at', event.data?.price);
      break;
    case 'BACKTEST_PROGRESS':
      console.log('Progress:', event.data?.progress, '%');
      break;
    case 'STRATEGY_STOPPED':
    case 'BACKTEST_COMPLETED':
      ac.abort(); // clean up
      break;
  }
}
```

Stop the stream at any time by calling `ac.abort()`. The generator will clean up the underlying fetch connection automatically.

**Common event types:** `CONNECTED` · `STRATEGY_STARTED` · `STRATEGY_STOPPED` · `STRATEGY_ERROR` · `ORDER_PLACED` · `ORDER_FILLED` · `ORDER_CANCELLED` · `BACKTEST_PROGRESS` · `BACKTEST_COMPLETED` · `BACKTEST_FAILED`

### Portfolio & Orders

| Method | Description |
|--------|-------------|
| `getPortfolio()` | Get portfolio summary with positions |
| `getOrders(params?)` | List orders with optional filters |
| `getScore()` | Get your trader score and ranking |
| `placeOrder(params)` | Place a direct buy/sell order |
| `cancelOrder(orderId)` | Cancel a pending or live order |

### Social & Signals

| Method | Description |
|--------|-------------|
| `getWhaleFeed(params?)` | Real-time whale trade feed |
| `getNewsSignals(params?)` | AI-generated news sentiment signals |

### Configuration

| Method | Description |
|--------|-------------|
| `listAlerts()` | List configured price/event alerts |
| `listCopyConfigs()` | List copy-trading configurations |
| `listWebhooks()` | List registered webhooks |
| `createWebhook(params)` | Register a new webhook endpoint |

### AI

| Method | Description |
|--------|-------------|
| `aiQuery(query)` | Ask the Polyforge AI assistant a question |
| `getPortfolioReview()` | AI-generated portfolio review with suggestions and score (1–10) |

### Accuracy & Liquidity

| Method | Description |
|--------|-------------|
| `getAccuracy()` | Brier score, win rate, calibration buckets, and per-category breakdown |
| `getMarketSentiment(marketId)` | Sentiment score (−100 to +100) and BULLISH / BEARISH / NEUTRAL label |
| `provideLiquidity(params)` | Post liquidity; returns `LpPosition` with buy and sell order IDs |

## Error Handling

All API errors throw a `PolyforgeError` with structured fields:

```typescript
import { PolyforgeClient, PolyforgeError } from '@polyforge/sdk';

const client = new PolyforgeClient({ apiKey: 'pf_live_...' });

try {
  await client.getStrategy('nonexistent');
} catch (err) {
  if (err instanceof PolyforgeError) {
    console.error(err.status);     // 404
    console.error(err.code);       // "STRATEGY_NOT_FOUND"
    console.error(err.message);    // "Strategy not found"
    console.error(err.requestId);  // "req_abc123" (for support)
  }
}
```

Timeout errors surface as native `AbortError` from the Fetch API.

## TypeScript

All request parameters and response types are fully typed and exported:

```typescript
import type {
  Market,
  Strategy,
  PaginatedResponse,
  AccuracyScore,
  PortfolioReview,
  MarketSentiment,
  ProvideLiquidityParams,
  LpPosition,
} from '@polyforge/sdk';
```

## Testing

```bash
npm test
```

Runs vitest for unit tests covering client instantiation, URL construction, and error handling.

## License

MIT
