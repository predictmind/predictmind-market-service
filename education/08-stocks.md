# 8. Stocks — One Platform, Two Markets

Until now PredictMind only knew **crypto** (data from Binance). This step adds the
**stock market** too — so the exact same charts, backtests, paper trading, and
strategy bots work on Apple, Microsoft, the S&P 500, and more. The trick: the rest
of the platform doesn't care *what* a symbol is — it just reads candles. So if the
market service can fetch stock candles, **everything downstream works for stocks for
free.**

## The one idea: symbol-agnostic candles

Every part of PredictMind reads the same thing — a list of candles for a symbol +
timeframe. The backtest engine, the charts, the paper exchange, the bots: none of
them ask "is this crypto or a stock?" They just crunch candles. So adding stocks is
really one job: **get stock candles into the same `market_candles` table.**

## Marking a symbol's market: `assetClass`

We added one column to the `Coin` table:

```prisma
model Coin {
  ...
  assetClass String @default("CRYPTO")  // "CRYPTO" or "STOCK"
}
```

- **What/why:** it tells the importer *where* to fetch candles from — Binance for
  crypto, Yahoo for stocks. A plain string with a default means every existing coin
  row stays valid (they become "CRYPTO" automatically) — a safe, additive change.
- We seed a starter set of stocks on startup (AAPL, MSFT, GOOGL, AMZN, NVDA, META,
  TSLA, SPY, QQQ). You can add any Yahoo symbol later with `POST /coins` and
  `assetClass: "STOCK"` (e.g. `RELIANCE.NS` for India's NSE — that's why the symbol
  rule now allows dots).

> **Applying the new column.** Like the other schema changes, run `prisma db push`
> once against the `market` schema so the `assetClass` column exists. The service's
> Prisma client is regenerated from `schema.prisma` at build time, so the build/CI
> don't need a database — only a running deployment does.

## The free stock data source (`stock.client.ts`)

We use **Yahoo Finance's public chart API** — free, **no API key**:

```text
GET https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=max
```

- **Why Yahoo?** It's free and returns both **intraday and daily** OHLCV in one JSON
  call. (Truly-official stock feeds cost money; the user asked us to use free
  sources where paid would otherwise be needed — this is exactly that compromise.)
- **One call, no paging.** Unlike Binance (max 1000 candles per request, so we page
  backwards), Yahoo returns the whole range at once. We then keep the most recent
  `limit` bars.
- **Timeframe mapping.** Our timeframes map to Yahoo's: `1h → 60m`, `1w → 1wk`, and
  `1m/5m/15m/1d` pass through. Yahoo has **no 4h** for stocks, so we reject `4h` with
  a clear message (crypto still supports 4h via Binance).
- **Gaps.** Stocks don't trade nights/weekends/holidays, so Yahoo returns `null` for
  those slots — we skip them.
- **User-Agent.** Yahoo blocks requests with no browser-like `User-Agent`, so we send
  one. If Yahoo ever changes its API, only this one file needs updating.

## Where the branch happens (`market.service.ts`)

`importCandles` now checks the coin's `assetClass`:

```ts
if (coin.assetClass === "STOCK") {
  const rows = await fetchYahooKlines(coin.symbol, timeframe, limit);   // Yahoo
  // store rows in market_candles (same table as crypto)
} else {
  // existing Binance paged import
}
```

Reading candles (`getCandles`), the latest price (`getLatest`), charts, backtests,
paper fills, and bots are **all unchanged** — they already work on whatever is in
`market_candles`. That's the payoff of the symbol-agnostic design.

## How to load stock data

Same endpoint as crypto — just use a stock symbol that's registered as `STOCK`:

```text
POST /api/v1/market/import   { "symbol": "AAPL", "timeframe": "1d", "limit": 2000 }
```

Then it shows up on the Charts tab (filter: Stocks), and you can backtest or
paper-trade it exactly like a coin.

## Honest notes

- Yahoo's chart API is **unofficial** — great for research and paper trading, but for
  real-money production you'd switch to a licensed feed (only this file changes).
- Some crypto-specific signals (funding, open interest, on-chain, BTC-regime) don't
  apply to stocks; stock strategies simply use price/indicator rules (SMA, EMA, RSI,
  breakout, etc.), which are market-neutral.

Next: [price alerts](09-price-alerts.md), then the [glossary](10-glossary.md).
