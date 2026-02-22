import { Injectable } from '@nestjs/common'
import { AlertsService } from '../alerts/alerts.service'
import { Transaction, TransactionType } from '../entities'

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Input do detector.
 *
 * @param walletId          UUID da wallet avaliada.
 * @param transactions      Todas as transações recentes da wallet (qualquer tipo/status).
 *                          O detector filtra internamente por BUY e janela de 7 dias.
 * @param tokenDailyVolumes Mapa tokenAddress → volume diário USD (dados externos de mercado).
 *                          Se um token não constar no mapa, o filtro de volume é ignorado.
 */
export interface AccumulationDetectorInput {
  walletId: string
  transactions: Transaction[]
  tokenDailyVolumes: Map<string, number>
}

/**
 * Resultado por token detectado como em processo de acumulação silenciosa.
 * Só é retornado quando purchaseCount >= 3 (limite mínimo para exibição — SPEC §13).
 */
export interface AccumulatingToken {
  /** Endereço do contrato do token. */
  tokenAddress: string
  /** Símbolo do token (ex: "ETH"), ou null se não disponível. */
  tokenSymbol: string | null
  /** Número de compras qualificadas detectadas na janela de 7 dias. */
  purchaseCount: number
  /** Soma total em USD das compras qualificadas. */
  totalUsd: number
  /**
   * true quando o padrão está completamente confirmado:
   * purchaseCount >= 5 E totalUsd >= $50.000.
   */
  isComplete: boolean
}

// ─── Detector ─────────────────────────────────────────────────────────────────

/**
 * AccumulationDetector — lógica determinística de acumulação silenciosa (SPEC.md §13).
 *
 * Regras aplicadas em ordem:
 *   1. Apenas transações do tipo BUY dentro de uma janela de 7 dias.
 *   2. Agrupamento por tokenAddress.
 *   3. Ordenação por timestamp ASC para montar a cadeia.
 *   4. Filtro por compra individual: amountUsd ≤ 3% do volume diário do token.
 *      (ignorado quando o volume do token não está disponível no mapa de entrada)
 *   5. Filtro por intervalo: cada compra da cadeia deve estar ≥ 2h após a anterior.
 *   6. Alert disparado quando purchaseCount ≥ 3 ("Possível Acumulação Silenciosa").
 *   7. isComplete = true quando purchaseCount ≥ 5 E totalUsd ≥ $50.000.
 *
 * IMPORTANTE: Nunca exibir acumulação antes da 3ª compra detectada (CLAUDE.md).
 */
@Injectable()
export class AccumulationDetector {
  // ── Constantes (SPEC §13) ──────────────────────────────────────────────────

  /** Mínimo de compras qualificadas para disparar alerta ("Possível Acumulação"). */
  private static readonly MIN_PURCHASES_FOR_ALERT = 3

  /** Mínimo de compras para confirmação completa do padrão. */
  private static readonly MIN_PURCHASES_CONFIRMED = 5

  /** Intervalo mínimo entre duas compras consecutivas da cadeia (ms). */
  private static readonly MIN_INTERVAL_MS = 2 * 60 * 60 * 1000 // 2 horas

  /** Proporção máxima que uma compra individual pode representar do volume diário. */
  private static readonly MAX_PURCHASE_VOLUME_RATIO = 0.03 // 3%

  /** Valor total mínimo em USD para confirmar o padrão (com 5+ compras). */
  private static readonly MIN_TOTAL_USD = 50_000

  /** Janela de análise retroativa (ms). */
  private static readonly WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

  // ── Construtor ────────────────────────────────────────────────────────────

  constructor(private readonly alertsService: AlertsService) {}

  // ── API pública ───────────────────────────────────────────────────────────

  /**
   * Detecta padrões de acumulação silenciosa nas transações da wallet.
   *
   * Para cada token com ≥ 3 compras qualificadas, dispara
   * `AlertsService.createAccumulationAlert` e inclui o token no array retornado.
   *
   * @param input  Dados da wallet: transações + volumes diários dos tokens.
   * @returns      Array de tokens em acumulação (vazio se nenhum detectado).
   */
  async detect(input: AccumulationDetectorInput): Promise<AccumulatingToken[]> {
    const { walletId, transactions, tokenDailyVolumes } = input

    const windowStart = new Date(Date.now() - AccumulationDetector.WINDOW_MS)

    // 1. Filtra: apenas BUY dentro da janela de 7 dias
    const recentBuys = transactions.filter(
      (tx) => tx.type === TransactionType.BUY && tx.timestamp >= windowStart,
    )

    // 2. Agrupa por tokenAddress
    const byToken = new Map<string, Transaction[]>()
    for (const tx of recentBuys) {
      const group = byToken.get(tx.tokenAddress) ?? []
      group.push(tx)
      byToken.set(tx.tokenAddress, group)
    }

    const results: AccumulatingToken[] = []

    for (const [tokenAddress, tokenTxs] of byToken) {
      const dailyVolume = tokenDailyVolumes.get(tokenAddress)
      const maxPerBuy =
        dailyVolume !== undefined
          ? dailyVolume * AccumulationDetector.MAX_PURCHASE_VOLUME_RATIO
          : Infinity

      // 3. Ordena por timestamp ASC
      const sorted = [...tokenTxs].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      )

      // 4 + 5. Monta cadeia qualificada (greedy)
      const chain: Transaction[] = []
      let lastQualifiedTime = -Infinity

      for (const tx of sorted) {
        const amountUsd = parseFloat(tx.amountUsd)

        // Filtro de volume: compra individual não pode superar 3% do volume diário
        if (amountUsd > maxPerBuy) continue

        // Filtro de intervalo: deve estar ≥ 2h após a última compra da cadeia
        const elapsed = tx.timestamp.getTime() - lastQualifiedTime
        if (elapsed < AccumulationDetector.MIN_INTERVAL_MS) continue

        chain.push(tx)
        lastQualifiedTime = tx.timestamp.getTime()
      }

      // 6. Verifica limiar mínimo para alerta
      if (chain.length < AccumulationDetector.MIN_PURCHASES_FOR_ALERT) continue

      const totalUsd = chain.reduce((sum, tx) => sum + parseFloat(tx.amountUsd), 0)
      const tokenSymbol = chain[0]!.tokenSymbol ?? null

      // 7. Determina se confirmação completa foi atingida
      const isComplete =
        chain.length >= AccumulationDetector.MIN_PURCHASES_CONFIRMED &&
        totalUsd >= AccumulationDetector.MIN_TOTAL_USD

      results.push({
        tokenAddress,
        tokenSymbol,
        purchaseCount: chain.length,
        totalUsd,
        isComplete,
      })

      // Dispara alerta: "Possível Acumulação Silenciosa" (SPEC §13, CLAUDE.md)
      await this.alertsService.createAccumulationAlert(
        walletId,
        tokenSymbol ?? tokenAddress,
        chain.length,
      )
    }

    return results
  }
}
