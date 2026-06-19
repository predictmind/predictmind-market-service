import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { MarketController } from "./market/market.controller";

@Module({
  imports: [],
  controllers: [HealthController, MarketController],
  providers: [],
})
export class AppModule {}