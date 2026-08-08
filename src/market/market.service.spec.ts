import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { CoinsService } from "../coins/coins.service";
import { PrismaService } from "../prisma/prisma.service";
import { MarketService } from "./market.service";

describe("MarketService", () => {
  let service: MarketService;
  let prisma: { marketCandle: { findMany: jest.Mock } };
  let coins: { findBySymbol: jest.Mock };

  beforeEach(async () => {
    prisma = { marketCandle: { findMany: jest.fn() } };
    coins = { findBySymbol: jest.fn().mockResolvedValue({ id: "c1", symbol: "BTC" }) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: PrismaService, useValue: prisma },
        { provide: CoinsService, useValue: coins },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = moduleRef.get<MarketService>(MarketService);
  });

  it("rejects an unsupported timeframe", async () => {
    await expect(service.getCandles("BTC", "2h", 10)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns candles with decimals converted to strings", async () => {
    prisma.marketCandle.findMany.mockResolvedValue([
      {
        openTime: new Date("2026-01-01T00:00:00Z"),
        open: { toString: () => "42000.00000000" },
        high: { toString: () => "42500.00000000" },
        low: { toString: () => "41800.00000000" },
        close: { toString: () => "42300.00000000" },
        volume: { toString: () => "123.45000000" },
      },
    ]);

    const candles = await service.getCandles("BTC", "1h", 10);
    expect(candles).toHaveLength(1);
    expect(candles[0].open).toBe("42000.00000000");
    expect(typeof candles[0].close).toBe("string");
  });

  it("returns null latest when there are no candles", async () => {
    prisma.marketCandle.findMany.mockResolvedValue([]);
    const latest = await service.getLatest("BTC", "1h");
    expect(latest).toBeNull();
  });
});
