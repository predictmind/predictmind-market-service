import { BadRequestException, Injectable } from "@nestjs/common";
import { CoinsService } from "../coins/coins.service";
import { PrismaService } from "../prisma/prisma.service";
import { ema, rsi, sma } from "./indicators/indicators";
import { SUPPORTED_TIMEFRAMES } from "./market.service";

/** One row of the screener: current snapshot metrics for a symbol. */
export interface ScreenerRow {
  symbol: string;
  name: string;
  assetClass: string;
  price: number | null;
  changePct: number | null; // vs previous candle
  rsi: number | null; // RSI(14)
  sma50: number | null;
  sma200: number | null;
  aboveSma50: boolean | null;
  aboveSma200: boolean | null;
  trendUp: boolean | null; // EMA50 > EMA200
  high20: number | null; // highest high of last 20 bars
  distFromHigh20Pct: number | null; // (price - high20) / high20 * 100 (0 = at high)
  volume: number | null;
  candles: number;
}

const CANDLES_FOR_SCAN = 220; // enough for SMA/EMA 200

function last<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i] as T;
  return null;
}

@Injectable()
export class ScreenerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coins: CoinsService,
  ) {}

  /**
   * Scan every active coin/stock for one timeframe and return a snapshot of key
   * metrics per symbol. Filtering/sorting is left to the client so the UI stays
   * instant. Reuses the shared indicators lib (single source of truth).
   */
  async scan(assetClass: string | undefined, timeframe: string): Promise<ScreenerRow[]> {
    if (!SUPPORTED_TIMEFRAMES.includes(timeframe as never)) {
      throw new BadRequestException(
        `Unsupported timeframe. Use one of: ${SUPPORTED_TIMEFRAMES.join(", ")}`,
      );
    }
    const all = await this.coins.list();
    const wanted =
      assetClass && (assetClass === "CRYPTO" || assetClass === "STOCK")
        ? all.filter((c) => c.assetClass === assetClass)
        : all;

    const rows = await Promise.all(
      wanted.map((coin) => this.row(coin.id, coin.symbol, coin.name, coin.assetClass, timeframe)),
    );
    // Drop symbols with no data at all for this timeframe.
    return rows.filter((r) => r.candles > 0);
  }

  private async row(
    coinId: string,
    symbol: string,
    name: string,
    assetClass: string,
    timeframe: string,
  ): Promise<ScreenerRow> {
    const candles = await this.prisma.marketCandle.findMany({
      where: { coinId, timeframe },
      orderBy: { openTime: "desc" },
      take: CANDLES_FOR_SCAN,
      select: { high: true, close: true, volume: true },
    });
    candles.reverse(); // oldest-first for the indicator maths

    const empty: ScreenerRow = {
      symbol,
      name,
      assetClass,
      price: null,
      changePct: null,
      rsi: null,
      sma50: null,
      sma200: null,
      aboveSma50: null,
      aboveSma200: null,
      trendUp: null,
      high20: null,
      distFromHigh20Pct: null,
      volume: null,
      candles: candles.length,
    };
    if (candles.length === 0) return empty;

    const closes = candles.map((c) => Number(c.close));
    const highs = candles.map((c) => Number(c.high));
    const n = closes.length;
    const price = closes[n - 1];
    const prev = n >= 2 ? closes[n - 2] : null;
    const changePct = prev && prev > 0 ? ((price - prev) / prev) * 100 : null;

    const sma50 = last(sma(closes, 50));
    const sma200 = last(sma(closes, 200));
    const ema50 = last(ema(closes, 50));
    const ema200 = last(ema(closes, 200));
    const rsiVal = last(rsi(closes, 14));

    const window = highs.slice(Math.max(0, n - 20));
    const high20 = window.length ? Math.max(...window) : null;

    return {
      symbol,
      name,
      assetClass,
      price,
      changePct,
      rsi: rsiVal,
      sma50,
      sma200,
      aboveSma50: sma50 != null ? price > sma50 : null,
      aboveSma200: sma200 != null ? price > sma200 : null,
      trendUp: ema50 != null && ema200 != null ? ema50 > ema200 : null,
      high20,
      distFromHigh20Pct: high20 && high20 > 0 ? ((price - high20) / high20) * 100 : null,
      volume: Number(candles[n - 1].volume),
      candles: n,
    };
  }
}
