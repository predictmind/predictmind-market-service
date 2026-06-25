import { atr, ema, macd, rsi, sma, vwap } from "./indicators";

describe("indicators math", () => {
  it("sma computes the simple moving average aligned to input", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it("ema seeds with an SMA then smooths", () => {
    // seed at index 2 = (1+2+3)/3 = 2; k = 0.5
    // index 3 = 4*0.5 + 2*0.5 = 3 ; index 4 = 5*0.5 + 3*0.5 = 4
    expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it("rsi is 100 for a steadily rising series", () => {
    const rising = Array.from({ length: 20 }, (_, i) => i + 1);
    const result = rsi(rising, 14);
    expect(result[13]).toBeNull();
    expect(result[14]).toBe(100);
  });

  it("rsi is 0 for a steadily falling series", () => {
    const falling = Array.from({ length: 20 }, (_, i) => 20 - i);
    expect(rsi(falling, 14)[14]).toBe(0);
  });

  it("vwap of a constant price equals that price", () => {
    expect(vwap([10, 10, 10], [10, 10, 10], [10, 10, 10], [1, 2, 3])).toEqual([
      10, 10, 10,
    ]);
  });

  it("atr equals a constant true range", () => {
    const highs = [11, 11, 11, 11, 11, 11];
    const lows = [9, 9, 9, 9, 9, 9];
    const closes = [10, 10, 10, 10, 10, 10];
    expect(atr(highs, lows, closes, 3)[3]).toBe(2);
  });

  it("macd is zero for a constant series", () => {
    const flat = new Array(40).fill(10) as number[];
    const series = macd(flat);
    // macd line is defined from index 25 (slow EMA = 26); the signal line needs
    // 9 more values, so it (and the histogram) are defined from index 33.
    expect(series[30].macd).toBe(0);
    expect(series[35].macd).toBe(0);
    expect(series[35].signal).toBe(0);
    expect(series[35].histogram).toBe(0);
  });
});
