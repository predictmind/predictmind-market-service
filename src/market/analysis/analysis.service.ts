import { BadRequestException, Injectable } from "@nestjs/common";
import { CoinsService } from "../../coins/coins.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SUPPORTED_TIMEFRAMES } from "../market.service";
import {
  classifyTrend,
  classifyVolatility,
  findPivots,
  TrendDirection,
  VolatilityLevel,
} from "./analysis";

export interface AnalysisResult {
  symbol: string;
  timeframe: string;
  candles: number;
  price: number | null;
  trend: {
    direction: TrendDirection;
    emaShort: number | null;
    emaLong: number | null;
    confidence: number;
  };
  volatility: {
    atr: number | null;
    ratio: number | null;
    level: VolatilityLevel;
  };
  levels: {
    nearestSupport: number | null;
    nearestResistance: number | null;
  };
  regime: string;
}

const round = (n: number | null): number | null =>
  n === null ? null : Math.round(n * 100) / 100;

@Injectable()
export class AnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coins: CoinsService,
  ) {}

  async analyze(
    symbol: string,
    timeframe: string,
    limit = 300,
  ): Promise<AnalysisResult> {
    if (!SUPPORTED_TIMEFRAMES.includes(timeframe as never)) {
      throw new BadRequestException(
        `Unsupported timeframe. Use one of: ${SUPPORTED_TIMEFRAMES.join(", ")}`,
      );
    }
    const coin = await this.coins.findBySymbol(symbol);
    const take = Math.min(Math.max(limit, 1), 1000);

    const rows = await this.prisma.marketCandle.findMany({
      where: { coinId: coin.id, timeframe },
      orderBy: { openTime: "desc" },
      take,
      select: { high: true, low: true, close: true },
    });
    rows.reverse();

    const closes = rows.map((r) => Number(r.close));
    const highs = rows.map((r) => Number(r.high));
    const lows = rows.map((r) => Number(r.low));
    const price = closes.length > 0 ? closes[closes.length - 1] : null;

    const trend = classifyTrend(closes);
    const volatility = classifyVolatility(highs, lows, closes);
    const pivots = findPivots(highs, lows, 3);

    let nearestSupport: number | null = null;
    let nearestResistance: number | null = null;
    if (price !== null) {
      const supports = pivots
        .filter((p) => p.type === "support" && p.price < price)
        .map((p) => p.price);
      const resistances = pivots
        .filter((p) => p.type === "resistance" && p.price > price)
        .map((p) => p.price);
      nearestSupport = supports.length ? Math.max(...supports) : null;
      nearestResistance = resistances.length ? Math.min(...resistances) : null;
    }

    return {
      symbol: coin.symbol,
      timeframe,
      candles: rows.length,
      price: round(price),
      trend: {
        direction: trend.direction,
        emaShort: round(trend.emaShort),
        emaLong: round(trend.emaLong),
        confidence: trend.confidence,
      },
      volatility: {
        atr: round(volatility.atr),
        ratio: volatility.ratio === null ? null : Math.round(volatility.ratio * 100) / 100,
        level: volatility.level,
      },
      levels: {
        nearestSupport: round(nearestSupport),
        nearestResistance: round(nearestResistance),
      },
      regime: this.regime(trend.direction, volatility.level),
    };
  }

  private regime(trend: TrendDirection, volatility: VolatilityLevel): string {
    if (volatility === "high") {
      return "volatile";
    }
    if (trend === "bull") {
      return "trending_up";
    }
    if (trend === "bear") {
      return "trending_down";
    }
    return "ranging";
  }
}
