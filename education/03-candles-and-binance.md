# 3. Storing Candles & Importing from Binance

Now the heart of the service: keeping price history and filling it with real data.

## The MarketCandle model (`prisma/schema.prisma`)

```prisma
model MarketCandle {
  id        BigInt   @id @default(autoincrement())
  coinId    String   @db.Uuid
  coin      Coin     @relation(fields: [coinId], references: [id], onDelete: Cascade)
  timeframe String
  openTime  DateTime
  open      Decimal  @db.Decimal(20, 8)
  high      Decimal  @db.Decimal(20, 8)
  low       Decimal  @db.Decimal(20, 8)
  close     Decimal  @db.Decimal(20, 8)
  volume    Decimal  @db.Decimal(30, 8)

  @@unique([coinId, timeframe, openTime])
  @@index([coinId, timeframe, openTime])
  @@map("market_candles")
}
```

Key decisions explained:

- **`id BigInt @default(autoincrement())`** — there will be *millions* of candles,
  so we use a fast auto-counting big number instead of a random UUID here. (UUIDs
  are great for users, overkill and bigger for huge time-series.)
- **`Decimal(20, 8)` for prices, not a normal number** — money must be **exact**.
  Regular floating-point numbers (`Float`) have tiny rounding errors (e.g.
  `0.1 + 0.2` isn't exactly `0.3`). `Decimal` stores the exact value with 8
  decimal places. **Never store money as a float.**
- **`@@unique([coinId, timeframe, openTime])`** — a coin can have only **one**
  candle per timeframe per start-time. This is what lets us import the same range
  twice without making duplicates (see below).
- **`@@index([...])`** — makes "give me BTC's 1h candles in time order" fast (like
  a book's index).

> **TimescaleDB note:** price history is *time-series* data. In production we run
> PostgreSQL with the **TimescaleDB** extension and turn `market_candles` into a
> "hypertable", which makes huge time-range queries much faster. Locally we use
> plain PostgreSQL (a normal indexed table) so it runs anywhere. The switch is a
> one-line database change later — our code doesn't change.

## The Binance client (`market/binance.client.ts`)

Binance offers free price data. We ask for "klines" (their word for candles):

```ts
const url = `${baseUrl}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
const response = await fetch(url);
...
return rows.map((row) => ({
  openTime: new Date(Number(row[0])),
  open: String(row[1]), high: String(row[2]),
  low: String(row[3]), close: String(row[4]), volume: String(row[5]),
}));
```

- `fetch` is built into modern Node — it makes an HTTP request to Binance.
- Binance returns each candle as a plain **array** `[openTime, open, high, low,
  close, volume, ...]`. We map those positions into named fields so the rest of
  our code is readable. (`row[0]` is a millisecond timestamp → we turn it into a
  real `Date`.)
- A coin's Binance trading pair is its symbol + `USDT` (e.g. `BTC` → `BTCUSDT`).

## Importing & storing (`market.service.ts`)

```ts
async importCandles(symbol, timeframe, limit = 500) {
  this.assertTimeframe(timeframe);                 // only 1m..1w allowed
  const coin = await this.coins.findBySymbol(symbol);
  const raw = await fetchBinanceKlines(baseUrl, `${coin.symbol}USDT`, timeframe, limit);

  const result = await this.prisma.marketCandle.createMany({
    data: raw.map((c) => ({ coinId: coin.id, timeframe, ...c })),
    skipDuplicates: true,
  });
  return { imported: result.count };
}
```

- `assertTimeframe` rejects anything outside our list with a `400` (clean error,
  not a crash).
- `createMany({ ..., skipDuplicates: true })` inserts many rows in one go and —
  thanks to our unique rule — **silently skips candles we already have**. So you
  can re-import the same range safely; only genuinely new candles are added.
  (Historical candles never change once closed, so "insert new, ignore existing"
  is exactly right.)

## Reading candles — and two sneaky serialization traps

```ts
const rows = await this.prisma.marketCandle.findMany({
  where: { coinId: coin.id, timeframe },
  orderBy: { openTime: "desc" },
  take: Math.min(Math.max(limit, 1), 1000),
  select: { openTime: true, open: true, high: true, low: true, close: true, volume: true },
});
return rows.map((r) => ({ openTime: r.openTime, open: r.open.toString(), ... }));
```

Two important details:

1. **We `select` only the safe fields — not `id`.** Why? The `id` is a `BigInt`,
   and JavaScript **cannot turn a BigInt into JSON** by default (it throws!). By
   not selecting it, and by turning the `Decimal` prices into **strings** with
   `.toString()`, the JSON response is clean and exact. (Sending prices as strings
   also avoids any rounding when the browser reads them.)
2. **`take: Math.min(Math.max(limit, 1), 1000)`** — clamp the requested count
   between 1 and 1000, so nobody can ask for a million rows and overload us.

## What we verified live (with real data!)

`POST /market/import` for BTC 1h actually fetched **50 real candles** from Binance
and stored them. `GET /market/candles` returned them newest-first (a real BTC
price), `GET /market/latest` gave the most recent one, and a bad timeframe
returned `400`. Real market data, flowing. ✅

## Recap

- Candles are **OHLCV** rows; we store them with an exact **`Decimal`** type and a
  **unique** key per coin/timeframe/time.
- We **import** real candles from Binance and `createMany(skipDuplicates)` so
  re-imports never duplicate.
- Reading **avoids the BigInt-in-JSON trap** (don't select `id`) and returns prices
  as **strings** for exactness.
- Time-series data becomes a **TimescaleDB hypertable** in production — a database
  change, not a code change.

## Update — deep history by paging backwards (added later) 📜

**Why we changed it.** The version above fetches candles in **one** Binance
request. But Binance caps a single klines request at **1000 candles** — and to
build and *trust* trading strategies we need **years** of history (many bull and
bear markets), not just the last few hundred bars. A strategy that looks great on
6 months of one market mood can fall apart in the next. So we taught the importer
to go deeper.

**What it was → what it became.**

- **Was:** `fetchBinanceKlines(...)` did a single request; `importCandles` stored
  that one batch (≤1000). Reading was clamped to `...1000`.
- **Became:** the importer **pages backwards** through history. Binance lets you
  pass an `endTime` — "give me candles ending at this moment". So we fetch a batch,
  look at the **oldest** candle we got, then ask for the next batch ending 1ms
  *before* that, and repeat — walking back in time until we've collected the number
  we asked for or Binance runs out of history.

```ts
// binance.client.ts — new optional endTime, to page backwards
const endParam = endTimeMs != null ? `&endTime=${endTimeMs}` : "";
const url = `${baseUrl}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}${endParam}`;

// market.service.ts — loop until we have `limit` candles or history runs out
let remaining = limit, endTimeMs;
while (remaining > 0) {
  const batch = await fetchBinanceKlines(baseUrl, pair, timeframe, Math.min(1000, remaining), endTimeMs);
  if (batch.length === 0) break;
  collected.push(...batch);
  remaining -= batch.length;
  const earliest = Math.min(...batch.map((c) => c.openTime.getTime()));
  endTimeMs = earliest - 1;                 // next page ends just before this batch
  if (batch.length < batchSize) break;      // fewer than asked = start of history
  if (remaining > 0) await sleep(200);      // be polite to the public API
}
```

**Three matching changes so the deep data is usable:**

1. **Import limit raised** — the request DTO's `limit` max went from **1000 →
   20000** (the service pages the API under the hood, so a caller can ask for
   thousands at once).
2. **Read cap raised** — `getCandles` clamp went **1000 → 5000**, otherwise we'd
   *store* years of candles but only be able to *read back* 1000 of them (the
   backtest engine needs the full range).
3. **`skipDuplicates` still protects us** — paging can re-fetch an overlapping
   candle at a page boundary; the unique key quietly drops the repeat.

**Why 1ms before, and why stop on a short batch?** Subtracting 1ms makes each new
page end *just before* the oldest candle we already have, so pages butt up against
each other with no gap and minimal overlap. And when Binance returns **fewer**
candles than we asked for, there's simply no older history left — so we stop.

**Verified live:** deep-importing daily candles pulled BTC all the way back to
**2017-08-17** (3254 candles) and filled 2–9 years for every one of the 10 coins —
enough to test strategies across the 2018 bear, 2021 bull, and 2022 crash. That
deep history is what makes an honest walk-forward success rate possible (see the
backtest service's walk-forward lesson).

Back to the [index](README.md).
