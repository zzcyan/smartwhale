import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, MoreThan } from 'typeorm'
import {
  Chain,
  Transaction,
  TransactionStatus,
  Wallet,
  WalletStatus,
} from '../entities'
import { AccumulationDetector } from '../scoring/accumulation.detector'
import { ConfluenceDetector } from '../scoring/confluence.detector'
import { SolanaIndexer } from './chains/solana.indexer'

// ─── IndexerService ───────────────────────────────────────────────────────────

/**
 * Orquestra o pipeline de ingestão de transações on-chain.
 *
 * Fluxo por transação do webhook:
 *   1. SolanaIndexer.parseTransaction() → ParsedTransaction | null
 *   2. Se null → skip (não é swap qualificado)
 *   3. Busca ou cria Wallet (status: observacao)
 *   4. Salva Transaction (status: pendente, isFinalized: false)
 *   5. AccumulationDetector.detect() com transações recentes da wallet
 *   6. ConfluenceDetector.detect() com BUYs recentes do mesmo token
 *
 * REGRA CRÍTICA (CLAUDE.md):
 *   Transações são salvas com isFinalized: false.
 *   O cálculo de score NUNCA usa dados não-finalizados.
 *   A finalização (vote transactions) é responsabilidade de job separado.
 */
@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name)

  /** Janela de busca de transações recentes para AccumulationDetector (7 dias em ms). */
  private static readonly ACCUMULATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

  /** Janela de busca de transações recentes para ConfluenceDetector (4 horas em ms). */
  private static readonly CONFLUENCE_WINDOW_MS = 4 * 60 * 60 * 1000

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly solanaIndexer: SolanaIndexer,
    private readonly accumulationDetector: AccumulationDetector,
    private readonly confluenceDetector: ConfluenceDetector,
  ) {}

  // ── API pública ────────────────────────────────────────────────────────────

  /**
   * Processa o array de EnhancedTransaction recebido pelo webhook do Helius.
   *
   * @param rawTransactions Array de objetos enviados pelo Helius (unknown[]).
   */
  async processHeliusWebhook(rawTransactions: unknown[]): Promise<void> {
    for (const raw of rawTransactions) {
      try {
        await this.processSingle(raw)
      } catch (err) {
        this.logger.error('[IndexerService] Erro ao processar transação:', err)
      }
    }
  }

  // ── Pipeline interno ───────────────────────────────────────────────────────

  private async processSingle(raw: unknown): Promise<void> {
    // 1. Parse + filtragem (tipo, threshold $5k, etc.)
    const parsed = this.solanaIndexer.parseTransaction(raw)
    if (parsed === null) return

    // 2. Busca ou cria a wallet
    const wallet = await this.findOrCreateWallet(parsed.wallet, parsed.chain)

    // 3. Salva a transação como PENDENTE (não finalizada — SPEC.md §5 / CLAUDE.md)
    const savedTx = await this.savePendingTransaction(parsed, wallet)

    // 3a. Incrementa totalOperations atomicamente (UPDATE ... SET totalOperations = totalOperations + 1)
    await this.walletRepo.increment({ id: wallet.id }, 'totalOperations', 1)

    this.logger.log(
      `[IndexerService] Tx salva: ${parsed.type} ${parsed.token} | wallet: ${parsed.wallet} | $${parsed.amountUsd.toFixed(2)}`,
    )

    // 4. AccumulationDetector — avalia padrão de acumulação silenciosa da wallet
    await this.runAccumulationDetector(wallet, savedTx)

    // 5. ConfluenceDetector — avalia confluência de whales no token
    await this.runConfluenceDetector(parsed.token, parsed.chain)
  }

  // ── Find or create wallet ──────────────────────────────────────────────────

  private async findOrCreateWallet(address: string, chain: Chain): Promise<Wallet> {
    const existing = await this.walletRepo.findOne({ where: { address, chain } })
    if (existing) return existing

    const wallet = this.walletRepo.create({
      address,
      chain,
      status: WalletStatus.OBSERVACAO,
      firstSeen: new Date(),
    })
    const saved = await this.walletRepo.save(wallet)
    this.logger.log(`[IndexerService] Nova wallet criada: ${address} (${chain})`)
    return saved
  }

  // ── Save transaction ───────────────────────────────────────────────────────

  private async savePendingTransaction(
    parsed: ReturnType<SolanaIndexer['parseTransaction']> & {},
    wallet: Wallet,
  ): Promise<Transaction> {
    const tx = this.txRepo.create({
      wallet,
      chain: parsed.chain,
      tokenAddress: parsed.token,
      tokenSymbol: parsed.tokenSymbol,
      type: parsed.type,
      amountUsd: parsed.amountUsd.toString(),
      txHash: parsed.txHash,
      blockNumber: parsed.blockNumber.toString(),
      timestamp: parsed.timestamp,
      // CAMPO CRÍTICO: nunca calcular score com dados não-finalizados (CLAUDE.md)
      status: TransactionStatus.PENDENTE,
      isFinalized: false,
    })
    return this.txRepo.save(tx)
  }

  // ── AccumulationDetector ───────────────────────────────────────────────────

  private async runAccumulationDetector(wallet: Wallet, _savedTx: Transaction): Promise<void> {
    const windowStart = new Date(Date.now() - IndexerService.ACCUMULATION_WINDOW_MS)

    const recentTxs = await this.txRepo.find({
      where: {
        wallet: { id: wallet.id },
        timestamp: MoreThan(windowStart),
      },
      order: { timestamp: 'ASC' },
    })

    await this.accumulationDetector.detect({
      walletId: wallet.id,
      transactions: recentTxs,
      // Volume diário dos tokens: Map vazio no MVP.
      // O detector ignora o filtro de 3% quando o volume não está disponível (ver acumulação.detector.ts).
      tokenDailyVolumes: new Map(),
    })
  }

  // ── ConfluenceDetector ─────────────────────────────────────────────────────

  private async runConfluenceDetector(tokenAddress: string, _chain: Chain): Promise<void> {
    const windowStart = new Date(Date.now() - IndexerService.CONFLUENCE_WINDOW_MS)

    // Busca BUYs recentes do mesmo token de qualquer wallet, com relação `wallet` carregada
    // (ConfluenceDetector precisa do wallet.currentScore para calcular o score médio)
    const recentTokenTxs = await this.txRepo.find({
      where: {
        tokenAddress,
        timestamp: MoreThan(windowStart),
      },
      relations: ['wallet'],
      order: { timestamp: 'DESC' },
    })

    await this.confluenceDetector.detect({ transactions: recentTokenTxs })
  }
}
