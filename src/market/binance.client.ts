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
  endTimeMs?: number,
): Promise<RawCandle[]> {
  // Binance returns candles OLDER than endTime (inclusive), newest of that set
  // last. We use endTime to page backwards through history one batch at a time.
  const endParam = endTimeMs != null ? `&endTime=${endTimeMs}` : "";
  const url = `${baseUrl}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}${endParam}`;
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

export interface RawOpenInterest {
  openInterest: string;
  timestamp: Date;
}

/**
 * Fetch open-interest history from Binance USD-M Futures (no API key needed).
 * Docs: https://fapi.binance.com/futures/data/openInterestHist
 * `period` must be a supported interval (5m,15m,30m,1h,2h,4h,6h,12h,1d).
 * Only ~30 days of history are available.
 */
export async function fetchBinanceOpenInterest(
  futuresBaseUrl: string,
  pair: string,
  period: string,
  limit: number,
): Promise<RawOpenInterest[]> {
  const url = `${futuresBaseUrl}/futures/data/openInterestHist?symbol=${pair}&period=${period}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance open-interest request failed (${response.status})`);
  }
  const rows = (await response.json()) as { sumOpenInterest: string; timestamp: number }[];
  return rows.map((r) => ({
    openInterest: String(r.sumOpenInterest),
    timestamp: new Date(Number(r.timestamp)),
  }));
}

export interface RawLongShort {
  longShortRatio: string;
  longAccount: string;
  shortAccount: string;
  timestamp: Date;
}

/**
 * Fetch the global long/short account ratio from Binance USD-M Futures.
 * Docs: https://fapi.binance.com/futures/data/globalLongShortAccountRatio
 * `period` must be a supported interval; only ~30 days of history are available.
 */
export async function fetchBinanceLongShort(
  futuresBaseUrl: string,
  pair: string,
  period: string,
  limit: number,
): Promise<RawLongShort[]> {
  const url = `${futuresBaseUrl}/futures/data/globalLongShortAccountRatio?symbol=${pair}&period=${period}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance long/short request failed (${response.status})`);
  }
  const rows = (await response.json()) as {
    longShortRatio: string;
    longAccount: string;
    shortAccount: string;
    timestamp: number;
  }[];
  return rows.map((r) => ({
    longShortRatio: String(r.longShortRatio),
    longAccount: String(r.longAccount),
    shortAccount: String(r.shortAccount),
    timestamp: new Date(Number(r.timestamp)),
  }));
}

export interface RawFearGreed {
  value: number;
  classification: string;
  timestamp: Date;
}

/**
 * Fetch the Crypto Fear & Greed Index from alternative.me (free, no key).
 * Docs: https://api.alternative.me/fng/?limit=500
 * A market-wide daily value 0-100. `timestamp` arrives as unix *seconds*.
 * (Kept in this file with the other market-data clients for convenience.)
 */
export async function fetchFearGreed(
  baseUrl: string,
  limit: number,
): Promise<RawFearGreed[]> {
  const url = `${baseUrl}/fng/?limit=${limit}&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fear & Greed request failed (${response.status})`);
  }
  const body = (await response.json()) as {
    data: { value: string; value_classification: string; timestamp: string }[];
  };
  return (body.data ?? []).map((d) => ({
    value: Number(d.value),
    classification: String(d.value_classification),
    timestamp: new Date(Number(d.timestamp) * 1000),
  }));
}

export interface RawOnChain {
  activeAddresses: number | null;
  mvrv: number | null;
  timestamp: Date;
}

/**
 * Fetch on-chain metrics from the Coin Metrics community API (free, no key).
 * Docs: https://community-api.coinmetrics.io/v4/timeseries/asset-metrics
 * `asset` is a lowercase code (btc, eth).
 *
 * We request only **AdrActCnt** (active addresses), which is on the free
 * community tier. MVRV needs realized cap (`CapRealUSD`), which the free tier
 * blocks (403), so `mvrv` stays null unless a paid source is configured later —
 * the field is kept future-ready.
 */
export async function fetchCoinMetrics(
  baseUrl: string,
  asset: string,
  limit: number,
): Promise<RawOnChain[]> {
  const metrics = "AdrActCnt";
  const url = `${baseUrl}/v4/timeseries/asset-metrics?assets=${asset}&metrics=${metrics}&frequency=1d&page_size=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Coin Metrics request failed (${response.status})`);
  }
  const body = (await response.json()) as {
    data?: { time: string; AdrActCnt?: string }[];
  };
  return (body.data ?? []).map((d) => ({
    activeAddresses: d.AdrActCnt != null ? Math.round(Number(d.AdrActCnt)) : null,
    mvrv: null,
    timestamp: new Date(d.time),
  }));
}
