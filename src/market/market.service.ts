import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CoinsService } from "../coins/coins.service";
import { PrismaService } from "../prisma/prisma.service";
import { fetchBinanceKlines } from "./binance.client";

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
}
