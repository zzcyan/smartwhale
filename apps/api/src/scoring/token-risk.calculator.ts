import { Injectable } from '@nestjs/common'

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Dados brutos de um token, vindos da tabela token_risk_scores.
 * Todos os campos numéricos são numbers puros (o chamador converte strings do banco).
 */
export interface TokenRiskInput {
  /** Liquidez total do pool em USD (Total Value Locked). */
  tvl: number
  /** Market cap do token em USD. */
  marketCap: number
  /** Dias desde o deploy do contrato. */
  contractAgeDays: number
  /** Volume médio diário dos últimos 30 dias em USD. */
  dailyVolume30d: number
  /** Número de holders únicos. */
  holderCount: number
  /** Se o token possui histórico de rugpull ou exploit confirmado. */
  hasExploitHistory: boolean
}

/**
 * Sub-scores por critério [0, 1] — para auditabilidade e exibição no frontend.
 * Permite explicar ao usuário por que um token recebeu determinada penalidade.
 */
export interface TokenRiskBreakdown {
  tvlScore: number
  marketCapScore: number
  contractAgeScore: number
  dailyVolumeScore: number
  holderCountScore: number
  /** true quando hasExploitHistory forçou riskFactor = 0.1, ignorando os demais critérios. */
  exploitOverride: boolean
}

/**
 * Resultado do TokenRiskCalculator.
 * riskFactor multiplica diretamente o ROI da operação antes de entrar no Whale Score.
 */
export interface TokenRiskResult {
  /** Fator de risco [0.1, 1.0]. 1.0 = sem penalidade. 0.1 = penalidade máxima. */
  riskFactor: number
  /** Detalhamento por critério para auditoria. */
  breakdown: TokenRiskBreakdown
}

// ─── Calculator ───────────────────────────────────────────────────────────────

/**
 * TokenRiskCalculator — lógica pura do Token Risk Score (SPEC.md §3).
 *
 * Fórmula:
 *   rawScore   = 0.35×tvl + 0.25×age + 0.20×mcap + 0.10×holders + 0.10×volume
 *   riskFactor = clamp(rawScore × 0.9 + 0.1,  0.1,  1.0)
 *
 * Override: hasExploitHistory = true → riskFactor = 0.1 imediatamente.
 *
 * Sub-scores usam thresholds em degraus (não funções contínuas) para auditabilidade.
 * O mapeamento linear [0,1] → [0.1, 1.0] preserva gradiente: tokens ruins não colapsam
 * todos em 0.1 — apenas o exploit dispara o piso diretamente.
 *
 * IMPORTANTE: Classe sem dependências externas. Os dados chegam como parâmetro.
 * O chamador (TokenRiskService, fase futura) é responsável por buscar do banco.
 */
@Injectable()
export class TokenRiskCalculator {
  // ── Pesos (somam 1.0) ──────────────────────────────────────────────────────

  /** TVL é o principal indicador de risco DeFi — mede liquidez de saída disponível. */
  private static readonly WEIGHT_TVL = 0.35
  /** Idade do contrato: proxy de survivorship — contratos velhos sobreviveram a mais ataques. */
  private static readonly WEIGHT_CONTRACT_AGE = 0.25
  /** Market cap: sinal independente do TVL (token pode ter cap alto com pool pequeno). */
  private static readonly WEIGHT_MARKET_CAP = 0.20
  /** Holder count: proxy de descentralização — correlacionado com mcap, peso menor. */
  private static readonly WEIGHT_HOLDER_COUNT = 0.10
  /** Volume: detecta ghost pools (TVL alto, sem negociação real). */
  private static readonly WEIGHT_DAILY_VOLUME = 0.10

  // ── Thresholds de TVL (USD) ────────────────────────────────────────────────

  private static readonly TVL_TIER_5 = 10_000_000   // >= $10M  → 1.00
  private static readonly TVL_TIER_4 =  1_000_000   // >= $1M   → 0.80
  private static readonly TVL_TIER_3 =    100_000   // >= $100k → 0.60
  private static readonly TVL_TIER_2 =     10_000   // >= $10k  → 0.40 (âncora SPEC: $50k)
  private static readonly TVL_TIER_1 =      1_000   // >= $1k   → 0.20
                                                     // < $1k    → 0.00

  // ── Thresholds de Market Cap (USD) ────────────────────────────────────────

  private static readonly MCAP_TIER_5 = 500_000_000  // >= $500M → 1.00
  private static readonly MCAP_TIER_4 =  50_000_000  // >= $50M  → 0.80
  private static readonly MCAP_TIER_3 =  10_000_000  // >= $10M  → 0.60
  private static readonly MCAP_TIER_2 =   1_000_000  // >= $1M   → 0.40
  private static readonly MCAP_TIER_1 =     100_000  // >= $100k → 0.20
                                                      // < $100k  → 0.00

  // ── Thresholds de Idade do Contrato (dias) ────────────────────────────────

  private static readonly AGE_TIER_4 = 730  // >= 2 anos → 1.00 (âncora SPEC: "2 anos de histórico")
  private static readonly AGE_TIER_3 = 365  // >= 1 ano  → 0.75
  private static readonly AGE_TIER_2 = 180  // >= 6 meses → 0.50
  private static readonly AGE_TIER_1 =  30  // >= 1 mês  → 0.25
                                            // < 30 dias → 0.00

  // ── Thresholds de Volume Diário 30d (USD) ─────────────────────────────────

  private static readonly VOL_TIER_4 = 1_000_000  // >= $1M   → 1.00
  private static readonly VOL_TIER_3 =   100_000  // >= $100k → 0.75
  private static readonly VOL_TIER_2 =    10_000  // >= $10k  → 0.50
  private static readonly VOL_TIER_1 =     1_000  // >= $1k   → 0.25
                                                  // < $1k    → 0.00

  // ── Thresholds de Holders ─────────────────────────────────────────────────

  private static readonly HOLDERS_TIER_4 = 10_000  // >= 10k  → 1.00
  private static readonly HOLDERS_TIER_3 =  1_000  // >= 1k   → 0.75
  private static readonly HOLDERS_TIER_2 =    500  // >= 500  → 0.50
  private static readonly HOLDERS_TIER_1 =    200  // >= 200  → 0.25 (âncora SPEC: "200 holders = alto risco")
                                                   // < 200   → 0.00

  // ── Constantes do fator de risco ──────────────────────────────────────────

  /** Penalidade máxima — disparada pelo exploit ou pelo piso do mapeamento linear. */
  private static readonly RISK_FACTOR_MIN = 0.1
  /** Sem penalidade. */
  private static readonly RISK_FACTOR_MAX = 1.0
  /** Escala do mapeamento linear [0,1] → [MIN, MAX]: MAX - MIN. */
  private static readonly RISK_FACTOR_SCALE = 0.9

  // ── API pública ───────────────────────────────────────────────────────────

  /**
   * Calcula o Token Risk Score para um único token.
   *
   * @param input Métricas brutas do token (tabela token_risk_scores).
   * @returns riskFactor em [0.1, 1.0] e breakdown por critério.
   */
  calculate(input: TokenRiskInput): TokenRiskResult {
    // Override imediato: exploit confirmado → penalidade máxima
    if (input.hasExploitHistory) {
      return {
        riskFactor: TokenRiskCalculator.RISK_FACTOR_MIN,
        breakdown: {
          tvlScore: 0,
          marketCapScore: 0,
          contractAgeScore: 0,
          dailyVolumeScore: 0,
          holderCountScore: 0,
          exploitOverride: true,
        },
      }
    }

    // Sub-scores por critério
    const tvlScore = this.scoreTvl(input.tvl)
    const marketCapScore = this.scoreMarketCap(input.marketCap)
    const contractAgeScore = this.scoreContractAge(input.contractAgeDays)
    const dailyVolumeScore = this.scoreDailyVolume(input.dailyVolume30d)
    const holderCountScore = this.scoreHolderCount(input.holderCount)

    // Soma ponderada → rawScore em [0, 1]
    const rawScore =
      TokenRiskCalculator.WEIGHT_TVL * tvlScore +
      TokenRiskCalculator.WEIGHT_CONTRACT_AGE * contractAgeScore +
      TokenRiskCalculator.WEIGHT_MARKET_CAP * marketCapScore +
      TokenRiskCalculator.WEIGHT_HOLDER_COUNT * holderCountScore +
      TokenRiskCalculator.WEIGHT_DAILY_VOLUME * dailyVolumeScore

    // Mapeamento linear [0,1] → [0.1, 1.0]
    const riskFactor = this.clamp(
      rawScore * TokenRiskCalculator.RISK_FACTOR_SCALE +
        TokenRiskCalculator.RISK_FACTOR_MIN,
      TokenRiskCalculator.RISK_FACTOR_MIN,
      TokenRiskCalculator.RISK_FACTOR_MAX,
    )

    return {
      riskFactor,
      breakdown: {
        tvlScore,
        marketCapScore,
        contractAgeScore,
        dailyVolumeScore,
        holderCountScore,
        exploitOverride: false,
      },
    }
  }

  // ── Sub-scores (thresholds em degraus) ───────────────────────────────────

  /** Mapeia TVL em USD para sub-score [0, 1] com 5 tiers. */
  private scoreTvl(tvl: number): number {
    if (tvl >= TokenRiskCalculator.TVL_TIER_5) return 1.0
    if (tvl >= TokenRiskCalculator.TVL_TIER_4) return 0.8
    if (tvl >= TokenRiskCalculator.TVL_TIER_3) return 0.6
    if (tvl >= TokenRiskCalculator.TVL_TIER_2) return 0.4
    if (tvl >= TokenRiskCalculator.TVL_TIER_1) return 0.2
    return 0.0
  }

  /** Mapeia market cap em USD para sub-score [0, 1] com 5 tiers. */
  private scoreMarketCap(marketCap: number): number {
    if (marketCap >= TokenRiskCalculator.MCAP_TIER_5) return 1.0
    if (marketCap >= TokenRiskCalculator.MCAP_TIER_4) return 0.8
    if (marketCap >= TokenRiskCalculator.MCAP_TIER_3) return 0.6
    if (marketCap >= TokenRiskCalculator.MCAP_TIER_2) return 0.4
    if (marketCap >= TokenRiskCalculator.MCAP_TIER_1) return 0.2
    return 0.0
  }

  /** Mapeia idade do contrato em dias para sub-score [0, 1] com 4 tiers. */
  private scoreContractAge(days: number): number {
    if (days >= TokenRiskCalculator.AGE_TIER_4) return 1.0
    if (days >= TokenRiskCalculator.AGE_TIER_3) return 0.75
    if (days >= TokenRiskCalculator.AGE_TIER_2) return 0.5
    if (days >= TokenRiskCalculator.AGE_TIER_1) return 0.25
    return 0.0
  }

  /** Mapeia volume médio diário 30d em USD para sub-score [0, 1] com 4 tiers. */
  private scoreDailyVolume(volume: number): number {
    if (volume >= TokenRiskCalculator.VOL_TIER_4) return 1.0
    if (volume >= TokenRiskCalculator.VOL_TIER_3) return 0.75
    if (volume >= TokenRiskCalculator.VOL_TIER_2) return 0.5
    if (volume >= TokenRiskCalculator.VOL_TIER_1) return 0.25
    return 0.0
  }

  /** Mapeia número de holders para sub-score [0, 1] com 4 tiers. */
  private scoreHolderCount(count: number): number {
    if (count >= TokenRiskCalculator.HOLDERS_TIER_4) return 1.0
    if (count >= TokenRiskCalculator.HOLDERS_TIER_3) return 0.75
    if (count >= TokenRiskCalculator.HOLDERS_TIER_2) return 0.5
    if (count >= TokenRiskCalculator.HOLDERS_TIER_1) return 0.25
    return 0.0
  }

  // ── Utilitário ────────────────────────────────────────────────────────────

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }
}
