import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CoinsService } from "../coins/coins.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAlertDto } from "./alerts.dto";

/**
 * Price alerts, evaluated **server-side** on a timer — so an alert fires even if
 * no browser is open. We compare each active alert's target to the latest stored
 * candle price for its symbol and flip ACTIVE -> TRIGGERED when the condition is
 * met. Kept in the market service because that's where live prices live.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private checking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly coins: CoinsService,
  ) {}

  async create(userId: string, dto: CreateAlertDto) {
    // Validate the symbol exists (works for crypto and stocks alike).
    await this.coins.findBySymbol(dto.symbol);
    return this.prisma.priceAlert.create({
      data: {
        userId,
        symbol: dto.symbol.toUpperCase(),
        condition: dto.condition,
        price: dto.price,
        note: dto.note,
      },
    });
  }

  list(userId: string) {
    return this.prisma.priceAlert.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async remove(userId: string, id: string) {
    const alert = await this.prisma.priceAlert.findUnique({ where: { id } });
    if (!alert || alert.userId !== userId) throw new NotFoundException(`Alert ${id} not found`);
    await this.prisma.priceAlert.delete({ where: { id } });
    return { deleted: true };
  }

  /** Reactivate a triggered alert (arm it again). */
  async reset(userId: string, id: string) {
    const alert = await this.prisma.priceAlert.findUnique({ where: { id } });
    if (!alert || alert.userId !== userId) throw new NotFoundException(`Alert ${id} not found`);
    return this.prisma.priceAlert.update({
      where: { id },
      data: { status: "ACTIVE", triggeredAt: null, triggeredPrice: null },
    });
  }

  /** Latest stored price for a symbol (freshest candle across any timeframe). */
  private async latestPrice(symbol: string): Promise<number | null> {
    let coinId: string;
    try {
      const coin = await this.coins.findBySymbol(symbol);
      coinId = coin.id;
    } catch {
      return null;
    }
    const candle = await this.prisma.marketCandle.findFirst({
      where: { coinId },
      orderBy: { openTime: "desc" },
      select: { close: true },
    });
    return candle ? Number(candle.close) : null;
  }

  /** Evaluate every active alert; triggered ones flip status. Runs each minute. */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAll(): Promise<{ checked: number; triggered: number }> {
    if (this.checking) return { checked: 0, triggered: 0 };
    this.checking = true;
    try {
      const active = await this.prisma.priceAlert.findMany({ where: { status: "ACTIVE" } });
      if (active.length === 0) return { checked: 0, triggered: 0 };

      const priceCache = new Map<string, number | null>();
      let triggered = 0;

      for (const alert of active) {
        if (!priceCache.has(alert.symbol)) {
          priceCache.set(alert.symbol, await this.latestPrice(alert.symbol));
        }
        const price = priceCache.get(alert.symbol);
        if (price == null) continue;

        const target = Number(alert.price);
        const hit = alert.condition === "above" ? price >= target : price <= target;
        if (hit) {
          await this.prisma.priceAlert.update({
            where: { id: alert.id },
            data: { status: "TRIGGERED", triggeredAt: new Date(), triggeredPrice: price },
          });
          triggered++;
        }
      }
      if (triggered > 0) this.logger.log(`Price alerts: ${triggered} triggered`);
      return { checked: active.length, triggered };
    } catch (e) {
      this.logger.error(`Alert check failed: ${e instanceof Error ? e.message : e}`);
      return { checked: 0, triggered: 0 };
    } finally {
      this.checking = false;
    }
  }
}
