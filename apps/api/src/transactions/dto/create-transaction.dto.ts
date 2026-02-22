import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator'
import { Chain, TransactionType } from '../../entities'

export class CreateTransactionDto {
  @IsUUID()
  walletId!: string

  @IsString()
  @IsNotEmpty()
  tokenAddress!: string

  @IsString()
  @IsOptional()
  tokenSymbol?: string

  @IsEnum(Chain)
  chain!: Chain

  @IsEnum(TransactionType)
  type!: TransactionType

  @IsString()
  @IsNotEmpty()
  amountUsd!: string

  @IsString()
  @IsNotEmpty()
  txHash!: string

  @IsString()
  @IsNotEmpty()
  blockNumber!: string

  @IsDateString()
  timestamp!: string
}
