import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DatabaseModule } from './database/database.module'
import { Alert, Transaction, Wallet } from './entities'
import { IndexerModule } from './indexer/indexer.module'
import { WalletsModule } from './wallets/wallets.module'
import { TransactionsModule } from './transactions/transactions.module'
import { AlertsModule } from './alerts/alerts.module'
import { WhaleScoresModule } from './whale-scores/whale-scores.module'
import { ScoringModule } from './scoring/scoring.module'
import { JobsModule } from './jobs/jobs.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    TypeOrmModule.forFeature([Wallet, Transaction, Alert]),
    WalletsModule,
    TransactionsModule,
    AlertsModule,
    WhaleScoresModule,
    ScoringModule,
    JobsModule,
    IndexerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
