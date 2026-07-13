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

export interface RawFunding {
  fundingRate: string;
  fundingTime: Date;
}

/**
 * Fetch funding-rate history from Binance USD-M Futures (no API key needed).
 * Docs: https://fapi.binance.com/fapi/v1/fundingRate
 * Note this uses the *futures* base URL, separate from spot klines.
 */
export async function fetchBinanceFunding(
  futuresBaseUrl: string,
  pair: string,
  limit: number,
): Promise<RawFunding[]> {
  const url = `${futuresBaseUrl}/fapi/v1/fundingRate?symbol=${pair}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance funding request failed (${response.status})`);
  }
  const rows = (await response.json()) as { fundingRate: string; fundingTime: number }[];
  return rows.map((r) => ({
    fundingRate: String(r.fundingRate),
    fundingTime: new Date(Number(r.fundingTime)),
  }));
}
