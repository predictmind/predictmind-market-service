import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

/** Create a price alert: notify when `symbol` goes above/below `price`. */
export class CreateAlertDto {
  @ApiProperty({ example: "BTC" })
  @IsString()
  symbol!: string;

  @ApiProperty({ enum: ["above", "below"], example: "above" })
  @IsIn(["above", "below"])
  condition!: "above" | "below";

  @ApiProperty({ example: 70000 })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiPropertyOptional({ example: "breakout level" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}
