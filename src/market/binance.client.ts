/**
 * Tiny client for Binance public market data (no API key needed).
 * Docs: https://api.binance.com/api/v3/klines
 */

export interface RawCandle {
  openTime: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  // Order-flow fields (from the same kline row): how much of the volume was
  // bought by aggressive takers, and how many trades occurred.
  takerBuyVolume: string;
  trades: number;
}

export async function fetchBinanceKlines(
  baseUrl: string,
  pair: string,
  interval: string,
  limit: number,
): Promise<RawCandle[]> {
  const url = `${baseUrl}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance request failed (${response.status})`);
  }

  // Each kline is an array:
  // [openTime, open, high, low, close, volume, closeTime, quoteVolume,
  //  numberOfTrades(8), takerBuyBaseVolume(9), takerBuyQuoteVolume(10), ignore]
  const rows = (await response.json()) as unknown[][];
  return rows.map((row) => ({
    openTime: new Date(Number(row[0])),
    open: String(row[1]),
    high: String(row[2]),
    low: String(row[3]),
    close: String(row[4]),
    volume: String(row[5]),
    trades: Number(row[8]),
    takerBuyVolume: String(row[9]),
  }));
}
