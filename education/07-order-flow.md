# 7. Order-Flow: Capturing Who's Buying (signal #1)

## Why this step exists

In [lesson 3](03-candles-and-binance.md) we saved each candle's **OHLCV** (open,
high, low, close, volume). That was the first look. But "volume" alone doesn't tell
you a key thing: of all that trading, **how much was aggressive buying vs aggressive
selling?** That's called **order-flow**, and it's the **#1 extra signal** in our
precision roadmap (docs 07 §16.6). This lesson adds it. Lesson 3 stays as-is — this
is a new field layered on top.

## The insight: it was in the data all along

When we ask Binance for candles, each row is actually longer than we used:

```text
[ openTime, open, high, low, close, volume, closeTime, quoteVolume,
  numberOfTrades(8), takerBuyBaseVolume(9), takerBuyQuoteVolume(10), ignore ]
```

We were only reading the first six. Index **9** is the **taker buy volume** — the
part of the volume that came from **takers** (people who hit the market and bought
*now*, the aggressive buyers). Index **8** is the **number of trades**. We were
throwing these away! So capturing them costs us **nothing extra** — same request,
we just stop ignoring two useful numbers.

New words:
- **Taker** — someone who takes the current price immediately (aggressive). The
  opposite is a **maker**, who posts an order and waits.
- **Taker buy volume** — how much of the candle's volume was aggressive buying.
- **Buy ratio** = takerBuyVolume ÷ volume. Above 0.5 means more aggressive buying
  than selling — **net buying pressure**.

## The code changes

### 1. Read the extra fields (`binance.client.ts`)

```ts
return rows.map((row) => ({
  openTime: new Date(Number(row[0])),
  open: String(row[1]),
  // ...
  volume: String(row[5]),
  trades: Number(row[8]),          // NEW
  takerBuyVolume: String(row[9]),  // NEW
}));
```

We just added two lines to grab indices 8 and 9.

### 2. Store them (`prisma/schema.prisma`)

```prisma
model MarketCandle {
  // ...existing fields...
  takerBuyVolume Decimal? @db.Decimal(30, 8)
  trades         Int?
}
```

- **The `?` makes them optional (nullable).** This is important: candles we saved
  **before** this change don't have the values, and that's fine — they stay valid
  as `null`. New imports fill them in. (Adding a *nullable* column is a safe,
  non-breaking database change.)

### 3. Save and serve them

- The **import** now includes `takerBuyVolume` and `trades` when saving candles.
- The **candles endpoint** returns them (as a string / number, or `null` for old
  rows).

> **Gotcha we accepted:** our importer uses "skip duplicates", so it won't *back-fill*
> taker data onto candles we already stored — only new candles get it. To test
> immediately we imported a **fresh timeframe** (BTC 4h) so every row had the field.
> Back-filling old rows would be a separate one-off job.

## Who uses it?

The **backtest service** reads these fields and offers an `order_flow` rule
condition (buy ratio, optionally smoothed) — so a strategy can say "only buy when
aggressive buyers are in control." See the backtest service's rule-engine lesson.

## What we verified ✅

- Build + lint + 18 tests green.
- Live: imported BTC 4h and a candle came back with
  `takerBuyVolume: 320.49` out of `volume: 665.42` (≈48% buy pressure) and
  `trades: 37376`. Real order-flow data, captured for free.

Next: the [glossary](08-glossary.md).
