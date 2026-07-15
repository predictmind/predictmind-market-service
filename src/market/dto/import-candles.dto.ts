import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { SUPPORTED_TIMEFRAMES } from "../market.service";

export class ImportCandlesDto {
  @IsString()
  symbol!: string;

  @IsIn(SUPPORTED_TIMEFRAMES as unknown as string[])
  timeframe!: string;

  // Up to 20000 candles; the service pages the Binance API (max 1000/request)
  // backwards to collect deep history.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  limit?: number;
}
