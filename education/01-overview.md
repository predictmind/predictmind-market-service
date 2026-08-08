# 1. What This Service Does (and what a "candle" is)

PredictMind studies the crypto market to find trading strategies. To study
anything, you first need **data**. This service collects and serves that data.

It has two jobs:
1. **Keep the coin catalog** — which coins we track (BTC, ETH, ...).
2. **Store price history** — for each coin, the price over time as **candles**.

## What is a "candle" (OHLCV)?

Prices change constantly. To make sense of them, we chop time into equal blocks
(say, 1 hour each) and summarize each block with **five numbers**:

- **O**pen — the price at the *start* of the block.
- **H**igh — the *highest* price during the block.
- **L**ow — the *lowest* price during the block.
- **C**lose — the price at the *end* of the block.
- **V**olume — *how much* was traded during the block.

Together those are called **OHLCV**, and one block of them is a **candle** (because
on a chart it's drawn as a little candle shape). A row of candles is a price
chart. This is the standard way the whole trading world records prices.

A **timeframe** is how big each block is. We support: `1m, 5m, 15m, 1h, 4h, 1d,
1w` (one minute up to one week). The same coin has different candle sets for
different timeframes.

## Where does the data come from?

We don't make prices up — we **import** real candles from a public exchange
(**Binance**) using their free data endpoint. We store what we fetch so the rest
of PredictMind can read it fast without hitting Binance every time.

## The endpoints (the menu)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/coins` | List the coins we track |
| GET | `/api/v1/coins/:symbol` | One coin's details |
| POST | `/api/v1/coins` | Add a coin (admin — TODO RBAC) |
| POST | `/api/v1/market/import` | Fetch & store candles from Binance |
| GET | `/api/v1/market/candles` | Read stored candles |
| GET | `/api/v1/market/latest` | The most recent candle |

## A note on security

These endpoints aren't login-protected *inside* this service. Instead, the
**gateway** checks the token before forwarding requests here (see the gateway's
notes). So reaching `/api/v1/market/...` already required a valid login. The
market service trusts the gateway and stays focused on data. (Adding role checks
for admin actions like creating coins is a planned follow-up.)

Next: the coin catalog → [02-coins-catalog.md](02-coins-catalog.md)
