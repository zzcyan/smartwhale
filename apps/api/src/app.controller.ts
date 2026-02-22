import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  healthCheck(): { status: string; timestamp: string } {
    return this.appService.healthCheck()
  }

  @Get('stats')
  getStats(): Promise<{ totalWallets: number; totalTransactions: number; totalAlerts: number }> {
    return this.appService.getStats()
  }
}
