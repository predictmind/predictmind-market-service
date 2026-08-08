import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Coin } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCoinDto } from "./dto/create-coin.dto";

interface SeedCoin {
  symbol: string;
  name: string;
  assetClass?: "CRYPTO" | "STOCK";
}

const DEFAULT_COINS: SeedCoin[] = [
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

// A starter set of large, liquid US stocks + ETFs. Data comes from Yahoo Finance
// (free, no key). More can be added anytime via POST /coins with assetClass STOCK.
const DEFAULT_STOCKS: SeedCoin[] = [
  { symbol: "AAPL", name: "Apple", assetClass: "STOCK" },
  { symbol: "MSFT", name: "Microsoft", assetClass: "STOCK" },
  { symbol: "GOOGL", name: "Alphabet (Google)", assetClass: "STOCK" },
  { symbol: "AMZN", name: "Amazon", assetClass: "STOCK" },
  { symbol: "NVDA", name: "NVIDIA", assetClass: "STOCK" },
  { symbol: "META", name: "Meta Platforms", assetClass: "STOCK" },
  { symbol: "TSLA", name: "Tesla", assetClass: "STOCK" },
  { symbol: "SPY", name: "S&P 500 ETF", assetClass: "STOCK" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", assetClass: "STOCK" },
];

@Injectable()
export class CoinsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /** Seed the standard coin + stock set on startup (idempotent: only inserts missing). */
  async onModuleInit(): Promise<void> {
    for (const coin of [...DEFAULT_COINS, ...DEFAULT_STOCKS]) {
      await this.prisma.coin.upsert({
        where: { symbol: coin.symbol },
        update: { assetClass: coin.assetClass ?? "CRYPTO" },
        create: { symbol: coin.symbol, name: coin.name, assetClass: coin.assetClass ?? "CRYPTO" },
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
      data: {
        symbol: dto.symbol.toUpperCase(),
        name: dto.name,
        assetClass: dto.assetClass ?? "CRYPTO",
      },
    });
  }
}
