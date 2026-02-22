import { Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue, Process, Processor } from '@nestjs/bull'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, MoreThanOrEqual } from 'typeorm'
import { Job, Queue } from 'bull'

import { Wallet, WalletStatus, Transaction } from '../entities'
import { WhaleScoresService } from '../whale-scores/whale-scores.service'
import { AccumulationDetector } from '../scoring/accumulation.detector'
import { ConfluenceDetector } from '../scoring/confluence.detector'

export const SCORING_QUEUE = 'scoring'

export const ScoringJobName = {
  RECALCULATE_SCORES: 'RECALCULATE_SCORES',
  DETECT_ACCUMULATION: 'DETECT_ACCUMULATION',
  DETECT_CONFLUENCE: 'DETECT_CONFLUENCE',
} as const

// ─── Cron expressions ─────────────────────────────────────────────────────────

/** A cada 6 horas */
const CRON_RECALCULATE = '0 */6 * * *'

/** A cada 30 minutos */
const CRON_ACCUMULATION = '*/30 * * * *'

/** A cada 5 minutos */
const CRON_CONFLUENCE = '*/5 * * * *'

// ─── Janelas de tempo ─────────────────────────────────────────────────────────

const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000
const MS_4_HOURS = 4 * 60 * 60 * 1000

// ─── Processor ────────────────────────────────────────────────────────────────

@Processor(SCORING_QUEUE)
export class ScoringJob implements OnModuleInit {
  private readonly logger = new Logger(ScoringJob.name)

  constructor(
    @InjectQueue(SCORING_QUEUE)
    private readonly scoringQueue: Queue,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly whaleScoresService: WhaleScoresService,
    private readonly accumulationDetector: AccumulationDetector,
    private readonly confluenceDetector: ConfluenceDetector,
  ) {}

  /**
   * Registra os três jobs recorrentes no Bull ao subir o módulo.
   * O Bull deduplicará jobs com o mesmo nome + cron (idempotente em reinicios).
   */
  async onModuleInit(): Promise<void> {
    await this.scoringQueue.add(
      ScoringJobName.RECALCULATE_SCORES,
      {},
      { repeat: { cron: CRON_RECALCULATE }, removeOnComplete: true, removeOnFail: false },
    )

    await this.scoringQueue.add(
      ScoringJobName.DETECT_ACCUMULATION,
      {},
      { repeat: { cron: CRON_ACCUMULATION }, removeOnComplete: true, removeOnFail: false },
    )

    await this.scoringQueue.add(
      ScoringJobName.DETECT_CONFLUENCE,
      {},
      { repeat: { cron: CRON_CONFLUENCE }, removeOnComplete: true, removeOnFail: false },
    )

    this.logger.log(
      `Jobs registrados: ${CRON_RECALCULATE} | ${CRON_ACCUMULATION} | ${CRON_CONFLUENCE}`,
    )
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  /**
   * Recalcula o Whale Score™ de todas as wallets ativas.
   * Cron: a cada 6 horas.
   *
   * Delega para WhaleScoresService.recalculate(), que:
   *   - filtra transações com isFinalized = true (SPEC.md §5)
   *   - persiste novo snapshot WhaleScore
   *   - atualiza campos desnormalizados da wallet (currentScore, winRate, roi, status)
   */
  @Process(ScoringJobName.RECALCULATE_SCORES)
  async handleRecalculateScores(job: Job): Promise<void> {
    this.logger.log(`[${job.id}] Iniciando recálculo de scores`)

    const wallets = await this.walletRepo.find({
      where: { status: WalletStatus.ACTIVE },
      select: ['id'],
    })

    let processed = 0
    let errors = 0

    for (const wallet of wallets) {
      try {
        await this.whaleScoresService.recalculate(wallet.id)
        processed++
      } catch (err) {
        errors++
        this.logger.error(`Erro ao recalcular wallet ${wallet.id}: ${(err as Error).message}`)
      }
    }

    this.logger.log(
      `[${job.id}] Recálculo concluído — processadas: ${processed}, erros: ${errors}`,
    )
  }

  /**
   * Detecta acumulação silenciosa para cada wallet ativa.
   * Cron: a cada 30 minutos.
   *
   * Busca transações dos últimos 7 dias e passa para AccumulationDetector.detect().
   * tokenDailyVolumes passado vazio: sem dados de mercado no MVP,
   * o filtro de volume é ignorado internamente pelo detector.
   */
  @Process(ScoringJobName.DETECT_ACCUMULATION)
  async handleDetectAccumulation(job: Job): Promise<void> {
    this.logger.log(`[${job.id}] Iniciando detecção de acumulação`)

    const wallets = await this.walletRepo.find({
      where: { status: WalletStatus.ACTIVE },
      select: ['id'],
    })

    const windowStart = new Date(Date.now() - MS_7_DAYS)
    let signalsTotal = 0

    for (const wallet of wallets) {
      try {
        const transactions = await this.txRepo.find({
          where: {
            wallet: { id: wallet.id },
            timestamp: MoreThanOrEqual(windowStart),
          },
        })

        const detected = await this.accumulationDetector.detect({
          walletId: wallet.id,
          transactions,
          tokenDailyVolumes: new Map(),
        })

        signalsTotal += detected.length
      } catch (err) {
        this.logger.error(
          `Erro na detecção de acumulação (wallet ${wallet.id}): ${(err as Error).message}`,
        )
      }
    }

    this.logger.log(
      `[${job.id}] Detecção de acumulação concluída — sinais: ${signalsTotal}`,
    )
  }

  /**
   * Detecta sinais de confluência entre wallets ativas.
   * Cron: a cada 5 minutos.
   *
   * Busca transações das últimas 4 horas de todas as wallets ativas,
   * carregando a relação wallet (necessário para tx.wallet.currentScore).
   */
  @Process(ScoringJobName.DETECT_CONFLUENCE)
  async handleDetectConfluence(job: Job): Promise<void> {
    this.logger.log(`[${job.id}] Iniciando detecção de confluência`)

    const windowStart = new Date(Date.now() - MS_4_HOURS)

    const transactions = await this.txRepo.find({
      where: {
        wallet: { status: WalletStatus.ACTIVE },
        timestamp: MoreThanOrEqual(windowStart),
      },
      relations: ['wallet'],
    })

    try {
      const signals = await this.confluenceDetector.detect({ transactions })

      this.logger.log(
        `[${job.id}] Detecção de confluência concluída — sinais: ${signals.length}`,
      )
    } catch (err) {
      this.logger.error(`Erro na detecção de confluência: ${(err as Error).message}`)
    }
  }
}
