import { IsEnum, IsOptional } from 'class-validator'
import { WalletType, WalletStatus } from '../../entities'

export class UpdateWalletDto {
  @IsEnum(WalletType)
  @IsOptional()
  type?: WalletType | null

  @IsEnum(WalletStatus)
  @IsOptional()
  status?: WalletStatus
}
