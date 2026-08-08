import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CoinsService } from "../coins/coins.service";
import { MarketService } from "./market.service";

export interface SyncSummary {
  coins: number;
  timeframes: string[];
  imported: number;
}

/**
 * Keeps stored candles fresh by periodically pulling the latest few candles for
 * every active coin. Relies on the importer's de-duplication (createMany
 * skipDuplicates), so re-running is always safe.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly market: MarketService,
    private readonly coins: CoinsService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledSync(): Promise<void> {
    if (this.config.get<string>("SYNC_ENABLED", "true") !== "true") {
      return;
    }
    await this.syncOnce();
  }

  /** Pull the latest candles for every active coin across the configured timeframes. */
  async syncOnce(): Promise<SyncSummary> {
    const timeframes = (this.config.get<string>("SYNC_TIMEFRAMES", "1h") ?? "1h")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const coins = await this.coins.list();
    let imported = 0;

    for (const coin of coins) {
      for (const timeframe of timeframes) {
        try {
          const result = await this.market.importCandles(coin.symbol, timeframe, 3);
          imported += result.imported;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "unknown error";
          this.logger.warn(`Sync failed for ${coin.symbol} ${timeframe}: ${message}`);
        }
      }
    }

    this.logger.log(
      `Sync complete: ${imported} new candle(s) across ${coins.length} coin(s)`,
    );
    return { coins: coins.length, timeframes, imported };
  }
}
