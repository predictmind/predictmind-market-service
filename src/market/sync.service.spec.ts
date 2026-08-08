import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { CoinsService } from "../coins/coins.service";
import { MarketService } from "./market.service";
import { SyncService } from "./sync.service";

describe("SyncService", () => {
  let service: SyncService;
  let market: { importCandles: jest.Mock };
  let coins: { list: jest.Mock };

  beforeEach(async () => {
    market = { importCandles: jest.fn().mockResolvedValue({ imported: 1 }) };
    coins = {
      list: jest
        .fn()
        .mockResolvedValue([{ symbol: "BTC" }, { symbol: "ETH" }]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: MarketService, useValue: market },
        { provide: CoinsService, useValue: coins },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              key === "SYNC_TIMEFRAMES" ? "1h" : fallback,
          },
        },
      ],
    }).compile();

    service = moduleRef.get<SyncService>(SyncService);
  });

  it("syncs every coin and sums the imported candles", async () => {
    const summary = await service.syncOnce();
    expect(summary.coins).toBe(2);
    expect(market.importCandles).toHaveBeenCalledTimes(2);
    expect(summary.imported).toBe(2);
  });

  it("keeps going when one coin fails", async () => {
    market.importCandles
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ imported: 5 });
    const summary = await service.syncOnce();
    expect(summary.imported).toBe(5); // first failed, second counted
  });
});
