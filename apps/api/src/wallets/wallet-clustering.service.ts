import { Injectable } from '@nestjs/common'
import { Transaction } from '../entities'

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Representa uma transferência nativa (ETH, SOL, etc.) entre wallets.
 * Não está na entidade Transaction (que representa swaps/trades),
 * por isso é recebido separadamente pelo pipeline de cada chain.
 */
export interface FundingEvent {
  fromAddress: string
  toAddress: string
  timestamp: Date
  amountUsd: number
}

/** Dados de uma wallet para análise de clustering. */
export interface WalletClusteringEntry {
  id: string
  address: string
  /** Data da primeira transação registrada — usada em H1 para verificar funding pré-operação. */
  firstSeen: Date
  transactions: Transaction[]
}

/**
 * Input do serviço de clustering.
 *
 * @param walletA          Primeira wallet e suas transações.
 * @param walletB          Segunda wallet e suas transações.
 * @param fundingEvents    Transferências nativas entre as duas wallets (para H1).
 *                         Se ausente, H1 nunca é positiva.
 */
export interface WalletClusteringInput {
  walletA: WalletClusteringEntry
  walletB: WalletClusteringEntry
  fundingEvents?: FundingEvent[]
}

/**
 * Resultado do clustering para o par de wallets.
 *
 * @param areSameOwner       true SOMENTE quando >= 3 heurísticas convergem (SPEC.md §4.1).
 * @param confidence         Proporção de heurísticas convergidas: length / 3.
 *                           Valores possíveis: 0.0, 0.33, 0.67, 1.0.
 * @param heuristicsMatched  Nomes das heurísticas que dispararam positivo.
 */
export interface WalletClusteringResult {
  areSameOwner: boolean
  confidence: number
  heuristicsMatched: string[]
}

// ─── Constantes de heurísticas ────────────────────────────────────────────────

/** H2: janela de tempo para considerar duas transações como "simultâneas". */
const TIMING_WINDOW_MS = 30 * 60 * 1000 // 30 minutos

/** H2: mínimo absoluto de pares correlacionados para positivo. */
const TIMING_MIN_PAIRS = 3

/** H2: sobreposição mínima em relação à menor carteira (evita coincidências em carteiras grandes). */
const TIMING_MIN_OVERLAP_RATE = 0.3

/** H3: janela de tempo para "mesmo contrato em sequência". */
const SEQUENCE_WINDOW_MS = 5 * 60 * 1000 // 5 minutos

/** H3: mínimo de contratos distintos exibindo sequência para positivo. */
const SEQUENCE_MIN_EVENTS = 2

/** Número de heurísticas necessárias para agrupar — REGRA CRÍTICA (SPEC.md §4.1, CLAUDE.md). */
const MIN_HEURISTICS_TO_GROUP = 3

// ─── Serviço ──────────────────────────────────────────────────────────────────

/**
 * WalletClusteringService — detecção conservadora de wallets do mesmo dono (SPEC.md §4).
 *
 * Regra central: só agrupa quando TRÊS ou mais heurísticas convergem.
 * Falso negativo (deixar dois perfis separados) é preferível a falso positivo
 * (contaminar scores de donos diferentes), que destrói a credibilidade do produto.
 *
 * Heurísticas implementadas:
 *   H1 SAME_FUNDING_SOURCE   — wallet A financiou B (ou vice-versa) antes de B operar
 *   H2 TIMING_CORRELATION    — transações nos mesmos horários (janela 30 min)
 *   H3 SEQUENCE_CONTRACTS    — interagem com os mesmos contratos em < 5 minutos
 */
@Injectable()
export class WalletClusteringService {
  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * Analisa se dois wallets pertencem ao mesmo dono.
   *
   * @param input  Par de wallets com transações e eventos de funding.
   * @returns      Resultado com flag de agrupamento, confiança e heurísticas disparadas.
   */
  analyze(input: WalletClusteringInput): WalletClusteringResult {
    const matched: string[] = []

    if (this.checkSameFundingSource(input)) {
      matched.push('SAME_FUNDING_SOURCE')
    }

    if (this.checkTimingCorrelation(input.walletA.transactions, input.walletB.transactions)) {
      matched.push('TIMING_CORRELATION')
    }

    if (this.checkSequenceContracts(input.walletA.transactions, input.walletB.transactions)) {
      matched.push('SEQUENCE_CONTRACTS')
    }

    return {
      // NUNCA agrupar com menos de MIN_HEURISTICS_TO_GROUP — SPEC.md §4.1, CLAUDE.md
      areSameOwner: matched.length >= MIN_HEURISTICS_TO_GROUP,
      confidence: matched.length / MIN_HEURISTICS_TO_GROUP,
      heuristicsMatched: matched,
    }
  }

  // ── Heurística 1: mesma source de funding ───────────────────────────────────

  /**
   * H1 — SAME_FUNDING_SOURCE
   *
   * Positivo quando: existe ao menos uma transferência nativa onde
   * wallet A enviou para wallet B (ou B para A) **antes** da wallet receptora
   * começar a operar (i.e., antes do seu `firstSeen`).
   *
   * O requisito de ser "antes do firstSeen" é crítico: descarta casos onde
   * as wallets trocaram fundos após já estarem em uso independente.
   */
  private checkSameFundingSource(input: WalletClusteringInput): boolean {
    const { walletA, walletB, fundingEvents } = input

    if (!fundingEvents || fundingEvents.length === 0) return false

    for (const event of fundingEvents) {
      const aFundedB =
        event.fromAddress === walletA.address &&
        event.toAddress === walletB.address &&
        event.timestamp < walletB.firstSeen

      const bFundedA =
        event.fromAddress === walletB.address &&
        event.toAddress === walletA.address &&
        event.timestamp < walletA.firstSeen

      if (aFundedB || bFundedA) return true
    }

    return false
  }

  // ── Heurística 2: timing correlacionado ─────────────────────────────────────

  /**
   * H2 — TIMING_CORRELATION
   *
   * Positivo quando: pelo menos `TIMING_MIN_PAIRS` transações de A têm
   * uma transação de B dentro de 30 minutos, E essa sobreposição representa
   * >= 30% da menor carteira (evitar falsos positivos em wallets muito ativas).
   *
   * Algoritmo: para cada txA, verifica se existe algum txB com
   * |timestamp_A - timestamp_B| <= 30 min → conta como par correlacionado.
   */
  private checkTimingCorrelation(txsA: Transaction[], txsB: Transaction[]): boolean {
    if (txsA.length === 0 || txsB.length === 0) return false

    let matchCount = 0

    for (const txA of txsA) {
      const tA = txA.timestamp.getTime()
      const hasMatch = txsB.some((txB) => Math.abs(tA - txB.timestamp.getTime()) <= TIMING_WINDOW_MS)
      if (hasMatch) matchCount++
    }

    if (matchCount < TIMING_MIN_PAIRS) return false

    const overlapRate = matchCount / Math.min(txsA.length, txsB.length)
    return overlapRate >= TIMING_MIN_OVERLAP_RATE
  }

  // ── Heurística 3: mesmos contratos em sequência ──────────────────────────────

  /**
   * H3 — SEQUENCE_CONTRACTS
   *
   * Positivo quando: pelo menos `SEQUENCE_MIN_EVENTS` contratos distintos
   * são utilizados por ambas as wallets dentro de 5 minutos um do outro.
   *
   * Algoritmo: para cada par (txA, txB) com o mesmo tokenAddress,
   * verifica se |timestamp_A - timestamp_B| <= 5 min. Usa um Set para
   * contar contratos únicos (não contabiliza o mesmo contrato duas vezes).
   */
  private checkSequenceContracts(txsA: Transaction[], txsB: Transaction[]): boolean {
    if (txsA.length === 0 || txsB.length === 0) return false

    const sequencedContracts = new Set<string>()

    for (const txA of txsA) {
      const tA = txA.timestamp.getTime()
      for (const txB of txsB) {
        if (txA.tokenAddress !== txB.tokenAddress) continue
        const diff = Math.abs(tA - txB.timestamp.getTime())
        if (diff <= SEQUENCE_WINDOW_MS) {
          sequencedContracts.add(txA.tokenAddress)
          break // já registrou este contrato — não precisa checar mais txsB para este txA
        }
      }
    }

    return sequencedContracts.size >= SEQUENCE_MIN_EVENTS
  }
}
