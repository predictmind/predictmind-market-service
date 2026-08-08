import { Module } from "@nestjs/common";
import { CoinsModule } from "../coins/coins.module";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";

@Module({
  imports: [CoinsModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
