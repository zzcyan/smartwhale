import { Injectable } from '@nestjs/common'
import { AlertsService } from '../alerts/alerts.service'
import { Transaction, TransactionType, Wallet } from '../entities'

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Input do detector.
 *
 * @param transactions Transações recentes de múltiplas wallets.
 *                     A relação `wallet` deve estar carregada em cada transação
 *                     (necessário para acessar `tx.wallet.currentScore`).
 *                     O detector filtra internamente por BUY, janela de 4h e
 *                     wallets com Whale Score calculado (currentScore não-nulo).
 */
export interface ConfluenceDetectorInput {
  transactions: Transaction[]
}

/** Nível de confiança do sinal de confluência (SPEC.md §12.2). */
export type ConfidenceLevel = 'Alta Confiança' | 'Moderado'

/**
 * Sinal de confluência detectado para um token específico.
 * Retornado apenas quando ≥ 3 wallets com Whale Score calculado compraram
 * o mesmo token dentro da janela de 4 horas.
 */
export interface ConfluenceSignal {
  /** Endereço do contrato do token. */
  tokenAddress: string
  /** Símbolo do token (ex: "ETH"), ou null se não disponível. */
  tokenSymbol: string | null
  /** Nível de confiança determinado pela média dos Whale Scores. */
  confidenceLevel: ConfidenceLevel
  /** Número de wallets distintas com score calculado que compraram o token. */
  walletCount: number
  /** Média aritmética dos Whale Scores das wallets envolvidas. */
  avgWhaleScore: number
  /** Wallets distintas envolvidas na confluência (uma por wallet, sem repetição). */
  wallets: Wallet[]
  /** Timestamp de expiração do sinal: 24 horas após a detecção (SPEC.md §12.3). */
  expiresAt: Date
}

// ─── Detector ─────────────────────────────────────────────────────────────────

/**
 * ConfluenceDetector — detecta confluência de whales em um token (SPEC.md §12).
 *
 * Regra de disparo:
 *   3+ wallets com Whale Score calculado comprando o mesmo token dentro de 4 horas.
 *
 * Níveis de confiança (SPEC.md §12.2):
 *   - "Alta Confiança": score médio > 85
 *   - "Moderado":       score médio entre 60 e 85 (inclusive)
 *   - Abaixo de 60: nenhum sinal emitido.
 *
 * Ciclo de vida do sinal (SPEC.md §12.3):
 *   - Expira após 24 horas (expiresAt = now + 24h).
 */
@Injectable()
export class ConfluenceDetector {
  // ── Constantes (SPEC §12) ──────────────────────────────────────────────────

  /** Janela de análise retroativa (ms). */
  private static readonly WINDOW_MS = 4 * 60 * 60 * 1000 // 4 horas

  /** Tempo de vida do sinal a partir da detecção (ms). */
  private static readonly EXPIRES_MS = 24 * 60 * 60 * 1000 // 24 horas

  /** Mínimo de wallets distintas com score para disparar sinal. */
  private static readonly MIN_WALLETS = 3

  /** Score médio acima deste limiar → "Alta Confiança". */
  private static readonly ALTA_CONFIANCA_THRESHOLD = 85

  /** Score médio a partir deste limiar → "Moderado". */
  private static readonly MODERADO_THRESHOLD = 60

  // ── Construtor ────────────────────────────────────────────────────────────

  constructor(private readonly alertsService: AlertsService) {}

  // ── API pública ───────────────────────────────────────────────────────────

  /**
   * Detecta sinais de confluência nas transações recebidas.
   *
   * Para cada token com ≥ 3 wallets distintas (com Whale Score calculado)
   * que compraram dentro da janela de 4 horas e cujo score médio seja ≥ 60,
   * dispara `AlertsService.createConfluenceAlert` e inclui o sinal no array retornado.
   *
   * @param input Transações recentes com relação `wallet` carregada.
   * @returns     Array de sinais de confluência (vazio se nenhum detectado).
   */
  async detect(input: ConfluenceDetectorInput): Promise<ConfluenceSignal[]> {
    const { transactions } = input

    const windowStart = new Date(Date.now() - ConfluenceDetector.WINDOW_MS)

    // 1. Filtra: apenas BUY, dentro da janela de 4h, wallet com score calculado
    const recentBuys = transactions.filter(
      (tx) =>
        tx.type === TransactionType.BUY &&
        tx.timestamp >= windowStart &&
        tx.wallet?.currentScore !== null &&
        tx.wallet?.currentScore !== undefined,
    )

    // 2. Agrupa por tokenAddress
    const byToken = new Map<string, Transaction[]>()
    for (const tx of recentBuys) {
      const group = byToken.get(tx.tokenAddress) ?? []
      group.push(tx)
      byToken.set(tx.tokenAddress, group)
    }

    const results: ConfluenceSignal[] = []

    for (const [tokenAddress, tokenTxs] of byToken) {
      // 3. Deduplica por wallet: mantém uma transação por wallet (primeira encontrada)
      const walletMap = new Map<string, Wallet>()
      for (const tx of tokenTxs) {
        if (!walletMap.has(tx.wallet.id)) {
          walletMap.set(tx.wallet.id, tx.wallet)
        }
      }

      const uniqueWallets = Array.from(walletMap.values())

      // 4. Verifica mínimo de wallets distintas
      if (uniqueWallets.length < ConfluenceDetector.MIN_WALLETS) continue

      // 5. Calcula score médio (currentScore é string por conta do TypeORM decimal)
      const scores = uniqueWallets.map((w) => parseFloat(w.currentScore!))
      const avgWhaleScore = scores.reduce((sum, s) => sum + s, 0) / scores.length

      // 6. Determina nível de confiança
      let confidenceLevel: ConfidenceLevel
      if (avgWhaleScore > ConfluenceDetector.ALTA_CONFIANCA_THRESHOLD) {
        confidenceLevel = 'Alta Confiança'
      } else if (avgWhaleScore >= ConfluenceDetector.MODERADO_THRESHOLD) {
        confidenceLevel = 'Moderado'
      } else {
        // Score médio abaixo de 60 → sem sinal
        continue
      }

      // 7. Resolve símbolo do token (usa o primeiro disponível no grupo)
      const tokenSymbol = tokenTxs.find((tx) => tx.tokenSymbol)?.tokenSymbol ?? null

      const expiresAt = new Date(Date.now() + ConfluenceDetector.EXPIRES_MS)

      results.push({
        tokenAddress,
        tokenSymbol,
        confidenceLevel,
        walletCount: uniqueWallets.length,
        avgWhaleScore,
        wallets: uniqueWallets,
        expiresAt,
      })

      // 8. Dispara alertas: um por wallet envolvida (SPEC §12, via AlertsService)
      await this.alertsService.createConfluenceAlert(
        tokenSymbol ?? tokenAddress,
        uniqueWallets,
        confidenceLevel,
      )
    }

    return results
  }
}
