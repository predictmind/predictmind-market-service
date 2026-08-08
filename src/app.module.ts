import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AlertsModule } from "./alerts/alerts.module";
import { CoinsModule } from "./coins/coins.module";
import { HealthController } from "./health/health.controller";
import { MarketModule } from "./market/market.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CoinsModule,
    MarketModule,
    AlertsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
