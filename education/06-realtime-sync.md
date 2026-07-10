# 6. Keeping Prices Fresh Automatically (Real-Time Sync)

So far we could *import* candles by asking for them (`POST /market/import`). But a
real trading platform can't wait for someone to press a button every hour. It
should **update itself** in the background, forever. That is what this part adds.

Think of it like a newspaper delivery: instead of walking to the shop each
morning, you set up a delivery so a fresh paper just *appears* on your doorstep
every day. Our "delivery" runs every few minutes and drops the newest candles
into the database.

## The big idea

- A **scheduler** runs a job on a timer (every 5 minutes).
- The job asks every active coin's latest few candles from Binance.
- It reuses our existing importer, which **skips duplicates**, so running it over
  and over is always safe.
- We can also trigger one run by hand with `POST /market/sync` (handy for testing).

New word: **cron** (rhymes with "on"). A cron is just "a task that runs on a
schedule." The name comes from an old Unix program. A "cron expression" is a
short code that means things like "every 5 minutes" or "every day at midnight."

## Step 1 — turn on the scheduler (`app.module.ts`)

```ts
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),   // <-- turns on the timer engine
    // ...
  ],
})
export class AppModule {}
```

- **What:** `ScheduleModule.forRoot()` switches on NestJS's built-in timer engine.
- **Why:** without it, our `@Cron(...)` job below would just be ignored — nothing
  would ever run it.
- **How to get it:** we installed the official package `@nestjs/schedule`
  (`npm install @nestjs/schedule`). It's the standard, first-party choice, so we
  didn't need an outside library like `node-cron`.

## Step 2 — the sync worker (`market/sync.service.ts`)

This is a **service**: a class that holds a piece of logic. Let's read it in parts.

```ts
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly market: MarketService,
    private readonly coins: CoinsService,
    private readonly config: ConfigService,
  ) {}
```

- **`@Injectable()`** — tells NestJS "you may hand this class to others that need
  it." (This handing-over is called *dependency injection* — explained in the auth
  notes.)
- **`logger`** — a helper that prints tidy messages to the console, so we can see
  "sync complete: 30 candles" in the logs.
- The **constructor** asks for three helpers: `market` (does the importing),
  `coins` (knows the coin list), and `config` (reads settings like on/off).

### The timed job

```ts
@Cron(CronExpression.EVERY_5_MINUTES)
async scheduledSync(): Promise<void> {
  if (this.config.get<string>("SYNC_ENABLED", "true") !== "true") {
    return;
  }
  await this.syncOnce();
}
```

- **`@Cron(CronExpression.EVERY_5_MINUTES)`** — this one line is the whole timer.
  Every 5 minutes, NestJS calls `scheduledSync()` for us. `CronExpression` is a
  friendly list of ready-made schedules, so we don't have to memorize the cryptic
  code `*/5 * * * *`.
- **The on/off switch:** we read `SYNC_ENABLED`. If it isn't the text `"true"`, we
  `return` immediately and do nothing.
  - **Why have a switch?** During tests or on a laptop we don't want the app
    hammering Binance every 5 minutes. We keep it **off** in local `.env`
    (`SYNC_ENABLED=false`) and **on** in the container/production.
  - **Why compare to the text `"true"`?** Settings from the environment always
    arrive as **strings**, never real booleans. `"false"` is a non-empty string,
    which would look "truthy" if we weren't careful — so we compare to the exact
    word `"true"`.

### The actual work (also reusable by hand)

```ts
async syncOnce(): Promise<SyncSummary> {
  const timeframes = (this.config.get<string>("SYNC_TIMEFRAMES", "1h") ?? "1h")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const coins = await this.coins.list();
  let imported = 0;

  for (const coin of coins) {
    for (const timeframe of timeframes) {
      try {
        const result = await this.market.importCandles(coin.symbol, timeframe, 3);
        imported += result.imported;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        this.logger.warn(`Sync failed for ${coin.symbol} ${timeframe}: ${message}`);
      }
    }
  }

  this.logger.log(`Sync complete: ${imported} new candle(s) across ${coins.length} coin(s)`);
  return { coins: coins.length, timeframes, imported };
}
```

Line by line:

- **`timeframes = ...split(",")...`** — the setting `SYNC_TIMEFRAMES` is one text
  string like `"1h,4h"`. We split it on commas into a list `["1h","4h"]`, `trim()`
  removes stray spaces, and `filter` drops empty pieces (so `"1h,"` doesn't create
  a blank timeframe). This lets us change *what* we sync **without touching code** —
  just edit the setting.
- **`coins = await this.coins.list()`** — get every coin we track.
- **Two loops** — for each coin, for each timeframe, pull the latest candles.
- **`importCandles(coin.symbol, timeframe, 3)`** — we ask for just the **3** newest
  candles, not hundreds. The last candle is still forming and earlier ones might
  have been missed, so a small overlap is enough. Duplicates are skipped anyway.
- **`try / catch`** — if *one* coin fails (say Binance hiccups for DOGE), we
  **log a warning and keep going** instead of letting the whole sync crash. One
  bad coin shouldn't stop the other nine. This is called being *fault-tolerant*.
- **`imported += result.imported`** — we add up how many genuinely new candles we
  stored, and return a little summary `{ coins, timeframes, imported }`.

**A better option we chose *not* to use (yet):** we could fetch all coins *at the
same time* (in parallel) to be faster. We kept it **one-at-a-time (sequential)**
on purpose, so we're polite to Binance's free API and don't get rate-limited.
When speed matters more, we can batch a few in parallel later.

## Step 3 — a manual trigger (`market/market.controller.ts`)

```ts
@Post("sync")
@HttpCode(HttpStatus.OK)
runSync() {
  return this.syncService.syncOnce();
}
```

- **What:** adds `POST /api/v1/market/sync` so a human (or a test) can run one sync
  right now, instead of waiting for the 5-minute timer.
- **`@HttpCode(HttpStatus.OK)`** — a `POST` normally answers `201 Created`. Nothing
  is "created" here (we just ran a job), so we return the friendlier `200 OK`.
- **Note:** this manual endpoint runs **regardless** of the `SYNC_ENABLED` switch —
  the switch only pauses the *automatic* timer. That's why we could test it locally
  even with the timer turned off.

## Step 4 — the settings (`.env.example`)

```
# Scheduled candle sync (runs every 5 min when enabled).
SYNC_ENABLED=true
SYNC_TIMEFRAMES=1h
```

- **`SYNC_ENABLED`** — the on/off switch for the timed job.
- **`SYNC_TIMEFRAMES`** — comma-separated list of which timeframes to keep fresh.
- These live in the *example* file with safe defaults. Your private `.env` can
  differ (ours keeps `SYNC_ENABLED=false` locally so a laptop stays quiet).

## Step 5 — running it the *real* way: in a container 🐳

We build microservices, so each service should run inside its **own Docker
container** (its own little sealed box with exactly the right Node version and
files), not by typing `node dist/main.js` by hand. Here's what we fixed to make
that work.

New words:
- **Docker image** — a frozen snapshot of an app + everything it needs. Like a
  cake recipe photographed at the "ready to bake" stage.
- **Docker container** — a running copy of an image. Like the actual cake baked
  from that recipe. One image → many identical containers.
- **Dockerfile** — the recipe that builds the image.

### The Dockerfile fix (`Dockerfile`)

Our old recipe forgot to copy the **`prisma`** folder before installing, so the
build step `prisma generate` (which reads `prisma/schema.prisma` to create the
database client) had nothing to read and failed. The fix mirrors the auth service:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma          # <-- bring the schema in BEFORE install
RUN npm install               # postinstall runs "prisma generate" — now it works
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma  # reuse the generated client
COPY --from=builder /app/dist ./dist
EXPOSE 3003
USER node
CMD ["node", "dist/main.js"]
```

Why it's built in **two stages** (`builder` then `runner`):
- The **builder** has all the tools to compile TypeScript and generate the Prisma
  client.
- The **runner** is a *slim* final image: production dependencies only, plus the
  compiled `dist` and the generated client copied over. Smaller image = faster to
  ship and fewer things that can break. This is called a **multi-stage build**.
- **`USER node`** — we run as a normal user, not the all-powerful `root`, so a bug
  can't do as much damage. Good safety habit.

### Running the whole stack (`predictmind-infra/docker-compose.yml`)

`docker compose` starts many containers together on one private network. Inside
that network, containers find each other by **name**, not `localhost`:

```yaml
market:
  build: ../predictmind-market-service
  ports: ["3003:3003"]
  environment:
    DATABASE_URL: postgresql://predictmind:predictmind@postgres:5432/predictmind?schema=market
    BINANCE_API_URL: https://api.binance.com
    SYNC_ENABLED: "true"
    SYNC_TIMEFRAMES: 1h
  depends_on:
    postgres:
      condition: service_healthy
```

- **`@postgres:5432`** — notice the host is `postgres` (the other service's name),
  **not** `localhost`. Inside a container, `localhost` means *that same container*,
  so using it would look for a database inside the market box — where there is
  none. This is the #1 beginner Docker mistake.
- **`depends_on ... service_healthy`** — don't start `market` until the database
  says "I'm ready." (Postgres has a *healthcheck* that runs `pg_isready`.)
- **`ports: ["3003:3003"]`** — pokes a hole so we on the laptop can reach the
  service at `localhost:3003` for testing.

### One real gotcha we hit: migrate *before* first start

On a brand-new database the tables don't exist yet. Our `CoinsService` tries to
**seed the coin list on startup**, so the very first boot crashed with Prisma
error **`P2021` (table does not exist)**. The fix is ordering:

1. Bring up the database.
2. Apply the schema (`prisma db push`, or `prisma migrate deploy` in production).
3. *Then* start the service.

In production this becomes a small **init/migration job** that runs once before
the service replicas start. Migrations should **not** run inside every copy of the
service — that's why our Dockerfile leaves them as a separate deploy step.

## What we verified live (in a real container!) ✅

Running through `docker compose`:
- The market **image built** (Prisma client generated correctly this time).
- `predictmind-postgres-1` came up **healthy**; `predictmind-market-1` started and
  seeded **10 coins**.
- `POST /api/v1/market/sync` pulled **30 fresh candles** from Binance
  (10 coins × 3 on the `1h` timeframe).
- `GET /market/latest?symbol=BTC` read back a **real BTC price**.
- Running sync **again** returned `imported: 0` — proof the skip-duplicates logic
  works and repeated syncs are safe (**idempotent**).

New word: **idempotent** — doing it once or ten times gives the same end result.
Like a light switch labelled "OFF": flipping it to OFF again changes nothing.

## Recap

- A **cron** job (`@Cron` + `ScheduleModule`) refreshes candles **every 5 minutes**.
- An **on/off setting** (`SYNC_ENABLED`) and a **timeframes list**
  (`SYNC_TIMEFRAMES`) let us control it **without changing code**.
- The job is **fault-tolerant** (one bad coin doesn't stop the rest) and
  **idempotent** (safe to repeat) thanks to skip-duplicates.
- `POST /market/sync` triggers one run by hand (ignores the switch) for testing.
- The service now runs as its **own Docker image/container**; the Dockerfile was
  fixed to generate the Prisma client, and containers talk over the compose
  network using **service names**, not `localhost`.
- Remember the ordering: **database up → migrate → start the service.**

Back to the [index](README.md).
