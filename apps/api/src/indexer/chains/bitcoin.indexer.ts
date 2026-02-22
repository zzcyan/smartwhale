import { Injectable, Logger } from '@nestjs/common'
import type { ChainIndexer, ParsedTransaction } from '../indexer.interface'

/**
 * Stub do indexador Bitcoin — rastreamento de saldo apenas (Fase 1).
 *
 * Implementação real (Fase 2 — SPEC.md §19):
 *   - Conecta via Blockstream.info API (primário) ou Mempool.space (fallback)
 *   - Rastreia coin age: data de recebimento vs. data de gasto do UTXO
 *   - ROI completo depende de oráculos de preço histórico (fora do escopo do MVP)
 *   - Finalidade: 6 confirmações (SPEC.md §5.2)
 *   - parseTransaction() sempre retorna null nesta fase (sem conceito de swap em Bitcoin)
 */
@Injectable()
export class BitcoinIndexer implements ChainIndexer {
  private readonly logger = new Logger(BitcoinIndexer.name)

  async start(): Promise<void> {
    this.logger.warn('[BitcoinIndexer] not implemented — rastreamento de saldo é fase 2.')
  }

  async stop(): Promise<void> {
    this.logger.warn('[BitcoinIndexer] not implemented — stub ativo.')
  }

  parseTransaction(_rawPayload: unknown): ParsedTransaction | null {
    return null
  }
}
