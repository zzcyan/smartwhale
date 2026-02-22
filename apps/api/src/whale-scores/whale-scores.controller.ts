import { Controller, Get, Post, Param } from '@nestjs/common'
import { WhaleScoresService } from './whale-scores.service'

@Controller('whale-scores')
export class WhaleScoresController {
  constructor(private readonly whaleScoresService: WhaleScoresService) {}

  @Get(':wallet_id')
  findLatest(@Param('wallet_id') walletId: string) {
    return this.whaleScoresService.findLatestByWallet(walletId)
  }

  /**
   * Busca todas as transações finalizadas da wallet e recalcula o Whale Score™.
   *
   * Retorna o breakdown completo:
   *   - scoreAllTime, score90d (null se não qualificado)
   *   - winRate, sharpeRatio, roiAdjusted, consistency
   *   - totalOperations, historyMonths
   *   - status (active | observacao | desqualificado)
   *   - category (MAIN | HIGH_RISK_HIGH_REWARD | NEWCOMER)
   *   - score: snapshot salvo no banco (null quando status = observacao)
   */
  @Post(':wallet_id/recalculate')
  recalculate(@Param('wallet_id') walletId: string) {
    return this.whaleScoresService.recalculate(walletId)
  }
}
