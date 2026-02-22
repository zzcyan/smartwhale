import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Wallet } from '../entities'
import { WalletsController } from './wallets.controller'
import { WalletsService } from './wallets.service'
import { WalletClusteringService } from './wallet-clustering.service'

@Module({
  imports: [TypeOrmModule.forFeature([Wallet])],
  controllers: [WalletsController],
  providers: [WalletsService, WalletClusteringService],
  exports: [WalletClusteringService],
})
export class WalletsModule {}
