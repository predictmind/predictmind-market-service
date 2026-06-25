import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CoinsModule } from "./coins/coins.module";
import { HealthController } from "./health/health.controller";
import { MarketModule } from "./market/market.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CoinsModule,
    MarketModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
