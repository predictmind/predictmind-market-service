# 7. Extra Precision Signals (Order-Flow, Funding, …)

This lesson grows as we add "extra signals" from the precision roadmap
(docs 07 §16.6), **one at a time, in importance order**. Each is added as its own
section below so you can follow the journey.

## Signal #1 — Order-Flow: Capturing Who's Buying

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

## Signal #2 — Funding rate: what the leveraged crowd is doing 💸

**Funding rate** comes from **perpetual futures** (a kind of leveraged contract).
Every ~8 hours, one side pays the other to keep the contract's price near the real
price:

- **Positive funding** → longs pay shorts → the crowd is **heavily long** (often
  over-optimistic; can precede a pullback).
- **Negative funding** → shorts pay longs → the crowd is **heavily short**.

So funding is a **crowd-positioning / sentiment gauge**. It's one of the most
watched signals in crypto.

> **Important:** we trade **spot only**. We use funding purely as a **signal** to
> inform spot buys/sells — we never trade the leveraged contract itself.

### Where it comes from

Funding lives on Binance's **futures** API (`fapi.binance.com`), separate from the
spot klines. We added a tiny client (`fetchBinanceFunding`) and a config value
`BINANCE_FUTURES_API_URL`.

### How we store it

A new table, `funding_rates`:

```prisma
model FundingRate {
  id          String   @id @default(uuid()) @db.Uuid
  coinSymbol  String
  fundingRate Decimal  @db.Decimal(12, 8)
  fundingTime DateTime
  @@unique([coinSymbol, fundingTime])   // no duplicates on re-import
}
```

- Keyed by **symbol + time** (funding is a market-wide series, not tied to one
  candle). The `@@unique` makes re-imports **idempotent**.
- Endpoints: `POST /market/funding/import` and `GET /market/funding?symbol=&limit=`
  (returned oldest-first so consumers can line it up with candles).

### The tricky bit: lining funding up with candles

Funding updates every ~8 hours, but candles can be 1h or 4h. So which funding value
applies to a given candle? **The most recent funding at or before the candle's
time.** The backtest service does this with an efficient **two-pointer walk** over
both time-sorted lists, attaching `fundingRate` to each candle. Then a rule can say:

```jsonc
{ "type": "funding", "op": "lt", "value": 0.00005 }   // "crowd not over-long"
```

If a candle has no funding yet, the condition is simply `false` (safe).

### Verified ✅

- Build + lint + 18 market tests / 29 backtest tests green.
- Live: imported 500 BTC funding points (real rates ≈ 0.006%), and a funding-based
  rule backtest on BTC 4h ran with funding correctly aligned to candles.

## Signal #3 — Open interest: conviction behind a move 📊

**Open interest (OI)** is the total size of all open futures positions. It answers
"how much money is *in* this move?":

- **Rising OI + rising price** → new money entering → **conviction** (strong move).
- **Rising OI + falling price** → new shorts piling in.
- **Falling OI** → positions closing → a move may be running out of steam.

Like funding, it's a **signal only** — we trade spot, not the futures.

### Where it comes from & how we store it

Binance's futures **open-interest history** endpoint
(`/futures/data/openInterestHist`) needs a **`period`** (matching a candle
timeframe like `4h`) and only keeps ~**30 days** of history. We added
`fetchBinanceOpenInterest`, an `open_interest` table (keyed by
**symbol + timeframe + timestamp**), and endpoints `POST /market/oi/import` and
`GET /market/oi?symbol=&timeframe=&limit=`.

Because OI history is per-timeframe, we store the `timeframe` on each row — unlike
funding, which is one series per symbol.

### How it's used

The backtest aligns OI to candles (same two-pointer trick as funding) and offers an
**`oi_change`** rule condition — the **percent change** of OI over a lookback:

```jsonc
{ "type": "oi_change", "period": 1, "op": "gt", "value": 2 }   // OI up >2% = conviction
```

Rising OI is more meaningful than the raw level, so we compare the *change*.

### Verified ✅

- Live: imported 180 BTC 4h OI points (~30 days; real values ≈ 98–100k). An
  OI-conviction backtest on BTC 4h did **+6.1% vs buy&hold −2.0% with a 77% win
  rate** in-sample — promising, though it still must prove itself **out-of-sample**
  before we trust it (that's the methodology rule).

## Signal #4 — Long/short ratio: what the crowd is betting 👥

The **long/short ratio** is the share of futures **accounts** positioned long vs
short. Ratio 2.0 means twice as many accounts are long as short. It's mainly a
**contrarian** gauge: when *everyone* is long, there's little new buying left and a
pullback often follows ("the crowd is usually wrong at extremes").

Signal only — we trade spot.

### Source & storage

Binance's `/futures/data/globalLongShortAccountRatio` (needs a `period`, ~30 days
history). We added `fetchBinanceLongShort`, a `long_short_ratios` table (per
symbol + timeframe), and endpoints `POST /market/lsr/import` and
`GET /market/lsr?symbol=&timeframe=&limit=`.

### Use

Aligned to candles (same `attachSeries` helper), with a `long_short_ratio` rule
condition comparing the ratio to a threshold:

```jsonc
{ "type": "long_short_ratio", "op": "gt", "value": 2 }   // crowd very long -> caution
```

### A note on liquidations 🪧

The roadmap paired this with **liquidations**, but Binance's *historical*
liquidation REST endpoint is restricted — liquidation data is only available
**live** (websocket) or from paid providers. So we implemented the reliably-free
long/short ratio now and **deferred** liquidation capture (it would need a live
feed). Being honest about data availability beats faking a feed.

### Verified ✅

- Live: imported 180 BTC 4h ratios (real ≈ 1.5), and a long/short-ratio backtest
  ran with the ratio correctly aligned to candles. (This particular threshold
  underperformed buy&hold in-sample — which is exactly what optimization and
  out-of-sample testing are for; the *signal* is now available to use.)

## Signal #5 — Fear & Greed Index: the mood of the whole market 😱🤑

The **Crypto Fear & Greed Index** is a single daily number **0–100** for the whole
market: **0 = extreme fear**, **100 = extreme greed**. It's a **contrarian** tool —
extreme fear often appears near bottoms (everyone's already sold), extreme greed
near tops (everyone's already bought). "Be greedy when others are fearful."

### What's different about this one

Unlike the other signals, it's **not per-coin and not from Binance** — it's one
market-wide series from a free public API, **alternative.me** (no key). And it's
**daily**, not per-timeframe. So the table has **no `coinSymbol` or `timeframe`** —
just a value, a label, and a date.

```prisma
model FearGreed {
  value          Int       // 0-100
  classification String    // "Fear", "Greed", ...
  timestamp      DateTime  @unique
}
```

- The API returns `timestamp` in unix **seconds**, so we multiply by 1000 to make a
  real date (a classic off-by-1000 gotcha).
- Endpoints: `POST /market/fng/import` and `GET /market/fng?limit=`.

### Use

Aligned to candles with the same `attachSeries` helper (a daily value applies to
every candle of that day), via a `fear_greed` rule condition:

```jsonc
{ "type": "fear_greed", "op": "lt", "value": 25 }   // extreme fear -> contrarian buy
```

### Verified ✅

- Live: imported **1000 daily** values (real history back to 2023, e.g. 52
  "Neutral"), and a Fear & Greed backtest on BTC 4h ran with the daily index
  correctly aligned to candles.

## Signal #6 — BTC context (no new market data!) 🟠

Alts tend to **follow BTC**, so knowing whether BTC is healthy is a powerful filter
for alt trades. The nice part: this needs **no new capture in the market service** —
we already store BTC candles. The **backtest service** simply fetches BTC candles
alongside the alt's candles and computes a BTC-trend filter (BTC above/below its own
moving average). See the backtest service's rule-engine lesson for the details.

So signal #6 lives entirely on the backtest side; the market service already
provides everything it needs (the `/market/candles` endpoint for BTC).

Next: the [glossary](08-glossary.md).
