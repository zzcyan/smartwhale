import { Injectable } from '@nestjs/common'
import { Transaction, TransactionType } from '../entities/transaction.entity'
import { WalletStatus } from '../entities/wallet.entity'

export type ScoreCategory = 'MAIN' | 'HIGH_RISK_HIGH_REWARD' | 'NEWCOMER'

export interface ScoreResult {
  /** Score all-time com decay exponencial [0-100]. Null se historyMonths < 3. */
  scoreAllTime: number | null
  /** Score dos últimos 90 dias sem decay [0-100]. Null se < 5 ops em 90d. */
  score90d: number | null
  /** Win rate [0-1]: proporção de SELLs com roiAdjusted > 0 */
  winRate: number
  /** Sharpe ratio on-chain bruto (não normalizado) */
  sharpeRatio: number
  /** Média ponderada do roiAdjusted (fração, ex: 0.5 = +50%) */
  roiAdjusted: number
  /** Consistência de padrões [0-1]: estabilidade do win rate entre períodos de 30d */
  consistency: number
  /** Total de SELLs finalizados com ROI registrado (critério de qualificação) */
  totalOperations: number
  /** Meses de histórico desde o primeiro SELL registrado até hoje */
  historyMonths: number
  /** Status resultante da wallet */
  status: WalletStatus
  /** Categoria para o ranking principal */
  category: ScoreCategory
}

/** Entrada interna: um SELL finalizado com roiAdjusted preenchido */
interface SellEntry {
  roi: number
  timestamp: Date
}

/** SellEntry com peso de decay já calculado */
interface WeightedSellEntry extends SellEntry {
  weight: number
}

/**
 * WhaleScoreCalculator — lógica pura de cálculo do Whale Score™.
 *
 * Fórmula (SPEC.md §2.1):
 *   score = 30% × winRate + 25% × sharpeNorm + 25% × roiNorm + 20% × consistency
 *
 * Dual score (SPEC.md §2.3):
 *   - All-time: decay exponencial (meia-vida 365 dias), para wallets com ≥ 3 meses de histórico.
 *   - 90 dias: janela deslizante sem decay, para wallets com ≥ 5 operações no período.
 *
 * Regras de desqualificação (SPEC.md §2.2):
 *   - < 30 operações → status OBSERVACAO, sem score público.
 *   - win rate < 40% → category HIGH_RISK_HIGH_REWARD (fora do ranking principal).
 *   - < 3 meses de histórico → category NEWCOMER, sem score all-time.
 *
 * IMPORTANTE: Recebe SOMENTE transações com isFinalized = true.
 * O chamador (WhaleScoresService) é responsável por filtrar — SPEC.md §5.
 */
@Injectable()
export class WhaleScoreCalculator {
  /** Meia-vida do decay exponencial: 365 dias */
  private static readonly DECAY_HALF_LIFE_DAYS = 365

  /** Constante de decay: ln(2) / 365 ≈ 0.0019 por dia */
  private static readonly DECAY_LAMBDA =
    Math.log(2) / WhaleScoreCalculator.DECAY_HALF_LIFE_DAYS

  /**
   * Ponto de entrada principal.
   *
   * @param finalizedTransactions Transações com isFinalized = true (todas, não apenas SELLs).
   */
  calculate(finalizedTransactions: Transaction[]): ScoreResult {
    const now = new Date()

    // Extrair SELLs com roiAdjusted preenchido — base de toda a computação
    const sellEntries: SellEntry[] = finalizedTransactions
      .filter(
        (tx) =>
          tx.type === TransactionType.SELL &&
          tx.roiAdjusted !== null &&
          tx.roiAdjusted !== undefined,
      )
      .map((tx) => ({
        roi: parseFloat(tx.roiAdjusted!),
        timestamp: new Date(tx.timestamp),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    const totalOperations = sellEntries.length
    const historyMonths = this.computeHistoryMonths(sellEntries, now)

    // ── Regra 1: < 30 operações → OBSERVACAO ─────────────────────────────────
    if (totalOperations < 30) {
      const winRate =
        totalOperations > 0 ? this.computeUnweightedWinRate(sellEntries) : 0
      return {
        scoreAllTime: null,
        score90d: null,
        winRate,
        sharpeRatio: 0,
        roiAdjusted: 0,
        consistency: 0,
        totalOperations,
        historyMonths,
        status: WalletStatus.OBSERVACAO,
        category: 'MAIN',
      }
    }

    // ── Métricas all-time (decay exponencial) ────────────────────────────────
    const weightedEntries: WeightedSellEntry[] = sellEntries.map((e) => ({
      ...e,
      weight: this.decayWeight(e.timestamp, now),
    }))

    const winRateAllTime = this.computeWeightedWinRate(weightedEntries)
    const sharpeAllTime = this.computeWeightedSharpe(weightedEntries)
    const roiAllTime = this.computeWeightedMeanRoi(weightedEntries)
    const consistency = this.computeConsistency(sellEntries)

    // ── Score 90 dias (sem decay) ────────────────────────────────────────────
    const cutoff90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const entries90d: WeightedSellEntry[] = sellEntries
      .filter((e) => e.timestamp >= cutoff90d)
      .map((e) => ({ ...e, weight: 1.0 }))

    let score90d: number | null = null
    if (entries90d.length >= 5) {
      const wr90 = this.computeWeightedWinRate(entries90d)
      const sh90 = this.computeWeightedSharpe(entries90d)
      const roi90 = this.computeWeightedMeanRoi(entries90d)
      const cons90 = this.computeConsistency(
        entries90d.map((e) => ({ roi: e.roi, timestamp: e.timestamp })),
      )
      score90d = this.composeScore(wr90, sh90, roi90, cons90)
    }

    // ── Status e categoria ───────────────────────────────────────────────────
    let category: ScoreCategory = 'MAIN'

    // Regra 2: win rate < 40% → HIGH_RISK_HIGH_REWARD
    if (winRateAllTime < 0.4) {
      category = 'HIGH_RISK_HIGH_REWARD'
    }

    // Regra 3: < 3 meses de histórico → NEWCOMER, sem score all-time
    let scoreAllTime: number | null = null
    if (historyMonths < 3) {
      category = 'NEWCOMER'
    } else {
      scoreAllTime = this.composeScore(
        winRateAllTime,
        sharpeAllTime,
        roiAllTime,
        consistency,
      )
    }

    // Sem nenhum score calculável → mantém OBSERVACAO
    const status =
      scoreAllTime !== null || score90d !== null
        ? WalletStatus.ACTIVE
        : WalletStatus.OBSERVACAO

    return {
      scoreAllTime,
      score90d,
      winRate: winRateAllTime,
      sharpeRatio: sharpeAllTime,
      roiAdjusted: roiAllTime,
      consistency,
      totalOperations,
      historyMonths,
      status,
      category,
    }
  }

  // ── Composição do score ───────────────────────────────────────────────────

  /**
   * Aplica pesos e normaliza cada componente para [0,1], retorna score em [0,100].
   *
   * Normalizações:
   *   - winRate:   já em [0,1]
   *   - sharpe:    clamp((sharpe + 2) / 6, 0, 1)  → range esperado [-2, +4]
   *   - roi:       clamp((roi + 1.0) / 6.0, 0, 1) → range esperado [-1.0, +5.0]
   *   - consistency: já em [0,1]
   */
  private composeScore(
    winRate: number,
    sharpe: number,
    roi: number,
    consistency: number,
  ): number {
    const sharpeNorm = this.clamp((sharpe + 2) / 6, 0, 1)
    const roiNorm = this.clamp((roi + 1.0) / 6.0, 0, 1)

    const raw =
      0.3 * winRate + 0.25 * sharpeNorm + 0.25 * roiNorm + 0.2 * consistency

    // [0, 100] com 2 casas decimais
    return Math.round(raw * 100 * 100) / 100
  }

  // ── Win Rate ──────────────────────────────────────────────────────────────

  /** Win rate ponderado pelo decay: sum(w × isWin) / sum(w). */
  private computeWeightedWinRate(entries: WeightedSellEntry[]): number {
    if (entries.length === 0) return 0
    const totalW = entries.reduce((s, e) => s + e.weight, 0)
    const winW = entries
      .filter((e) => e.roi > 0)
      .reduce((s, e) => s + e.weight, 0)
    return totalW > 0 ? winW / totalW : 0
  }

  /** Win rate simples (sem pesos), usado apenas para diagnóstico no OBSERVACAO. */
  private computeUnweightedWinRate(entries: SellEntry[]): number {
    if (entries.length === 0) return 0
    return entries.filter((e) => e.roi > 0).length / entries.length
  }

  // ── Sharpe Ratio On-Chain ─────────────────────────────────────────────────

  /**
   * Sharpe on-chain ponderado: mean(roi) / std(roi), risk-free = 0.
   *
   * Usa média e desvio padrão ponderados (Bessel's correction não aplicado
   * intencionalmente — queremos o desvio da distribuição subjacente, não da amostra).
   */
  private computeWeightedSharpe(entries: WeightedSellEntry[]): number {
    if (entries.length < 2) return 0

    const totalW = entries.reduce((s, e) => s + e.weight, 0)
    const wMean = entries.reduce((s, e) => s + e.weight * e.roi, 0) / totalW
    const wVar =
      entries.reduce(
        (s, e) => s + e.weight * Math.pow(e.roi - wMean, 2),
        0,
      ) / totalW
    const std = Math.sqrt(wVar)

    if (std === 0) {
      // Todas operações com ROI idêntico: Sharpe perfeito se positivo
      return wMean >= 0 ? 4.0 : -2.0
    }

    return wMean / std
  }

  // ── ROI Ajustado ──────────────────────────────────────────────────────────

  /** Média ponderada do ROI ajustado. O Token Risk Score já está embutido no campo. */
  private computeWeightedMeanRoi(entries: WeightedSellEntry[]): number {
    if (entries.length === 0) return 0
    const totalW = entries.reduce((s, e) => s + e.weight, 0)
    return entries.reduce((s, e) => s + e.weight * e.roi, 0) / totalW
  }

  // ── Consistência ──────────────────────────────────────────────────────────

  /**
   * Mede a estabilidade do win rate entre janelas de 30 dias.
   *
   *   consistency = 1 - std(winRates por janela)
   *
   * Se < 3 janelas com dados: retorna 0.5 (neutro — dados insuficientes para avaliar).
   * Não aplica decay: queremos saber se o padrão é estável entre períodos.
   */
  private computeConsistency(entries: SellEntry[]): number {
    if (entries.length === 0) return 0.5

    // Agrupar por janelas de 30 dias (bucket = dias desde epoch / 30)
    const buckets = new Map<number, SellEntry[]>()
    for (const entry of entries) {
      const bucketKey = Math.floor(
        entry.timestamp.getTime() / (30 * 24 * 60 * 60 * 1000),
      )
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, [])
      buckets.get(bucketKey)!.push(entry)
    }

    if (buckets.size < 3) return 0.5

    const winRates = Array.from(buckets.values()).map((bucket) => {
      const wins = bucket.filter((e) => e.roi > 0).length
      return wins / bucket.length
    })

    const mean = winRates.reduce((s, r) => s + r, 0) / winRates.length
    const variance =
      winRates.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / winRates.length
    const std = Math.sqrt(variance)

    return this.clamp(1 - std, 0, 1)
  }

  // ── Decay Exponencial (SPEC.md §2.3) ─────────────────────────────────────

  /**
   * Peso de decay: e^(-λ × daysAgo).
   *
   * Meia-vida de 365 dias: uma operação de 1 ano atrás vale ~50% de uma operação hoje.
   * Operações antigas nunca desaparecem (peso mínimo tende a 0 mas nunca é 0).
   */
  private decayWeight(txTimestamp: Date, now: Date): number {
    const daysAgo =
      (now.getTime() - txTimestamp.getTime()) / (1000 * 60 * 60 * 24)
    return Math.exp(-WhaleScoreCalculator.DECAY_LAMBDA * Math.max(0, daysAgo))
  }

  // ── Utilitários ───────────────────────────────────────────────────────────

  /**
   * Calcula quantos meses de histórico a wallet tem, medindo do SELL mais antigo até hoje.
   */
  private computeHistoryMonths(entries: SellEntry[], now: Date): number {
    if (entries.length === 0) return 0
    const oldest = entries[0]!.timestamp // já verificado length > 0, ordenado ASC
    return (now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24 * 30)
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }
}
