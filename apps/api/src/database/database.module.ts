import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Wallet } from '../entities/wallet.entity'
import { WhaleScore } from '../entities/whale-score.entity'
import { Transaction } from '../entities/transaction.entity'
import { Alert } from '../entities/alert.entity'

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [Wallet, WhaleScore, Transaction, Alert],
        migrations: [],
        synchronize: false,
        ssl: { rejectUnauthorized: false },
        logging: process.env['NODE_ENV'] === 'development' ? ['error', 'warn'] : ['error'],
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
