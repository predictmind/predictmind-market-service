/**
 * Pure market-analysis helpers built on the indicator maths. Like the
 * indicators, these are dependency-free (numbers in → result out) so they are
 * easy to unit-test exactly.
 */
import { atr, ema } from "../indicators/indicators";

export type TrendDirection = "bull" | "bear" | "sideways";
export type VolatilityLevel = "low" | "normal" | "high";

function lastDefined(series: (number | null)[]): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] !== null) {
      return series[i];
    }
  }
  return null;
}

export interface TrendResult {
  direction: TrendDirection;
  emaShort: number | null;
  emaLong: number | null;
  confidence: number; // 0-100
}

/**
 * Trend = where short & long EMAs sit relative to each other and to price.
 *  - short above long AND price above short → bull
 *  - short below long AND price below short → bear
 *  - otherwise → sideways
 * Confidence grows with how far apart the EMAs are (as a % of price).
 */
export function classifyTrend(
  closes: number[],
  shortPeriod = 20,
  longPeriod = 50,
): TrendResult {
  const emaShort = lastDefined(ema(closes, shortPeriod));
  const emaLong = lastDefined(ema(closes, longPeriod));
  const price = closes.length > 0 ? closes[closes.length - 1] : 0;

  if (emaShort === null || emaLong === null || price === 0) {
    return { direction: "sideways", emaShort, emaLong, confidence: 0 };
  }

  let direction: TrendDirection;
  if (emaShort > emaLong && price >= emaShort) {
    direction = "bull";
  } else if (emaShort < emaLong && price <= emaShort) {
    direction = "bear";
  } else {
    direction = "sideways";
  }

  const separation = Math.abs(emaShort - emaLong) / price; // fraction
  const confidence = Math.max(0, Math.min(100, Math.round(separation * 1000)));
  return { direction, emaShort, emaLong, confidence };
}

export interface Pivot {
  index: number;
  price: number;
  type: "support" | "resistance";
}

/**
 * A pivot high is a candle whose high is the strict max within +/- `window`
 * candles (a local peak); a pivot low is the opposite (a local trough). These
 * peaks/troughs are natural support & resistance levels.
 */
export function findPivots(
  highs: number[],
  lows: number[],
  window = 3,
): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = window; i < highs.length - window; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) {
        continue;
      }
      if (highs[j] >= highs[i]) {
        isHigh = false;
      }
      if (lows[j] <= lows[i]) {
        isLow = false;
      }
    }
    if (isHigh) {
      pivots.push({ index: i, price: highs[i], type: "resistance" });
    }
    if (isLow) {
      pivots.push({ index: i, price: lows[i], type: "support" });
    }
  }
  return pivots;
}

export interface VolatilityResult {
  atr: number | null;
  ratio: number | null; // current ATR vs its own average
  level: VolatilityLevel;
}

/**
 * Volatility level = current ATR compared to the window's average ATR.
 * Self-calibrating, so it works across coins/timeframes without magic numbers.
 */
export function classifyVolatility(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): VolatilityResult {
  const series = atr(highs, lows, closes, period).filter(
    (v): v is number => v !== null,
  );
  if (series.length === 0) {
    return { atr: null, ratio: null, level: "normal" };
  }
  const current = series[series.length - 1];
  const avg = series.reduce((a, b) => a + b, 0) / series.length;
  const ratio = avg === 0 ? 1 : current / avg;
  const level: VolatilityLevel =
    ratio > 1.3 ? "high" : ratio < 0.7 ? "low" : "normal";
  return { atr: current, ratio, level };
}
