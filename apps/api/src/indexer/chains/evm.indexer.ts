import { Injectable, Logger } from '@nestjs/common'
import type { ChainIndexer, ParsedTransaction } from '../indexer.interface'

/**
 * Stub do indexador EVM — placeholder para Ethereum, Base, Arbitrum, BNB Chain e Tron.
 *
 * Implementação real:
 *   - Conecta via Alchemy (free tier) usando WebSocket para blocos novos
 *   - Parseia logs de Transfer e Swap dos DEXes relevantes (Uniswap V2/V3, etc.)
 *   - Implementa circuit breaker com fallback para segundo endpoint (SPEC.md §6)
 *   - Determina finalidade após ~12 blocos (SPEC.md §5.2)
 */
@Injectable()
export class EvmIndexer implements ChainIndexer {
  private readonly logger = new Logger(EvmIndexer.name)

  async start(): Promise<void> {
    this.logger.warn('[EvmIndexer] not implemented — stub ativo.')
  }

  async stop(): Promise<void> {
    this.logger.warn('[EvmIndexer] not implemented — stub ativo.')
  }

  parseTransaction(_rawPayload: unknown): ParsedTransaction | null {
    return null
  }
}
