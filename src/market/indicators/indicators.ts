/**
 * Pure technical-indicator math. Every function takes plain number arrays
 * (oldest first) and returns an array the SAME length as the input, with `null`
 * for the "warm-up" period where the indicator isn't defined yet. Keeping the
 * output aligned to the input makes it trivial to pair each value with its
 * candle's timestamp.
 *
 * These are intentionally dependency-free and easy to unit-test.
 */

export type Series = (number | null)[];

/** Simple Moving Average. */
export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      out[i] = sum / period;
    }
  }
  return out;
}

/** Exponential Moving Average (seeded with an SMA of the first `period`). */
export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) {
    return out;
  }
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) {
    seed += values[i];
  }
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Relative Strength Index (Wilder's smoothing). */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) {
    return out;
  }
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) {
      gain += change;
    } else {
      loss -= change;
    }
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const g = change > 0 ? change : 0;
    const l = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** EMA over a series that may contain leading nulls (used for the MACD signal). */
function emaOfSeries(series: Series, period: number): Series {
  const out: Series = new Array(series.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let seedCount = 0;
  let seedSum = 0;
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (v === null) {
      continue;
    }
    if (prev === null) {
      seedSum += v;
      seedCount++;
      if (seedCount === period) {
        prev = seedSum / period;
        out[i] = prev;
      }
    } else {
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

export interface MacdPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

/** MACD line, signal line and histogram. */
export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdPoint[] {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: Series = values.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null
      ? (emaFast[i] as number) - (emaSlow[i] as number)
      : null,
  );
  const signalLine = emaOfSeries(macdLine, signalPeriod);
  return values.map((_, i) => {
    const m = macdLine[i];
    const s = signalLine[i];
    return {
      macd: m,
      signal: s,
      histogram: m !== null && s !== null ? m - s : null,
    };
  });
}

/** Average True Range (Wilder's smoothing). */
export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): Series {
  const n = closes.length;
  const out: Series = new Array(n).fill(null);
  if (n <= period) {
    return out;
  }
  const tr: number[] = new Array(n).fill(0);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
  }
  let sum = 0;
  for (let i = 1; i <= period; i++) {
    sum += tr[i];
  }
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/**
 * Volume Weighted Average Price (cumulative over the provided window).
 * Real trading VWAP usually resets each session; this cumulative form is a
 * simple, useful approximation over the fetched candles.
 */
export function vwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
): Series {
  const out: Series = new Array(closes.length).fill(null);
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < closes.length; i++) {
    const typical = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += typical * volumes[i];
    cumV += volumes[i];
    out[i] = cumV === 0 ? null : cumPV / cumV;
  }
  return out;
}
