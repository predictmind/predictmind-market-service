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

> New to "server", "API", "database", "Prisma", "DTO"? The auth service's notes
> (`predictmind-auth-service/education/`) teach those from scratch. This folder
> builds on them.

## One-sentence summary

The market service is the **library of prices**: a shelf of coins (the catalog)
and, for each coin, books of historical candles we fetch from a public exchange.
