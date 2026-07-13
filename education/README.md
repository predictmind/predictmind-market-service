# 📚 PredictMind Market Service — Learn It Like You're 10

This service is the platform's **memory of prices**. It keeps a list of which
coins we track, and stores their price history (candles) so every other part of
PredictMind can study the market.

Read in order:

| # | File | What you'll learn |
| --- | --- | --- |
| 1 | [01-overview.md](01-overview.md) | What this service is for; what a "candle" / OHLCV is |
| 2 | [02-coins-catalog.md](02-coins-catalog.md) | The coin list: model, seeding, endpoints |
| 3 | [03-candles-and-binance.md](03-candles-and-binance.md) | Storing price history + importing real data from Binance |
| 4 | [04-indicators.md](04-indicators.md) | The indicator engine: RSI/MACD/EMA/SMA/ATR/VWAP from candles |
| 5 | [05-market-analysis.md](05-market-analysis.md) | Trend, support/resistance, volatility & market regime |
| 6 | [06-realtime-sync.md](06-realtime-sync.md) | Auto-refreshing candles on a timer + running the service in Docker |
| 7 | [07-order-flow.md](07-order-flow.md) | Extra precision signals: order-flow (#1), funding (#2), open interest (#3), … |
| 8 | [08-glossary.md](08-glossary.md) | Dictionary of every market-specific term |

> New to "server", "API", "database", "Prisma", "DTO"? The auth service's notes
> (`predictmind-auth-service/education/`) teach those from scratch. This folder
> builds on them.

## One-sentence summary

The market service is the **library of prices**: a shelf of coins (the catalog)
and, for each coin, books of historical candles we fetch from a public exchange.
