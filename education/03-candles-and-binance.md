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

Back to the [index](README.md).
