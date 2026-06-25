# 4. The Indicator Engine

Raw candles (file 3) are just prices. **Indicators** turn those prices into
*signals* traders read — "is it overbought?", "is the trend up?", "how wild is it
right now?". This part computes them.

## What's an indicator? (plain words)

An indicator is a formula you run over recent prices to get a helpful number.
Examples we support:

- **SMA (Simple Moving Average)** — the average price over the last N candles.
  Smooths out the jiggles so you see the trend.
- **EMA (Exponential Moving Average)** — like SMA but weights *recent* prices more,
  so it reacts faster.
- **RSI (Relative Strength Index)** — a 0–100 "speedometer." High (>70) often means
  "overbought," low (<30) "oversold."
- **MACD** — compares a fast EMA and a slow EMA to spot momentum shifts. Gives
  three numbers: the MACD line, a signal line, and their gap (histogram).
- **ATR (Average True Range)** — how *much* price moves each candle, i.e. how
  volatile/wild it is right now.
- **VWAP (Volume Weighted Average Price)** — the average price, but weighted by how
  much was traded, so big-volume candles count more.

You don't need the exact maths to use them — just know each turns prices into a
useful signal.

## Why a pure-function library? (`indicators/indicators.ts`)

All the maths lives in **plain functions** that take number arrays and return
number arrays. No database, no network, no Nest — just `numbers in → numbers out`.

```ts
export function sma(values: number[], period: number): Series { ... }
export function rsi(values: number[], period = 14): Series { ... }
// ...ema, macd, atr, vwap
```

> **Why separate the maths like this?** Because pure functions are **easy to test
> exactly**. We can check `sma([1,2,3,4,5], 3)` equals `[null, null, 2, 3, 4]` with
> zero setup. That's why this file has precise unit tests — the maths must be
> *correct*, and pure functions let us prove it.

## The "warm-up" idea (why some values are `null`)

You can't have a 20-candle average until you've seen 20 candles. So every
indicator returns an array the **same length as the input**, with `null` for the
early "warm-up" candles where it isn't defined yet, and real numbers after.
Keeping the output aligned to the input means we can pair each value with its
candle's timestamp by simple position.

> 🐛 **A lesson from a failed test:** MACD's *signal* line is an EMA of the MACD
> line, so it needs **even more** warm-up. Our first test checked the histogram too
> early (before the signal existed) and it was `null`, not `0`. Fix: test it at a
> later index where the signal has warmed up. Lesson: know exactly when each value
> becomes available.

## Computing on demand (`indicators/indicators.service.ts`)

We don't store indicators — we **compute them fresh** from the candles when asked:

```ts
const rows = await this.prisma.marketCandle.findMany({
  where: { coinId, timeframe },
  orderBy: { openTime: "desc" },
  take,
  select: { openTime, high, low, close, volume },
});
rows.reverse(); // newest-first from the DB -> oldest-first for the maths
```

- We pull the most recent `take` candles, then **reverse** them, because the maths
  needs oldest→newest but the database gives newest first.
- We turn the `Decimal` prices into plain `number`s for the formulas.
- Then we run the chosen indicator and attach each result to its candle's
  `openTime`, dropping the warm-up `null`s.

> **Why compute on demand instead of storing indicator values?** It's simpler and
> never goes stale — the answer always reflects the latest candles. Storing
> pre-computed indicators (story S5.2) is an optimization we can add later if read
> volume needs it. Start simple.

## The endpoint

```text
GET /api/v1/market/indicators?symbol=BTC&timeframe=1h&indicator=rsi&period=14&limit=300
```

- `indicator` — one of `sma, ema, rsi, macd, atr, vwap` (anything else → `400`).
- `period` — optional; sensible defaults per indicator (RSI/ATR 14, SMA/EMA 20).
- Returns `{ symbol, timeframe, indicator, period, points: [...] }`. For most
  indicators each point is `{ openTime, value }`; for MACD it's
  `{ openTime, macd, signal, histogram }`.

## What we verified live (on 300 real BTC 1h candles)

RSI ≈ 36, EMA(20) ≈ 60,763, MACD line/signal/histogram all present, VWAP ≈ 63,447,
ATR(14) ≈ 751, and a bad indicator name → `400`. Real, sensible signals computed
from real market data. ✅

## Recap

- Indicators turn raw prices into trading **signals** (SMA, EMA, RSI, MACD, ATR,
  VWAP).
- The maths is **pure functions** → precisely unit-tested.
- Outputs are **aligned to input** with `null` during warm-up.
- We **compute on demand** from stored candles (simple, never stale); storing them
  is a later optimization.

Back to the [index](README.md).
