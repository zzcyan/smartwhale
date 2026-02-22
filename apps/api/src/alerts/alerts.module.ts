import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Alert, Wallet, Transaction } from '../entities'
import { AlertsController } from './alerts.controller'
import { AlertsService } from './alerts.service'

@Module({
  imports: [TypeOrmModule.forFeature([Alert, Wallet, Transaction])],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
