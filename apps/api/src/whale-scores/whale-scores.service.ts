import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WhaleScore, Transaction, Wallet, WalletStatus } from '../entities'
import { WhaleScoreCalculator, ScoreResult } from './whale-score.calculator'

export interface RecalculateResult extends ScoreResult {
  /** Snapshot do score salvo no banco. Null quando wallet está em OBSERVACAO. */
  score: WhaleScore | null
}

@Injectable()
export class WhaleScoresService {
  constructor(
    @InjectRepository(WhaleScore)
    private readonly scoreRepo: Repository<WhaleScore>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    private readonly calculator: WhaleScoreCalculator,
  ) {}

  async findLatestByWallet(walletId: string): Promise<WhaleScore> {
    const score = await this.scoreRepo.findOne({
      where: { wallet: { id: walletId } },
      order: { calculatedAt: 'DESC' },
    })

    if (!score) {
      throw new NotFoundException(`No score found for wallet ${walletId}`)
    }

    return score
  }

  /**
   * Busca todas as transações finalizadas da wallet no banco e recalcula o Whale Score™.
   *
   * Pipeline:
   *   1. Buscar wallet (lança NotFoundException se não existir)
   *   2. Buscar todas as transações com isFinalized = true, ordenadas por timestamp ASC
   *   3. Chamar WhaleScoreCalculator.calculate() — somente dados finalizados (SPEC.md §5)
   *   4. Atualizar campos desnormalizados da wallet (currentScore, winRate, roi, status)
   *   5. Salvar novo snapshot WhaleScore (pulado para wallets OBSERVACAO)
   *   6. Retornar RecalculateResult com breakdown completo
   */
  async recalculate(walletId: string): Promise<RecalculateResult> {
    // 1. Garantir que a wallet existe
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } })
    if (!wallet) {
      throw new NotFoundException(`Wallet ${walletId} not found`)
    }

    // 2. Buscar transações finalizadas — REGRA CRÍTICA: nunca calcular com dados não-finalizados
    const finalizedTxs = await this.txRepo.find({
      where: { wallet: { id: walletId }, isFinalized: true },
      order: { timestamp: 'ASC' },
    })

    // 3. Calcular score
    const result = this.calculator.calculate(finalizedTxs)

    // 4. Atualizar campos desnormalizados da wallet
    wallet.status = result.status
    wallet.totalOperations = result.totalOperations
    wallet.winRate = String(result.winRate)
    wallet.roi = String(result.roiAdjusted)

    const effectiveScore = result.scoreAllTime ?? result.score90d
    wallet.currentScore = effectiveScore !== null ? String(effectiveScore) : null

    await this.walletRepo.save(wallet)

    // 5. Wallets em OBSERVACAO não recebem snapshot de score público
    if (result.status === WalletStatus.OBSERVACAO) {
      return { ...result, score: null }
    }

    // 6. Persistir snapshot do score
    //    scoreAllTime usa fallback para score90d quando wallet é NEWCOMER (< 3 meses),
    //    pois o campo não é nullable na entidade — a categoria NEWCOMER comunica isso.
    const scoreEntity = this.scoreRepo.create({
      wallet,
      scoreAllTime: String(result.scoreAllTime ?? result.score90d ?? 0),
      score90d: String(result.score90d ?? 0),
      winRate: String(result.winRate),
      sharpeRatio: String(result.sharpeRatio),
      roiAdjusted: String(result.roiAdjusted),
      totalOperations: result.totalOperations,
      calculatedAt: new Date(),
    })

    const savedScore = await this.scoreRepo.save(scoreEntity)

    return { ...result, score: savedScore }
  }
}
