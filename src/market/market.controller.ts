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
