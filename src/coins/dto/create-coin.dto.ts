import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CreateCoinDto {
  @IsString()
  @Matches(/^[A-Za-z0-9.-]{1,15}$/, {
    message: "symbol must be 1-15 letters/digits (dots/dashes allowed for stocks)",
  })
  symbol!: string;

  @IsString()
  @MaxLength(60)
  name!: string;

  /** "CRYPTO" (default) or "STOCK" — decides which data source imports candles. */
  @IsOptional()
  @IsIn(["CRYPTO", "STOCK"])
  assetClass?: "CRYPTO" | "STOCK";
}
