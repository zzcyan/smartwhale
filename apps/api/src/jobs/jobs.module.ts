import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bull'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Wallet, Transaction } from '../entities'
import { WhaleScoresModule } from '../whale-scores/whale-scores.module'
import { ScoringModule } from '../scoring/scoring.module'
import { ScoringJob, SCORING_QUEUE } from './scoring.job'

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>('REDIS_URL')
        const parsed = new URL(redisUrl)
        const tls = parsed.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined
        return {
          redis: {
            host: parsed.hostname,
            port: Number(parsed.port) || (tls ? 6380 : 6379),
            username: parsed.username || undefined,
            password: parsed.password || undefined,
            tls,
          },
        }
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: SCORING_QUEUE }),
    TypeOrmModule.forFeature([Wallet, Transaction]),
    WhaleScoresModule,
    ScoringModule,
  ],
  providers: [ScoringJob],
})
export class JobsModule {}
