import {
  classifyTrend,
  classifyVolatility,
  findPivots,
} from "./analysis";

describe("market analysis", () => {
  it("classifies a steadily rising series as bull", () => {
    const rising = Array.from({ length: 60 }, (_, i) => 100 + i);
    expect(classifyTrend(rising).direction).toBe("bull");
  });

  it("classifies a steadily falling series as bear", () => {
    const falling = Array.from({ length: 60 }, (_, i) => 200 - i);
    expect(classifyTrend(falling).direction).toBe("bear");
  });

  it("classifies a flat series as sideways with zero confidence", () => {
    const flat = new Array(60).fill(100) as number[];
    const trend = classifyTrend(flat);
    expect(trend.direction).toBe("sideways");
    expect(trend.confidence).toBe(0);
  });

  it("finds a resistance peak and a support trough", () => {
    const highs = [1, 2, 5, 2, 1];
    const lows = [9, 8, 4, 8, 9];
    const pivots = findPivots(highs, lows, 1);
    expect(pivots.find((p) => p.type === "resistance")?.price).toBe(5);
    expect(pivots.find((p) => p.type === "support")?.price).toBe(4);
  });

  it("reports normal volatility for a constant true range", () => {
    const highs = new Array(30).fill(11) as number[];
    const lows = new Array(30).fill(9) as number[];
    const closes = new Array(30).fill(10) as number[];
    expect(classifyVolatility(highs, lows, closes, 14).level).toBe("normal");
  });
});
