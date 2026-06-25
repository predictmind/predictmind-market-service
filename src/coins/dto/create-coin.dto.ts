import { IsString, Matches, MaxLength } from "class-validator";

export class CreateCoinDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]{2,15}$/, {
    message: "symbol must be 2-15 letters/digits",
  })
  symbol!: string;

  @IsString()
  @MaxLength(60)
  name!: string;
}
