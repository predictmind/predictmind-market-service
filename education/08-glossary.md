# 8. Glossary (the dictionary)

Quick, simple meanings for the words used in **this** service's notes. General
coding words (API, server, database, Prisma, DTO, module, decorator, async/await,
Docker, port, CI...) are defined in the auth service's
[glossary](../../predictmind-auth-service/education/09-glossary.md) — this list adds
the **market-specific** words.

| Word | Simple meaning |
| --- | --- |
| **Coin** | A cryptocurrency we track (e.g. BTC = Bitcoin). |
| **Symbol** | The short code for a coin (BTC, ETH, SOL). |
| **Catalog** | Our list of tracked coins (the "shelf"). |
| **Seed** | To fill the database with a starting set of data on first run (our standard coins). |
| **OHLCV** | The five numbers describing one time slice of price: **O**pen, **H**igh, **L**ow, **C**lose, **V**olume. |
| **Candle** | One OHLCV bar for one time slice. Drawn like a candle with a body and wicks. |
| **Open / Close** | Price at the **start** / **end** of the time slice. |
| **High / Low** | The **highest** / **lowest** price during the slice. |
| **Volume** | How much was traded during the slice. |
| **Timeframe** | How long each candle covers: `1m, 5m, 15m, 1h, 4h, 1d, 1w`. |
| **Exchange** | A marketplace where coins are traded (we read prices from **Binance**). |
| **Binance** | A large public crypto exchange; we fetch real candles from its free API. |
| **Import** | Fetching candles from the exchange and saving them in our database. |
| **Upsert** | "Update-or-insert": save a row, but if it already exists, don't duplicate it. |
| **Idempotent** | Doing it once or many times gives the same result (safe to repeat). |
| **Indicator** | A number calculated from candles to help read the market. |
| **SMA** | Simple Moving Average — the plain average price over the last N candles. |
| **EMA** | Exponential Moving Average — like SMA but recent prices count more. |
| **RSI** | Relative Strength Index (0–100) — is a coin "overbought" or "oversold"? |
| **MACD** | Moving Average Convergence Divergence — compares two EMAs to spot momentum shifts. |
| **ATR** | Average True Range — how much price typically moves (a measure of volatility). |
| **VWAP** | Volume-Weighted Average Price — the average price, weighted by how much traded. |
| **Period** | How many candles an indicator looks back over (e.g. RSI period 14). |
| **Trend** | The general direction price is heading (up / down / sideways). |
| **Support / Resistance** | Price "floors" / "ceilings" where price often stops and turns. |
| **Volatility** | How wildly price is swinging (calm vs stormy). |
| **Market regime** | A label for current conditions (e.g. bullish/bearish, calm/volatile). |
| **Cron** | A job that runs automatically on a schedule (e.g. every 5 minutes). |
| **Cron expression** | The code for a schedule; `CronExpression.EVERY_5_MINUTES` is a friendly name for it. |
| **Scheduler** | The engine that runs cron jobs (`ScheduleModule` from `@nestjs/schedule`). |
| **Sync** | Our scheduled job that keeps the latest candles fresh. |
| **Fault-tolerant** | If one small part fails, the rest keeps working (one bad coin won't stop the sync). |
| **TimescaleDB** | A version of PostgreSQL tuned for time-based data like candles. |
| **Hypertable** | TimescaleDB's fast, auto-partitioned table for time-series rows. |
| **Health check** | A tiny endpoint (`/health`) that answers "I'm alive" so systems can watch the service. |
| **Non-root user** | A limited user inside the container; safer than the all-powerful `root`. |
| **Order-flow** | Aggressive buying vs selling within a candle. |
| **Taker / Maker** | Someone who takes the price now (aggressive) / posts and waits. |
| **Taker buy volume** | Volume from aggressive market buys (Binance kline field 9). |
| **Buy ratio** | takerBuyVolume ÷ volume (>0.5 = net buying pressure). |
| **Nullable column** | A database column allowed to be empty — lets us add fields without breaking old rows. |
| **Perpetual futures** | A leveraged contract with no expiry; source of funding rate. |
| **Funding rate** | Periodic payment between longs/shorts; a crowd-positioning gauge. |
| **Positive / negative funding** | Crowd heavily long / heavily short. |
| **Signal-only** | Data we use to decide, but never trade directly (we trade spot). |

With these words plus lessons 01–07, you can re-read any line of this service and
know what it does and why. 🎓

Back to the [index](README.md).
