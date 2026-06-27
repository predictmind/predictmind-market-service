import { Module } from "@nestjs/common";
import { CoinsModule } from "../coins/coins.module";
import { AnalysisService } from "./analysis/analysis.service";
import { IndicatorsService } from "./indicators/indicators.service";
import { MarketController } from "./market.controller";
import { MarketService } from "./market.service";

@Module({
  imports: [CoinsModule],
  controllers: [MarketController],
  providers: [MarketService, IndicatorsService, AnalysisService],
})
export class MarketModule {}
