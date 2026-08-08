# 10. The Screener — Find Setups Across the Whole Market

A **screener** answers: *"out of every coin and stock, which ones look interesting
right now?"* Instead of flipping through 50 charts one by one, you scan them all at
once and filter to the ones that match a setup — e.g. "oversold", "in an uptrend", or
"near a 20-bar high".

## Where it lives and why

The screener is in the **market service**, because that's where the candles and the
indicator maths already are. We **reuse the same indicator functions** the rest of
the service uses (`sma`, `ema`, `rsi` from `market/indicators/indicators`) — so a
screener number can never disagree with a chart number. Single source of truth.

## What it computes (`screener.service.ts`)

For **one timeframe**, `scan()` walks every active symbol (optionally filtered to
`CRYPTO` or `STOCK`) and, for each, reads the last ~220 candles and computes a small
snapshot:

| Metric | Meaning |
| --- | --- |
| `price` | latest close |
| `changePct` | % change vs the previous candle |
| `rsi` | RSI(14) — momentum (low = oversold, high = overbought) |
| `sma50`, `sma200` | trend averages; plus `aboveSma50/200` booleans |
| `trendUp` | EMA50 > EMA200 (classic uptrend check) |
| `high20` + `distFromHigh20Pct` | the 20-bar high and how far below it we are (0 = at the high) |
| `volume` | latest bar volume |

- We read **220 candles** because that's enough to compute a 200-period average.
- We scan all symbols **in parallel** (`Promise.all`) so the whole market comes back
  in one quick pass.
- Symbols with **no stored candles** for that timeframe are dropped from the result
  (import their data first).
- Every metric is **nullable**: a coin with only 60 candles can't have an SMA200, so
  that cell is `null` rather than a wrong number.

## The endpoint

```text
GET /api/v1/market/screener?assetClass=CRYPTO&timeframe=1d
```

Returns one row per symbol. It's mounted on the existing market controller, so the
gateway already routes and protects it.

## Why the *filtering and sorting* is done in the browser

The endpoint returns the raw snapshot for every symbol; the **website** does the
preset filtering (oversold / uptrend / near-high…) and column sorting. Why? Because
those are cheap on a already-fetched list and make the UI feel **instant** — click a
preset or a column header and it re-filters with no server round-trip. The server's
job is the heavy part (reading candles + indicators); the client's job is the light,
interactive part.

## Honest notes

- The screener reads **stored** candles, so it's only as fresh as your last import /
  sync. For crypto the sync keeps it current; for stocks, import the timeframes you
  want to screen.
- It's a **snapshot** scanner (current values), not a historical condition search.
  Backtesting a condition over time is what the backtest service is for.

Next: the [glossary](11-glossary.md).
