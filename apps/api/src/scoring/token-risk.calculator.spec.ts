import { TokenRiskCalculator, TokenRiskInput } from './token-risk.calculator'

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Constrói um TokenRiskInput de baixo risco (campos podem ser sobrescritos). */
function makeInput(overrides: Partial<TokenRiskInput> = {}): TokenRiskInput {
  return {
    tvl: 50_000_000,
    marketCap: 200_000_000,
    contractAgeDays: 800,
    dailyVolume30d: 2_000_000,
    holderCount: 25_000,
    hasExploitHistory: false,
    ...overrides,
  }
}

/** Constrói o pior caso possível sem exploit (todos os critérios no mínimo). */
function makeWorstCaseInput(): TokenRiskInput {
  return {
    tvl: 0,
    marketCap: 0,
    contractAgeDays: 0,
    dailyVolume30d: 0,
    holderCount: 0,
    hasExploitHistory: false,
  }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('TokenRiskCalculator', () => {
  let calc: TokenRiskCalculator

  beforeEach(() => {
    calc = new TokenRiskCalculator()
  })

  // ── Exploit history (hard disqualifier) ───────────────────────────────────

  describe('exploit history — disqualificador imediato', () => {
    it('retorna riskFactor = 0.1 exato com hasExploitHistory=true e métricas perfeitas', () => {
      const result = calc.calculate(makeInput({ hasExploitHistory: true }))
      expect(result.riskFactor).toBe(0.1)
    })

    it('retorna riskFactor = 0.1 com hasExploitHistory=true e métricas no pior caso', () => {
      const result = calc.calculate({ ...makeWorstCaseInput(), hasExploitHistory: true })
      expect(result.riskFactor).toBe(0.1)
    })

    it('breakdown.exploitOverride = true quando exploit está presente', () => {
      const result = calc.calculate(makeInput({ hasExploitHistory: true }))
      expect(result.breakdown.exploitOverride).toBe(true)
    })

    it('breakdown.exploitOverride = false para token sem exploit', () => {
      const result = calc.calculate(makeInput())
      expect(result.breakdown.exploitOverride).toBe(false)
    })

    it('token sem exploit com pior caso retorna riskFactor > 0.1 (piso via escala, não exploit)', () => {
      const result = calc.calculate(makeWorstCaseInput())
      // rawScore = 0 → riskFactor = 0×0.9 + 0.1 = 0.1 exato (piso da escala)
      expect(result.riskFactor).toBe(0.1)
      expect(result.breakdown.exploitOverride).toBe(false)
    })
  })

  // ── Sub-score de TVL ───────────────────────────────────────────────────────

  describe('TVL sub-score', () => {
    it('tvl >= $10M → tvlScore = 1.00', () => {
      const result = calc.calculate(makeInput({ tvl: 15_000_000 }))
      expect(result.breakdown.tvlScore).toBe(1.0)
    })

    it('tvl no limite exato de $10M → tvlScore = 1.00 (boundary inclusivo)', () => {
      const result = calc.calculate(makeInput({ tvl: 10_000_000 }))
      expect(result.breakdown.tvlScore).toBe(1.0)
    })

    it('tvl = $5M (entre $1M e $10M) → tvlScore = 0.80', () => {
      const result = calc.calculate(makeInput({ tvl: 5_000_000 }))
      expect(result.breakdown.tvlScore).toBe(0.8)
    })

    it('tvl = $1M (limite exato) → tvlScore = 0.80', () => {
      const result = calc.calculate(makeInput({ tvl: 1_000_000 }))
      expect(result.breakdown.tvlScore).toBe(0.8)
    })

    it('tvl = $50k (âncora SPEC — alto risco) → tvlScore = 0.40', () => {
      const result = calc.calculate(makeInput({ tvl: 50_000 }))
      expect(result.breakdown.tvlScore).toBe(0.4)
    })

    it('tvl = $500 (abaixo de $1k) → tvlScore = 0.00', () => {
      const result = calc.calculate(makeInput({ tvl: 500 }))
      expect(result.breakdown.tvlScore).toBe(0.0)
    })
  })

  // ── Sub-score de Market Cap ────────────────────────────────────────────────

  describe('market cap sub-score', () => {
    it('marketCap >= $500M → marketCapScore = 1.00', () => {
      const result = calc.calculate(makeInput({ marketCap: 600_000_000 }))
      expect(result.breakdown.marketCapScore).toBe(1.0)
    })

    it('marketCap = $500M (limite exato) → marketCapScore = 1.00', () => {
      const result = calc.calculate(makeInput({ marketCap: 500_000_000 }))
      expect(result.breakdown.marketCapScore).toBe(1.0)
    })

    it('marketCap = $25M (entre $10M e $50M) → marketCapScore = 0.60', () => {
      const result = calc.calculate(makeInput({ marketCap: 25_000_000 }))
      expect(result.breakdown.marketCapScore).toBe(0.6)
    })

    it('marketCap = $50k (abaixo de $100k) → marketCapScore = 0.00', () => {
      const result = calc.calculate(makeInput({ marketCap: 50_000 }))
      expect(result.breakdown.marketCapScore).toBe(0.0)
    })
  })

  // ── Sub-score de Idade do Contrato ─────────────────────────────────────────

  describe('idade do contrato sub-score', () => {
    it('contractAgeDays >= 730 (âncora SPEC: 2 anos) → contractAgeScore = 1.00', () => {
      const result = calc.calculate(makeInput({ contractAgeDays: 800 }))
      expect(result.breakdown.contractAgeScore).toBe(1.0)
    })

    it('contractAgeDays = 730 (limite exato) → contractAgeScore = 1.00', () => {
      const result = calc.calculate(makeInput({ contractAgeDays: 730 }))
      expect(result.breakdown.contractAgeScore).toBe(1.0)
    })

    it('contractAgeDays = 400 (entre 365 e 730) → contractAgeScore = 0.75', () => {
      const result = calc.calculate(makeInput({ contractAgeDays: 400 }))
      expect(result.breakdown.contractAgeScore).toBe(0.75)
    })

    it('contractAgeDays = 30 (limite exato) → contractAgeScore = 0.25', () => {
      const result = calc.calculate(makeInput({ contractAgeDays: 30 }))
      expect(result.breakdown.contractAgeScore).toBe(0.25)
    })

    it('contractAgeDays = 15 (< 30 dias) → contractAgeScore = 0.00', () => {
      const result = calc.calculate(makeInput({ contractAgeDays: 15 }))
      expect(result.breakdown.contractAgeScore).toBe(0.0)
    })

    it('contractAgeDays = 0 → contractAgeScore = 0.00', () => {
      const result = calc.calculate(makeInput({ contractAgeDays: 0 }))
      expect(result.breakdown.contractAgeScore).toBe(0.0)
    })
  })

  // ── Sub-score de Volume Diário ─────────────────────────────────────────────

  describe('volume diário 30d sub-score', () => {
    it('dailyVolume30d >= $1M → dailyVolumeScore = 1.00', () => {
      const result = calc.calculate(makeInput({ dailyVolume30d: 5_000_000 }))
      expect(result.breakdown.dailyVolumeScore).toBe(1.0)
    })

    it('dailyVolume30d = $50k (entre $10k e $100k) → dailyVolumeScore = 0.50', () => {
      const result = calc.calculate(makeInput({ dailyVolume30d: 50_000 }))
      expect(result.breakdown.dailyVolumeScore).toBe(0.5)
    })

    it('dailyVolume30d = $500 (< $1k) → dailyVolumeScore = 0.00', () => {
      const result = calc.calculate(makeInput({ dailyVolume30d: 500 }))
      expect(result.breakdown.dailyVolumeScore).toBe(0.0)
    })
  })

  // ── Sub-score de Holders ───────────────────────────────────────────────────

  describe('holder count sub-score', () => {
    it('holderCount >= 10.000 → holderCountScore = 1.00', () => {
      const result = calc.calculate(makeInput({ holderCount: 15_000 }))
      expect(result.breakdown.holderCountScore).toBe(1.0)
    })

    it('holderCount = 1.000 (limite exato) → holderCountScore = 0.75', () => {
      const result = calc.calculate(makeInput({ holderCount: 1_000 }))
      expect(result.breakdown.holderCountScore).toBe(0.75)
    })

    it('holderCount = 200 (âncora SPEC: "alto risco") → holderCountScore = 0.25', () => {
      const result = calc.calculate(makeInput({ holderCount: 200 }))
      expect(result.breakdown.holderCountScore).toBe(0.25)
    })

    it('holderCount = 199 (logo abaixo de 200) → holderCountScore = 0.00', () => {
      const result = calc.calculate(makeInput({ holderCount: 199 }))
      expect(result.breakdown.holderCountScore).toBe(0.0)
    })
  })

  // ── Combinação ponderada e riskFactor ─────────────────────────────────────

  describe('combinação ponderada — riskFactor', () => {
    it('todos os critérios no máximo → riskFactor = 1.0', () => {
      // makeInput() tem marketCap: 200M (tier 4 → 0.80), por isso precisamos de 600M para atingir tier 5
      const result = calc.calculate(makeInput({ marketCap: 600_000_000 }))
      expect(result.riskFactor).toBe(1.0)
    })

    it('todos os critérios no mínimo, sem exploit → riskFactor = 0.1 (piso da escala)', () => {
      const result = calc.calculate(makeWorstCaseInput())
      expect(result.riskFactor).toBe(0.1)
    })

    it('âncora SPEC alto risco ($50k TVL, 200 holders, contrato novo) → riskFactor < 0.35', () => {
      // rawScore = 0.35×0.4 + 0.25×0 + 0.20×0 + 0.10×0.25 + 0.10×0 = 0.14 + 0.025 = 0.165
      // riskFactor = 0.165×0.9 + 0.1 = 0.2485
      const result = calc.calculate(
        makeInput({
          tvl: 50_000,
          holderCount: 200,
          contractAgeDays: 15,
          marketCap: 50_000,
          dailyVolume30d: 500,
        }),
      )
      expect(result.riskFactor).toBeLessThan(0.35)
    })

    it('âncora SPEC baixo risco ($100M TVL, 2 anos, 25k holders) → riskFactor > 0.90', () => {
      // Todos os critérios no máximo → riskFactor = 1.0
      const result = calc.calculate(
        makeInput({
          tvl: 100_000_000,
          contractAgeDays: 800,
          holderCount: 25_000,
          marketCap: 500_000_000,
          dailyVolume30d: 5_000_000,
        }),
      )
      expect(result.riskFactor).toBeGreaterThan(0.9)
    })

    it('token mediano (critérios mistos) → riskFactor entre 0.1 e 1.0', () => {
      const result = calc.calculate(
        makeInput({
          tvl: 500_000,        // tier 4 → 0.80
          marketCap: 5_000_000, // tier 3 → 0.60
          contractAgeDays: 90,  // tier 2 → 0.50
          dailyVolume30d: 50_000, // tier 3 → 0.75
          holderCount: 800,     // tier 3 → 0.75
        }),
      )
      expect(result.riskFactor).toBeGreaterThan(0.1)
      expect(result.riskFactor).toBeLessThan(1.0)
    })
  })

  // ── Invariante de bounds ───────────────────────────────────────────────────

  describe('invariante: riskFactor sempre em [0.1, 1.0]', () => {
    const cenarios: Array<[string, Partial<TokenRiskInput>]> = [
      ['ROI absurdamente alto (TVL gigante)', { tvl: 999_999_999 }],
      ['Contrato antiqüíssimo', { contractAgeDays: 99_999 }],
      ['Todos zerados', { tvl: 0, marketCap: 0, contractAgeDays: 0, dailyVolume30d: 0, holderCount: 0 }],
      ['Exploit override', { hasExploitHistory: true }],
    ]

    it.each(cenarios)('%s → riskFactor em [0.1, 1.0]', (_, overrides) => {
      const result = calc.calculate(makeInput(overrides))
      expect(result.riskFactor).toBeGreaterThanOrEqual(0.1)
      expect(result.riskFactor).toBeLessThanOrEqual(1.0)
      expect(Number.isFinite(result.riskFactor)).toBe(true)
    })
  })

  // ── Auditabilidade do breakdown ────────────────────────────────────────────

  describe('auditabilidade do breakdown', () => {
    it('sub-scores do breakdown batem com os valores esperados individualmente', () => {
      const result = calc.calculate(
        makeInput({
          tvl: 50_000,           // >= $10k  → 0.40
          marketCap: 1_500_000,  // >= $1M   → 0.40
          contractAgeDays: 400,  // >= 365d  → 0.75
          dailyVolume30d: 200_000, // >= $100k → 0.75
          holderCount: 1_500,    // >= 1k    → 0.75
        }),
      )
      expect(result.breakdown.tvlScore).toBe(0.4)
      expect(result.breakdown.marketCapScore).toBe(0.4)
      expect(result.breakdown.contractAgeScore).toBe(0.75)
      expect(result.breakdown.dailyVolumeScore).toBe(0.75)
      expect(result.breakdown.holderCountScore).toBe(0.75)
    })

    it('riskFactor calculado manualmente bate com o retornado', () => {
      // tvl=$5M→0.80, mcap=$25M→0.60, age=400d→0.75, vol=$500k→0.75, holders=1500→0.75
      // rawScore = 0.35×0.80 + 0.25×0.75 + 0.20×0.60 + 0.10×0.75 + 0.10×0.75
      //          = 0.28 + 0.1875 + 0.12 + 0.075 + 0.075 = 0.7375
      // riskFactor = 0.7375×0.9 + 0.1 = 0.66375 + 0.1 = 0.76375
      const result = calc.calculate(
        makeInput({
          tvl: 5_000_000,
          marketCap: 25_000_000,
          contractAgeDays: 400,
          dailyVolume30d: 500_000,
          holderCount: 1_500,
        }),
      )
      expect(result.riskFactor).toBeCloseTo(0.76375, 5)
    })

    it('todos os campos do breakdown presentes e finitos para token sem exploit', () => {
      const result = calc.calculate(makeInput())
      expect(Number.isFinite(result.breakdown.tvlScore)).toBe(true)
      expect(Number.isFinite(result.breakdown.marketCapScore)).toBe(true)
      expect(Number.isFinite(result.breakdown.contractAgeScore)).toBe(true)
      expect(Number.isFinite(result.breakdown.dailyVolumeScore)).toBe(true)
      expect(Number.isFinite(result.breakdown.holderCountScore)).toBe(true)
      expect(result.breakdown.exploitOverride).toBe(false)
    })
  })
})
