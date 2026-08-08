import { BadRequestException, Injectable } from "@nestjs/common";
import { CoinsService } from "../../coins/coins.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SUPPORTED_TIMEFRAMES } from "../market.service";
import { atr, ema, macd, rsi, sma, vwap } from "./indicators";

export const SUPPORTED_INDICATORS = [
  "sma",
  "ema",
  "rsi",
  "macd",
  "atr",
  "vwap",
] as const;

const DEFAULT_PERIOD: Record<string, number> = {
  sma: 20,
  ema: 20,
  rsi: 14,
  atr: 14,
};

interface ValuePoint {
  openTime: Date;
  value: number;
}

interface MacdPointOut {
  openTime: Date;
  macd: number;
  signal: number | null;
  histogram: number | null;
}

export interface IndicatorResult {
  symbol: string;
  timeframe: string;
  indicator: string;
  period: number | null;
  points: (ValuePoint | MacdPointOut)[];
}

@Injectable()
export class IndicatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coins: CoinsService,
  ) {}

  async compute(
    symbol: string,
    timeframe: string,
    indicator: string,
    period?: number,
    limit = 300,
  ): Promise<IndicatorResult> {
    if (!SUPPORTED_TIMEFRAMES.includes(timeframe as never)) {
      throw new BadRequestException(
        `Unsupported timeframe. Use one of: ${SUPPORTED_TIMEFRAMES.join(", ")}`,
      );
    }
    const name = indicator.toLowerCase();
    if (!SUPPORTED_INDICATORS.includes(name as never)) {
      throw new BadRequestException(
        `Unsupported indicator. Use one of: ${SUPPORTED_INDICATORS.join(", ")}`,
      );
    }

    const coin = await this.coins.findBySymbol(symbol);
    const take = Math.min(Math.max(limit, 1), 1000);

    const rows = await this.prisma.marketCandle.findMany({
      where: { coinId: coin.id, timeframe },
      orderBy: { openTime: "desc" },
      take,
      select: { openTime: true, high: true, low: true, close: true, volume: true },
    });
    // findMany returned newest-first; indicators need oldest-first.
    rows.reverse();

    const times = rows.map((r) => r.openTime);
    const closes = rows.map((r) => Number(r.close));
    const highs = rows.map((r) => Number(r.high));
    const lows = rows.map((r) => Number(r.low));
    const volumes = rows.map((r) => Number(r.volume));

    const p = period ?? DEFAULT_PERIOD[name] ?? 14;

    if (name === "macd") {
      const series = macd(closes);
      const points: MacdPointOut[] = [];
      series.forEach((m, i) => {
        if (m.macd !== null) {
          points.push({
            openTime: times[i],
            macd: m.macd,
            signal: m.signal,
            histogram: m.histogram,
          });
        }
      });
      return { symbol: coin.symbol, timeframe, indicator: name, period: null, points };
    }

    let series;
    switch (name) {
      case "sma":
        series = sma(closes, p);
        break;
      case "ema":
        series = ema(closes, p);
        break;
      case "rsi":
        series = rsi(closes, p);
        break;
      case "atr":
        series = atr(highs, lows, closes, p);
        break;
      default:
        series = vwap(highs, lows, closes, volumes);
        break;
    }

    const points: ValuePoint[] = [];
    series.forEach((v, i) => {
      if (v !== null) {
        points.push({ openTime: times[i], value: v });
      }
    });

    return {
      symbol: coin.symbol,
      timeframe,
      indicator: name,
      period: name === "vwap" ? null : p,
      points,
    };
  }
}
