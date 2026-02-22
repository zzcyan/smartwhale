import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator'

export class ListTransactionsDto {
  @IsUUID()
  @IsOptional()
  wallet_id?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0
}
