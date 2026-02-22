import { Chain, TransactionType } from '../entities'

// ─── ParsedTransaction ────────────────────────────────────────────────────────

/**
 * Representação normalizada de uma transação on-chain extraída de qualquer chain.
 * Produzida por cada implementação de ChainIndexer.
 */
export interface ParsedTransaction {
  /** Endereço da wallet que iniciou a transação. */
  wallet: string
  /** Chain de origem. */
  chain: Chain
  /** Endereço do contrato do token comprado/vendido. */
  token: string
  /** Símbolo do token, ou null se não disponível. */
  tokenSymbol: string | null
  /** Direção da operação: BUY = recebeu o token, SELL = enviou o token. */
  type: TransactionType
  /** Valor estimado em USD da operação. */
  amountUsd: number
  /** Hash / assinatura da transação. */
  txHash: string
  /** Número do bloco (slot em Solana). */
  blockNumber: bigint
  /** Timestamp on-chain da transação. */
  timestamp: Date
}

// ─── ChainIndexer ─────────────────────────────────────────────────────────────

/**
 * Contrato que cada implementação de chain deve seguir.
 *
 * start()  → iniciado no bootstrap (para chains com polling / WebSocket).
 * stop()   → chamado no shutdown graceful.
 * parseTransaction() → converte o payload raw do provider em ParsedTransaction.
 *                      Retorna null quando a transação não deve ser processada
 *                      (não é swap, abaixo do threshold, etc.).
 */
export interface ChainIndexer {
  start(): Promise<void>
  stop(): Promise<void>
  parseTransaction(rawPayload: unknown): ParsedTransaction | null
}
