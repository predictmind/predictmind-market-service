import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { SUPPORTED_TIMEFRAMES } from "../market.service";

export class ImportCandlesDto {
  @IsString()
  symbol!: string;

  @IsIn(SUPPORTED_TIMEFRAMES as unknown as string[])
  timeframe!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
