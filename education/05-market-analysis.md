# 5. Market Analysis

Indicators (file 4) give raw numbers. **Analysis** turns those numbers into plain
answers a human (or strategy) can act on: *Which way is the market going? How wild
is it? Where are the important price levels?* One endpoint answers all three.

## The endpoint

```text
GET /api/v1/market/analysis?symbol=BTC&timeframe=1h
```

Returns one tidy summary:

```json
{
  "symbol": "BTC", "timeframe": "1h", "candles": 300, "price": 59327.57,
  "trend":      { "direction": "bear", "emaShort": 60763.46, "emaLong": 61524.25, "confidence": 13 },
  "volatility": { "atr": 751.07, "ratio": 2.02, "level": "high" },
  "levels":     { "nearestSupport": 59102.7, "nearestResistance": 61276 },
  "regime": "volatile"
}
```

(That's a real result from live BTC data.) Three pieces — trend, volatility,
levels — plus a single `regime` label that combines them.

## 1. Trend — which way are we going? (`classifyTrend`)

We compare two moving averages and the price:

- a **short** EMA (20) — reacts fast,
- a **long** EMA (50) — the slower, bigger trend.

Rules (plain English):
- short above long **and** price above short → **bull** (going up),
- short below long **and** price below short → **bear** (going down),
- anything in between → **sideways**.

`confidence` (0–100) grows with how far apart the two EMAs are (as a % of price) —
EMAs far apart = a strong, clear trend; nearly touching = weak/unsure.

> **Why EMAs and not just "is price higher than yesterday?"** A single comparison
> is noisy — one jumpy candle fools it. Moving averages smooth the noise so we read
> the *real* direction.

## 2. Volatility — how wild is it? (`classifyVolatility`)

We use **ATR** (file 4 — average candle range) but with a twist: instead of a
magic "ATR > 500 = high" threshold (which would be wrong for different coins), we
compare the **current ATR to its own recent average**:

- current is much bigger than usual (`ratio > 1.3`) → **high**,
- much smaller (`ratio < 0.7`) → **low**,
- otherwise → **normal**.

> **Why compare to its own average?** $751 of movement is huge for a $10 coin and
> tiny for a $60,000 one. Measuring against the asset's *own* normal makes the
> label meaningful everywhere, with no hand-tuned numbers. This is "self-calibrating."

## 3. Support & resistance — the important price levels (`findPivots`)

- **Support** = a price the market keeps bouncing *up* from (a floor).
- **Resistance** = a price it keeps bouncing *down* from (a ceiling).

We find these as **pivots**: a candle whose high is the highest within a few
candles on each side (a local **peak** = resistance), or whose low is the lowest
(a local **trough** = support).

```ts
for (let i = window; i < highs.length - window; i++) {
  // is highs[i] the strict max of its neighbours? -> resistance pivot
  // is lows[i]  the strict min of its neighbours? -> support pivot
}
```

Then we report the **nearest** support below the current price and the nearest
resistance above it — the levels a trader cares about right now.

## The combined `regime`

A single word summarizing the state, so other services don't have to re-reason:

```ts
if (volatility === "high") return "volatile";
if (trend === "bull")      return "trending_up";
if (trend === "bear")      return "trending_down";
return "ranging";
```

High volatility wins (a wild market is "volatile" regardless of direction);
otherwise the trend decides. In our live example: bear trend **but** ATR was 2×
normal → `regime: "volatile"`. Correct and useful.

## Pure functions again

All the brains live in pure functions in `analysis/analysis.ts` (trend, pivots,
volatility) — numbers in, result out — so we unit-test them exactly: a rising
series → bull, falling → bear, flat → sideways (confidence 0), a crafted peak/
trough → the right levels, a constant range → normal volatility. The service just
loads candles and calls these functions.

## What we verified live

`GET /market/analysis` for BTC 1h returned a coherent picture: price between the
detected support and resistance, a bear trend with high volatility, and a
`volatile` regime — all from 300 real candles. ✅

## This completes Epic E6 (Market Analysis)

- **S6.1** trend detection · **S6.2** support/resistance · **S6.3** market-regime
  classification — all in one analysis endpoint on top of the indicators.

## Recap

- Analysis answers **direction** (trend via EMAs), **wildness** (volatility via
  self-calibrated ATR), and **key levels** (support/resistance via pivots).
- A single `regime` word combines them for easy consumption.
- The logic is **pure functions**, precisely unit-tested; the service just feeds
  them candles.

Back to the [index](README.md).
