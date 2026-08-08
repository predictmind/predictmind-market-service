import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Coin } from "@prisma/client";
import { CoinsService } from "./coins.service";
import { CreateCoinDto } from "./dto/create-coin.dto";

@ApiTags("coins")
@Controller("coins")
export class CoinsController {
  constructor(private readonly coins: CoinsService) {}

  @Get()
  list(): Promise<Coin[]> {
    return this.coins.list();
  }

  @Get(":symbol")
  findOne(@Param("symbol") symbol: string): Promise<Coin> {
    return this.coins.findBySymbol(symbol);
  }

  // NOTE: creating coins should be admin-only. Role enforcement is handled at
  // the gateway/RBAC layer (TODO) — the service trusts the gateway for now.
  @Post()
  create(@Body() dto: CreateCoinDto): Promise<Coin> {
    return this.coins.create(dto);
  }
}
