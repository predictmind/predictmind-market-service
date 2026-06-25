# predictmind-market-service

PredictMind **market** microservice — coin catalog and market data (OHLCV candles).

Part of the PredictMind platform (microservices architecture). Product and architecture documentation lives in the private [`predictmind/app`](https://github.com/predictmind/app) repository. Beginner-friendly walkthroughs are in [`education/`](education/README.md).

## Tech stack

- NestJS + TypeScript
- Prisma → PostgreSQL (own `market` schema; TimescaleDB hypertable in production)
- Imports candles from Binance public data
- Default port `3003`, routed by the gateway under `/api/v1/coins` and `/api/v1/market`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/coins` | List tracked coins |
| GET | `/api/v1/coins/:symbol` | Coin details (case-insensitive) |
| POST | `/api/v1/coins` | Add a coin (admin — RBAC TODO) |
| POST | `/api/v1/market/import` | Import candles from Binance (`{ symbol, timeframe, limit }`) |
| GET | `/api/v1/market/candles?symbol=&timeframe=&limit=` | Read stored candles |
| GET | `/api/v1/market/latest?symbol=&timeframe=` | Most recent candle |
| GET | `/api/v1/health` | Health check |

Timeframes: `1m, 5m, 15m, 1h, 4h, 1d, 1w`.

## Getting started

```bash
cp .env.example .env          # set DATABASE_URL
npm install                   # also runs `prisma generate`
npm run prisma:migrate        # create tables (needs Postgres)
npm run start:dev
```

Interactive API docs (Swagger UI): `http://localhost:3003/api/docs`. The standard coin set is seeded automatically on startup.

## Quality & security

CI (lint + test + build), CodeQL, and Dependabot run on every push and PR.

## License

Proprietary — © PredictMind. All rights reserved.
