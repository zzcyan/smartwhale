import { Injectable, Logger } from '@nestjs/common'
import { Chain, TransactionType } from '../../entities'
import type { ChainIndexer, ParsedTransaction } from '../indexer.interface'

// ─── Tipos do payload Helius Enhanced Webhook ─────────────────────────────────
// Definidos localmente para compatibilidade com moduleResolution: Node10.
// Espelham o formato real do Helius enhanced transaction webhook.

interface HeliusTokenTransfer {
  fromUserAccount: string
  toUserAccount: string
  mint: string
  /** Valor já em formato UI (decimal ajustado). Ex: 6000.5 para 6000.5 USDC. */
  tokenAmount: number | string
}

interface HeliusEnhancedTransaction {
  /** Tipo da transação: "SWAP", "TRANSFER", "NFT_SALE", etc. */
  type?: string
  /** Wallet que pagou a taxa (iniciador do swap). */
  feePayer?: string
  /** Assinatura da transação (hash). */
  signature: string
  /** Slot em que a transação foi confirmada. */
  slot?: number
  /** Unix timestamp do bloco (segundos). */
  timestamp?: number
  /** Transferências de tokens SPL no contexto da transação. */
  tokenTransfers?: HeliusTokenTransfer[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** USDC na Solana mainnet. */
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

/** USDT na Solana mainnet. */
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'

/** Conjunto de stablecoins usados como referência de valor em USD. */
const STABLECOIN_MINTS = new Set([USDC_MINT, USDT_MINT])

/** Valor mínimo em USD para que a transação seja processada (SPEC.md §indexer). */
const MIN_USD = 5_000

// ─── SolanaIndexer ────────────────────────────────────────────────────────────

/**
 * Indexador Solana via Helius enhanced webhook.
 *
 * Recebe transações pelo endpoint POST /indexer/helius/webhook e extrai:
 *   - wallet (feePayer)
 *   - token (o lado não-stablecoin do swap)
 *   - tipo (BUY quando wallet recebe o token, SELL quando envia)
 *   - valor em USD (a partir do lado stablecoin do swap)
 *
 * Retorna null para:
 *   - Transações que não são SWAP
 *   - Swaps sem stablecoin em nenhum dos lados (não é possível calcular USD no MVP)
 *   - Swaps cujo valor em USD é < $5.000
 */
@Injectable()
export class SolanaIndexer implements ChainIndexer {
  private readonly logger = new Logger(SolanaIndexer.name)

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** No-op: Helius pusha via webhook, não há polling a iniciar. */
  async start(): Promise<void> {
    this.logger.log('[SolanaIndexer] Pronto — aguardando webhooks do Helius.')
  }

  /** No-op: nada a fechar no shutdown. */
  async stop(): Promise<void> {
    this.logger.log('[SolanaIndexer] Parado.')
  }

  // ── Parse ──────────────────────────────────────────────────────────────────

  /**
   * Converte um objeto EnhancedTransaction do Helius em ParsedTransaction.
   *
   * @param rawPayload Objeto recebido pelo webhook (tipado internamente).
   * @returns ParsedTransaction processável, ou null se deve ser ignorada.
   */
  parseTransaction(rawPayload: unknown): ParsedTransaction | null {
    const tx = rawPayload as HeliusEnhancedTransaction

    // 1. Apenas SWAPs são relevantes para o Whale Score
    if (tx.type !== 'SWAP') return null

    const transfers = tx.tokenTransfers ?? []
    if (transfers.length === 0) return null

    const feePayer = tx.feePayer
    if (!feePayer) return null

    // 2. Separa stablecoins do token principal do swap
    const stablecoinTransfers = transfers.filter((t) => STABLECOIN_MINTS.has(t.mint))
    const nonStablecoinTransfers = transfers.filter((t) => !STABLECOIN_MINTS.has(t.mint))

    // MVP: só processa swaps onde um dos lados é stablecoin (USD calculável)
    if (stablecoinTransfers.length === 0 || nonStablecoinTransfers.length === 0) return null

    // 3. Calcula o valor em USD a partir do lado stablecoin
    //    tokenAmount no enhanced webhook já está em formato UI (ex: 6000.5 para 6000.5 USDC)
    const amountUsd = stablecoinTransfers.reduce(
      (sum: number, t: HeliusTokenTransfer) => sum + Number(t.tokenAmount),
      0,
    )

    // 4. Filtra por threshold mínimo de $5.000
    if (amountUsd < MIN_USD) return null

    // 5. Identifica o token principal (primeiro não-stablecoin)
    const mainTransfer = nonStablecoinTransfers[0]!

    // 6. Determina a direção: BUY se wallet recebe o token, SELL se envia
    const txType = this.detectType(feePayer, mainTransfer)
    if (txType === null) return null

    const slot = tx.slot ?? 0
    const timestamp = tx.timestamp ? new Date(tx.timestamp * 1000) : new Date()

    this.logger.debug(
      `[SolanaIndexer] ${txType} ${mainTransfer.mint} | wallet: ${feePayer} | $${amountUsd.toFixed(2)} | sig: ${tx.signature.slice(0, 8)}...`,
    )

    return {
      wallet: feePayer,
      chain: Chain.SOL,
      token: mainTransfer.mint,
      tokenSymbol: null, // Helius enhanced não retorna symbol; preenchido futuramente via metadata
      type: txType,
      amountUsd,
      txHash: tx.signature,
      blockNumber: BigInt(slot),
      timestamp,
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Determina se a operação é BUY ou SELL do ponto de vista da wallet.
   *
   * BUY  → feePayer está em `toUserAccount` (recebe o token)
   * SELL → feePayer está em `fromUserAccount` (envia o token)
   * null → wallet não está diretamente envolvida nesta transferência (ignora)
   */
  private detectType(
    feePayer: string,
    transfer: HeliusTokenTransfer,
  ): TransactionType | null {
    if (transfer.toUserAccount === feePayer) return TransactionType.BUY
    if (transfer.fromUserAccount === feePayer) return TransactionType.SELL
    return null
  }
}
