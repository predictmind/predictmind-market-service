# 2. The Coin Catalog

Before we can store prices for "BTC", the system needs to know BTC exists. The
**coin catalog** is that list.

## The Coin model (`prisma/schema.prisma`)

```prisma
enum CoinStatus { ACTIVE  DISABLED }

model Coin {
  id        String     @id @default(uuid()) @db.Uuid
  symbol    String     @unique
  name      String
  status    CoinStatus @default(ACTIVE)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  candles   MarketCandle[]
  @@map("coins")
}
```

- `symbol @unique` — the short ticker like `BTC`. Unique so we never have two
  "BTC" rows.
- `status` — `ACTIVE` (we track it) or `DISABLED` (hidden) — an **enum** (a fixed
  list of allowed values, see the auth notes).
- `candles MarketCandle[]` — the relation: one coin has many candles (next file).

## Seeding the standard coins (`coins.service.ts`)

A brand-new database has no coins. We **seed** the standard set on startup:

```ts
async onModuleInit(): Promise<void> {
  for (const coin of DEFAULT_COINS) {
    await this.prisma.coin.upsert({
      where: { symbol: coin.symbol },
      update: {},
      create: coin,
    });
  }
}
```

- `onModuleInit` is a Nest hook that runs **when the service starts** (see the
  auth notes on lifecycle hooks).
- `upsert` = "**up**date or in**sert**": if a coin with this symbol exists, do
  nothing (`update: {}`); otherwise create it. This makes seeding **idempotent** —
  safe to run every startup, it never makes duplicates.

> **Why seed in code instead of by hand?** So any fresh environment (your laptop,
> a teammate's, the test server) automatically has the same coins with zero setup.
> In production an admin or a migration would manage the list; this is the dev
> convenience.

## The endpoints (`coins.controller.ts`)

```ts
@Get()              list()                       // all ACTIVE coins
@Get(":symbol")     findOne(@Param("symbol"))    // one coin
@Post()             create(@Body() dto)          // add a coin (admin TODO)
```

- `@Param("symbol")` reads the `:symbol` from the URL (e.g. `/coins/btc`).
- We look coins up **case-insensitively** (`symbol.toUpperCase()`), so `/coins/btc`
  and `/coins/BTC` both work — friendlier for callers.
- Missing coin → `404 Not Found` (a clear, correct error).

## The create form (`dto/create-coin.dto.ts`)

```ts
@Matches(/^[A-Za-z0-9]{2,15}$/, { message: "symbol must be 2-15 letters/digits" })
symbol!: string;
```

`@Matches` checks the symbol against a pattern (2–15 letters/digits) so junk like
`"!!"` or a 200-character string is rejected before it reaches the database. This
is the "never trust outside input" rule again (auth notes, file 5).

## What we verified live

The service started, **seeded 10 coins** (BTC, ETH, BNB, SOL, XRP, DOGE, ADA,
AVAX, MATIC, DOT), `GET /coins` returned all 10, `/coins/btc` returned Bitcoin,
and an unknown coin returned `404`. ✅

Next: storing price history and importing from Binance →
[03-candles-and-binance.md](03-candles-and-binance.md)
