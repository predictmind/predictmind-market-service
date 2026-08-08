import { BadRequestException } from "@nestjs/common";

/**
 * Free stock-market candle source: Yahoo Finance's public chart API
 * (`query1.finance.yahoo.com/v8/finance/chart`). No API key required. It returns
 * intraday and daily OHLCV in one JSON call, so — unlike the paged Binance
 * importer — we fetch the whole range at once and keep the most recent `limit`.
 *
 * We send a browser-like User-Agent because Yahoo rejects header-less requests.
 * This is an unofficial endpoint (fine for research/paper trading); if it ever
 * changes, only this file needs updating.
 */

export interface StockCandleRow {
  openTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  takerBuyVolume: number | null; // not applicable to stocks
  trades: number | null;
}

/** Map our timeframes to a Yahoo (interval, range). 4h isn't offered by Yahoo. */
function yahooParams(timeframe: string): { interval: string; range: string } {
  switch (timeframe) {
    case "1m":
      return { interval: "1m", range: "7d" };
    case "5m":
      return { interval: "5m", range: "60d" };
    case "15m":
      return { interval: "15m", range: "60d" };
    case "1h":
      return { interval: "60m", range: "730d" };
    case "1d":
      return { interval: "1d", range: "max" };
    case "1w":
      return { interval: "1wk", range: "max" };
    default:
      throw new BadRequestException(
        `Timeframe ${timeframe} is not available for stocks (use 1m, 5m, 15m, 1h, 1d, or 1w).`,
      );
  }
}

interface YahooChartResponse {
  chart: {
    error: { code: string; description: string } | null;
    result:
      | {
          timestamp?: number[];
          indicators: {
            quote: {
              open: (number | null)[];
              high: (number | null)[];
              low: (number | null)[];
              close: (number | null)[];
              volume: (number | null)[];
            }[];
          };
        }[]
      | null;
  };
}

export async function fetchYahooKlines(
  symbol: string,
  timeframe: string,
  limit: number,
  baseUrl = "https://query1.finance.yahoo.com",
): Promise<StockCandleRow[]> {
  const { interval, range } = yahooParams(timeframe);
  const url = `${baseUrl}/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=${interval}&range=${range}&includePrePost=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let json: YahooChartResponse;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Yahoo blocks requests without a browser-like User-Agent.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new BadRequestException(`Yahoo returned ${res.status} for ${symbol}`);
    json = (await res.json()) as YahooChartResponse;
  } finally {
    clearTimeout(timer);
  }

  if (json.chart.error) {
    throw new BadRequestException(
      `Yahoo error for ${symbol}: ${json.chart.error.description ?? json.chart.error.code}`,
    );
  }
  const result = json.chart.result?.[0];
  const ts = result?.timestamp;
  const q = result?.indicators?.quote?.[0];
  if (!result || !ts || !q) {
    throw new BadRequestException(`No stock data for ${symbol} (${timeframe}).`);
  }

  const rows: StockCandleRow[] = [];
  for (let i = 0; i < ts.length; i++) {
    const open = q.open[i];
    const high = q.high[i];
    const low = q.low[i];
    const close = q.close[i];
    // Skip gaps (holidays, halts) where Yahoo returns nulls.
    if (open == null || high == null || low == null || close == null) continue;
    rows.push({
      openTime: new Date(ts[i] * 1000),
      open,
      high,
      low,
      close,
      volume: q.volume[i] ?? 0,
      takerBuyVolume: null,
      trades: null,
    });
  }

  // Keep only the most recent `limit` bars (Yahoo returns ascending by time).
  return rows.slice(Math.max(0, rows.length - Math.max(1, limit)));
}
