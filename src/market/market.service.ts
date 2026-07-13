import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CoinsService } from "../coins/coins.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  fetchBinanceFunding,
  fetchBinanceKlines,
  fetchBinanceLongShort,
  fetchBinanceOpenInterest,
  fetchFearGreed,
} from "./binance.client";

export const SUPPORTED_TIMEFRAMES = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
  "1w",
] as const;

export interface CandleDto {
  openTime: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  takerBuyVolume: string | null;
  trades: number | null;
}

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly coins: CoinsService,
  ) {}

  private assertTimeframe(timeframe: string): void {
    if (!SUPPORTED_TIMEFRAMES.includes(timeframe as never)) {
      throw new BadRequestException(
        `Unsupported timeframe. Use one of: ${SUPPORTED_TIMEFRAMES.join(", ")}`,
      );
    }
  }

  /** Import candles for a coin/timeframe from Binance and store new ones. */
  async importCandles(
    symbol: string,
    timeframe: string,
    limit = 500,
  ): Promise<{ imported: number }> {
    this.assertTimeframe(timeframe);
    const coin = await this.coins.findBySymbol(symbol);

    const baseUrl =
      this.config.get<string>("BINANCE_API_URL") ?? "https://api.binance.com";
    const pair = `${coin.symbol}USDT`;
    const raw = await fetchBinanceKlines(baseUrl, pair, timeframe, limit);

    const result = await this.prisma.marketCandle.createMany({
      data: raw.map((c) => ({
        coinId: coin.id,
        timeframe,
        openTime: c.openTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        takerBuyVolume: c.takerBuyVolume,
        trades: c.trades,
      })),
      skipDuplicates: true,
    });

    return { imported: result.count };
  }

  /** Read stored candles (newest first). */
  async getCandles(
    symbol: string,
    timeframe: string,
    limit = 100,
  ): Promise<CandleDto[]> {
    this.assertTimeframe(timeframe);
    const coin = await this.coins.findBySymbol(symbol);

    const rows = await this.prisma.marketCandle.findMany({
      where: { coinId: coin.id, timeframe },
      orderBy: { openTime: "desc" },
      take: Math.min(Math.max(limit, 1), 1000),
      select: {
        openTime: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
        takerBuyVolume: true,
        trades: true,
      },
    });

    // Convert Prisma Decimal -> string so the JSON response is clean.
    return rows.map((r) => ({
      openTime: r.openTime,
      open: r.open.toString(),
      high: r.high.toString(),
      low: r.low.toString(),
      close: r.close.toString(),
      volume: r.volume.toString(),
      takerBuyVolume: r.takerBuyVolume ? r.takerBuyVolume.toString() : null,
      trades: r.trades ?? null,
    }));
  }

  async getLatest(
    symbol: string,
    timeframe: string,
  ): Promise<CandleDto | null> {
    const [latest] = await this.getCandles(symbol, timeframe, 1);
    return latest ?? null;
  }

  /** Import funding-rate history for a coin from Binance futures. */
  async importFunding(symbol: string, limit = 500): Promise<{ imported: number }> {
    const coin = await this.coins.findBySymbol(symbol);
    const futuresBaseUrl =
      this.config.get<string>("BINANCE_FUTURES_API_URL") ?? "https://fapi.binance.com";
    const pair = `${coin.symbol}USDT`;
    const raw = await fetchBinanceFunding(futuresBaseUrl, pair, Math.min(Math.max(limit, 1), 1000));

    const result = await this.prisma.fundingRate.createMany({
      data: raw.map((f) => ({
        coinSymbol: coin.symbol,
        fundingRate: f.fundingRate,
        fundingTime: f.fundingTime,
      })),
      skipDuplicates: true,
    });
    return { imported: result.count };
  }

  /** Read stored funding rates (oldest first, so consumers can align to candles). */
  async getFunding(
    symbol: string,
    limit = 500,
  ): Promise<{ fundingRate: string; fundingTime: Date }[]> {
    const coin = await this.coins.findBySymbol(symbol);
    const rows = await this.prisma.fundingRate.findMany({
      where: { coinSymbol: coin.symbol },
      orderBy: { fundingTime: "asc" },
      take: Math.min(Math.max(limit, 1), 2000),
      select: { fundingRate: true, fundingTime: true },
    });
    return rows.map((r) => ({ fundingRate: r.fundingRate.toString(), fundingTime: r.fundingTime }));
  }

  /** Import open-interest history for a coin/timeframe from Binance futures. */
  async importOpenInterest(
    symbol: string,
    timeframe: string,
    limit = 500,
  ): Promise<{ imported: number }> {
    const coin = await this.coins.findBySymbol(symbol);
    const futuresBaseUrl =
      this.config.get<string>("BINANCE_FUTURES_API_URL") ?? "https://fapi.binance.com";
    const pair = `${coin.symbol}USDT`;
    const raw = await fetchBinanceOpenInterest(
      futuresBaseUrl,
      pair,
      timeframe,
      Math.min(Math.max(limit, 1), 500),
    );

    const result = await this.prisma.openInterest.createMany({
      data: raw.map((o) => ({
        coinSymbol: coin.symbol,
        timeframe,
        openInterest: o.openInterest,
        timestamp: o.timestamp,
      })),
      skipDuplicates: true,
    });
    return { imported: result.count };
  }

  /** Read stored open interest (oldest first, so consumers can align to candles). */
  async getOpenInterest(
    symbol: string,
    timeframe: string,
    limit = 500,
  ): Promise<{ openInterest: string; timestamp: Date }[]> {
    const coin = await this.coins.findBySymbol(symbol);
    const rows = await this.prisma.openInterest.findMany({
      where: { coinSymbol: coin.symbol, timeframe },
      orderBy: { timestamp: "asc" },
      take: Math.min(Math.max(limit, 1), 2000),
      select: { openInterest: true, timestamp: true },
    });
    return rows.map((r) => ({ openInterest: r.openInterest.toString(), timestamp: r.timestamp }));
  }

  /** Import global long/short account ratio for a coin/timeframe from Binance. */
  async importLongShort(
    symbol: string,
    timeframe: string,
    limit = 500,
  ): Promise<{ imported: number }> {
    const coin = await this.coins.findBySymbol(symbol);
    const futuresBaseUrl =
      this.config.get<string>("BINANCE_FUTURES_API_URL") ?? "https://fapi.binance.com";
    const pair = `${coin.symbol}USDT`;
    const raw = await fetchBinanceLongShort(
      futuresBaseUrl,
      pair,
      timeframe,
      Math.min(Math.max(limit, 1), 500),
    );

    const result = await this.prisma.longShortRatio.createMany({
      data: raw.map((r) => ({
        coinSymbol: coin.symbol,
        timeframe,
        longShortRatio: r.longShortRatio,
        longAccount: r.longAccount,
        shortAccount: r.shortAccount,
        timestamp: r.timestamp,
      })),
      skipDuplicates: true,
    });
    return { imported: result.count };
  }

  /** Read stored long/short ratios (oldest first, so consumers can align). */
  async getLongShort(
    symbol: string,
    timeframe: string,
    limit = 500,
  ): Promise<{ longShortRatio: string; timestamp: Date }[]> {
    const coin = await this.coins.findBySymbol(symbol);
    const rows = await this.prisma.longShortRatio.findMany({
      where: { coinSymbol: coin.symbol, timeframe },
      orderBy: { timestamp: "asc" },
      take: Math.min(Math.max(limit, 1), 2000),
      select: { longShortRatio: true, timestamp: true },
    });
    return rows.map((r) => ({
      longShortRatio: r.longShortRatio.toString(),
      timestamp: r.timestamp,
    }));
  }

  /** Import the market-wide Crypto Fear & Greed Index from alternative.me. */
  async importFearGreed(limit = 500): Promise<{ imported: number }> {
    const baseUrl =
      this.config.get<string>("FEAR_GREED_API_URL") ?? "https://api.alternative.me";
    const raw = await fetchFearGreed(baseUrl, Math.min(Math.max(limit, 1), 2000));

    const result = await this.prisma.fearGreed.createMany({
      data: raw.map((f) => ({
        value: f.value,
        classification: f.classification,
        timestamp: f.timestamp,
      })),
      skipDuplicates: true,
    });
    return { imported: result.count };
  }

  /** Read stored Fear & Greed values (oldest first, so consumers can align). */
  async getFearGreed(
    limit = 500,
  ): Promise<{ value: number; classification: string; timestamp: Date }[]> {
    const rows = await this.prisma.fearGreed.findMany({
      orderBy: { timestamp: "asc" },
      take: Math.min(Math.max(limit, 1), 3000),
      select: { value: true, classification: true, timestamp: true },
    });
    return rows;
  }
}
