import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CandleDto, MarketService } from "./market.service";
import { IndicatorResult, IndicatorsService } from "./indicators/indicators.service";
import { AnalysisResult, AnalysisService } from "./analysis/analysis.service";
import { SyncService, SyncSummary } from "./sync.service";
import { ImportCandlesDto } from "./dto/import-candles.dto";

@ApiTags("market")
@Controller("market")
export class MarketController {
  constructor(
    private readonly market: MarketService,
    private readonly indicators: IndicatorsService,
    private readonly analysis: AnalysisService,
    private readonly sync: SyncService,
  ) {}

  // Manually trigger a sync of the latest candles for all active coins
  // (the same job runs automatically on a schedule). Admin/ops in production.
  @Post("sync")
  runSync(): Promise<SyncSummary> {
    return this.sync.syncOnce();
  }

  // Trigger an import from the public data source (admin/scheduled in prod).
  @Post("import")
  import(@Body() dto: ImportCandlesDto): Promise<{ imported: number }> {
    return this.market.importCandles(dto.symbol, dto.timeframe, dto.limit);
  }

  @Get("candles")
  candles(
    @Query("symbol") symbol: string,
    @Query("timeframe") timeframe: string,
    @Query("limit") limit?: string,
  ): Promise<CandleDto[]> {
    return this.market.getCandles(
      symbol,
      timeframe,
      limit ? Number(limit) : 100,
    );
  }

  @Get("latest")
  latest(
    @Query("symbol") symbol: string,
    @Query("timeframe") timeframe: string,
  ): Promise<CandleDto | null> {
    return this.market.getLatest(symbol, timeframe);
  }

  // Import funding-rate history from Binance futures (admin/scheduled in prod).
  @Post("funding/import")
  importFunding(
    @Body() dto: { symbol: string; limit?: number },
  ): Promise<{ imported: number }> {
    return this.market.importFunding(dto.symbol, dto.limit ?? 500);
  }

  @Get("funding")
  funding(
    @Query("symbol") symbol: string,
    @Query("limit") limit?: string,
  ): Promise<{ fundingRate: string; fundingTime: Date }[]> {
    return this.market.getFunding(symbol, limit ? Number(limit) : 500);
  }

  // Import open-interest history from Binance futures (admin/scheduled in prod).
  @Post("oi/import")
  importOpenInterest(
    @Body() dto: { symbol: string; timeframe: string; limit?: number },
  ): Promise<{ imported: number }> {
    return this.market.importOpenInterest(dto.symbol, dto.timeframe, dto.limit ?? 500);
  }

  @Get("oi")
  openInterest(
    @Query("symbol") symbol: string,
    @Query("timeframe") timeframe: string,
    @Query("limit") limit?: string,
  ): Promise<{ openInterest: string; timestamp: Date }[]> {
    return this.market.getOpenInterest(symbol, timeframe, limit ? Number(limit) : 500);
  }

  // Import global long/short account ratio from Binance futures.
  @Post("lsr/import")
  importLongShort(
    @Body() dto: { symbol: string; timeframe: string; limit?: number },
  ): Promise<{ imported: number }> {
    return this.market.importLongShort(dto.symbol, dto.timeframe, dto.limit ?? 500);
  }

  @Get("lsr")
  longShort(
    @Query("symbol") symbol: string,
    @Query("timeframe") timeframe: string,
    @Query("limit") limit?: string,
  ): Promise<{ longShortRatio: string; timestamp: Date }[]> {
    return this.market.getLongShort(symbol, timeframe, limit ? Number(limit) : 500);
  }

  // Import the market-wide Crypto Fear & Greed Index (alternative.me).
  @Post("fng/import")
  importFearGreed(@Body() dto: { limit?: number }): Promise<{ imported: number }> {
    return this.market.importFearGreed(dto.limit ?? 500);
  }

  @Get("fng")
  fearGreed(
    @Query("limit") limit?: string,
  ): Promise<{ value: number; classification: string; timestamp: Date }[]> {
    return this.market.getFearGreed(limit ? Number(limit) : 500);
  }

  @Get("indicators")
  getIndicators(
    @Query("symbol") symbol: string,
    @Query("timeframe") timeframe: string,
    @Query("indicator") indicator: string,
    @Query("period") period?: string,
    @Query("limit") limit?: string,
  ): Promise<IndicatorResult> {
    return this.indicators.compute(
      symbol,
      timeframe,
      indicator,
      period ? Number(period) : undefined,
      limit ? Number(limit) : 300,
    );
  }

  @Get("analysis")
  getAnalysis(
    @Query("symbol") symbol: string,
    @Query("timeframe") timeframe: string,
    @Query("limit") limit?: string,
  ): Promise<AnalysisResult> {
    return this.analysis.analyze(symbol, timeframe, limit ? Number(limit) : 300);
  }
}
