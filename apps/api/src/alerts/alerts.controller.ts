import { Controller, Get, Patch, Param, Query } from '@nestjs/common'
import { AlertsService } from './alerts.service'
import { ListAlertsDto } from './dto/list-alerts.dto'

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(@Query() query: ListAlertsDto) {
    return this.alertsService.findByWallet(query.wallet_id)
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.alertsService.markAsRead(id)
  }
}
