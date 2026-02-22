import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WhaleScore, Transaction, Wallet } from '../entities'
import { WhaleScoresController } from './whale-scores.controller'
import { WhaleScoresService } from './whale-scores.service'
import { WhaleScoreCalculator } from './whale-score.calculator'

@Module({
  imports: [TypeOrmModule.forFeature([WhaleScore, Transaction, Wallet])],
  controllers: [WhaleScoresController],
  providers: [WhaleScoresService, WhaleScoreCalculator],
  exports: [WhaleScoresService],
})
export class WhaleScoresModule {}
