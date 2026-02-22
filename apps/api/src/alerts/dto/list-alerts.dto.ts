import { IsUUID } from 'class-validator'

export class ListAlertsDto {
  @IsUUID()
  wallet_id!: string
}
