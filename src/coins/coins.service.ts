import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Coin } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCoinDto } from "./dto/create-coin.dto";

const DEFAULT_COINS: { symbol: string; name: string }[] = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "MATIC", name: "Polygon" },
  { symbol: "DOT", name: "Polkadot" },
];

@Injectable()
export class CoinsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /** Seed the standard coin set on startup (idempotent: only inserts missing). */
  async onModuleInit(): Promise<void> {
    for (const coin of DEFAULT_COINS) {
      await this.prisma.coin.upsert({
        where: { symbol: coin.symbol },
        update: {},
        create: coin,
      });
    }
  }

  list(): Promise<Coin[]> {
    return this.prisma.coin.findMany({
      where: { status: "ACTIVE" },
      orderBy: { symbol: "asc" },
    });
  }

  async findBySymbol(symbol: string): Promise<Coin> {
    const coin = await this.prisma.coin.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    if (!coin) {
      throw new NotFoundException(`Coin ${symbol} not found`);
    }
    return coin;
  }

  create(dto: CreateCoinDto): Promise<Coin> {
    return this.prisma.coin.create({
      data: { symbol: dto.symbol.toUpperCase(), name: dto.name },
    });
  }
}
