-- CreateEnum
CREATE TYPE "CoinStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "coins" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CoinStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_candles" (
    "id" BIGSERIAL NOT NULL,
    "coinId" UUID NOT NULL,
    "timeframe" TEXT NOT NULL,
    "openTime" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(20,8) NOT NULL,
    "high" DECIMAL(20,8) NOT NULL,
    "low" DECIMAL(20,8) NOT NULL,
    "close" DECIMAL(20,8) NOT NULL,
    "volume" DECIMAL(30,8) NOT NULL,

    CONSTRAINT "market_candles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coins_symbol_key" ON "coins"("symbol");

-- CreateIndex
CREATE INDEX "market_candles_coinId_timeframe_openTime_idx" ON "market_candles"("coinId", "timeframe", "openTime");

-- CreateIndex
CREATE UNIQUE INDEX "market_candles_coinId_timeframe_openTime_key" ON "market_candles"("coinId", "timeframe", "openTime");

-- AddForeignKey
ALTER TABLE "market_candles" ADD CONSTRAINT "market_candles_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "coins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
