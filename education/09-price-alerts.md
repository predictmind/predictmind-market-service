# 9. Price Alerts — "Tell Me When…"

A price alert is a standing request: *"tell me when Bitcoin goes above ₹70,000."*
You can't stare at charts all day, so the platform watches for you. The important
part: alerts are checked **on the server**, on a timer — so they trigger **even if
your browser is closed**.

## Why it lives in the market service

An alert is really a question about **price**, and prices live here. So the market
service owns alerts: it already has the latest candle for every symbol, and it
already runs scheduled jobs (the candle sync). We just add one more scheduled job.

## What we store: the `PriceAlert` table

```prisma
model PriceAlert {
  id             String    @id @default(uuid()) @db.Uuid
  userId         String    @default("anonymous")   // whose alert
  symbol         String                             // "BTC", "AAPL"...
  condition      String                             // "above" | "below"
  price          Decimal   @db.Decimal(20, 8)       // the target
  status         String    @default("ACTIVE")       // "ACTIVE" | "TRIGGERED"
  note           String?
  triggeredAt    DateTime?
  triggeredPrice Decimal?  @db.Decimal(20, 8)
  ...
}
```

- **`userId`** — alerts belong to a person. The gateway verifies your login and
  passes your id downstream as the `x-user-id` header; the alerts controller reads
  it, so each person only sees their own alerts.
- **`status`** — an alert starts `ACTIVE`; once the price condition is met it flips
  to `TRIGGERED` (and remembers when and at what price). You can **re-arm** it back
  to `ACTIVE`.
- Works for **stocks and crypto** alike, because both are just symbols with candles.

> **Applying the table.** Same as our other schema changes — run `prisma db push`
> once so the `price_alerts` table exists. The build/CI only need the schema (they
> regenerate the Prisma client from it); a running deployment needs the table.

## The checker (`alerts.service.ts`)

The heart is a scheduled method:

```ts
@Cron(CronExpression.EVERY_MINUTE)
async checkAll() {
  const active = await prisma.priceAlert.findMany({ where: { status: "ACTIVE" } });
  // for each: get the latest price for its symbol
  const hit = alert.condition === "above" ? price >= target : price <= target;
  if (hit) // flip to TRIGGERED (+ time + price)
}
```

- **`@Cron(EVERY_MINUTE)`** comes from `@nestjs/schedule` (already used for candle
  sync). Every minute it wakes up and checks all active alerts.
- **Latest price** = the freshest stored candle's close for that symbol (any
  timeframe). We **cache** each symbol's price within one sweep so 10 alerts on BTC
  only fetch the price once.
- **Overlap guard:** a `checking` flag skips a new sweep if the last one is still
  running.
- It only ever *reads* prices and *writes* the alert's status — no trading, nothing
  destructive.

## The endpoints (`alerts.controller.ts`, at `market/alerts`)

Mounted under `market/alerts` on purpose: the gateway already proxies
`/api/v1/market/*`, so we get routing + auth for free — no gateway change.

| Method | Path | Does |
| --- | --- | --- |
| POST | `/market/alerts` | Create an alert |
| GET | `/market/alerts` | List *my* alerts |
| DELETE | `/market/alerts/:id` | Delete an alert |
| POST | `/market/alerts/:id/reset` | Re-arm a triggered alert |

## Honest limits

- Right now a triggered alert is **surfaced in the app** (the website shows a
  "triggered" badge and lists it). Sending an **email / phone push** when it fires is
  a natural next step — that needs mail/push infrastructure (an email service or a
  web-push key), so we deferred it. The important half — *reliable server-side
  detection* — is done, so no trigger is missed while you're away.
- The check runs every minute, so a very brief spike between checks could be missed;
  a minute's resolution is plenty for the swing/position style this platform favours.

Next: the [screener](10-screener.md), then the [glossary](11-glossary.md).
