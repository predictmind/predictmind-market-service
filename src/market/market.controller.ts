import { Controller, Get } from "@nestjs/common";

// Market data, coins and technical indicators
@Controller("market")
export class MarketController {
  @Get()
  info(): { service: string; description: string } {
    return {
      service: "market",
      description: "Market data, coins and technical indicators",
    };
  }
}