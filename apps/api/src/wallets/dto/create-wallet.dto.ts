import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator'
import { Chain, WalletType, WalletStatus } from '../../entities'

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  address!: string

  @IsEnum(Chain)
  chain!: Chain

  @IsDateString()
  firstSeen!: string

  @IsEnum(WalletType)
  @IsOptional()
  type?: WalletType

  @IsEnum(WalletStatus)
  @IsOptional()
  status?: WalletStatus
}
