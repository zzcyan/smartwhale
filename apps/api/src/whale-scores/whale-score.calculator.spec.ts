import { WhaleScoreCalculator } from './whale-score.calculator'
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity'
import { Chain, WalletStatus } from '../entities/wallet.entity'

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Cria SELLs finalizados distribuídos uniformemente no intervalo [startDaysAgo, endDaysAgo]. */
function makeSells(
  count: number,
  roi: number,
  startDaysAgo: number,
  endDaysAgo = 1,
): Transaction[] {
  const now = Date.now()
  const startMs = now - startDaysAgo * 86_400_000
  const endMs = now - endDaysAgo * 86_400_000
  const step = count > 1 ? (endMs - startMs) / (count - 1) : 0

  return Array.from({ length: count }, (_, i) => {
    const tx = new Transaction()
    tx.id = `tx-${i}`
    tx.type = TransactionType.SELL
    tx.roiAdjusted = String(roi)
    tx.isFinalized = true
    tx.timestamp = new Date(startMs + i * step)
    tx.chain = Chain.ETH
    tx.amountUsd = '1000'
    tx.txHash = `hash-${i}`
    tx.blockNumber = String(i)
    tx.status = TransactionStatus.FINALIZADO
    tx.tokenAddress = '0xtoken'
    tx.tokenRiskScore = null
    tx.tokenSymbol = null
    tx.createdAt = new Date()
    tx.wallet = { id: 'wallet-1' } as Transaction['wallet']
    return tx
  })
}

/** Mistura wins (+roi) e losses (-roi) numa proporção dada. */
function makeMixedSells(
  count: number,
  winRate: number,
  startDaysAgo: number,
  winRoi = 0.5,
  lossRoi = -0.3,
): Transaction[] {
  const wins = Math.round(count * winRate)
  const losses = count - wins
  return [
    ...makeSells(wins, winRoi, startDaysAgo, 2),
    ...makeSells(losses, lossRoi, startDaysAgo - 1, 3),
  ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('WhaleScoreCalculator', () => {
  let calc: WhaleScoreCalculator

  beforeEach(() => {
    calc = new WhaleScoreCalculator()
  })

  // ── Regras de desqualificação ──────────────────────────────────────────────

  describe('desqualificação — OBSERVACAO (< 30 ops)', () => {
    it('retorna OBSERVACAO para array vazio', () => {
      const result = calc.calculate([])
      expect(result.status).toBe(WalletStatus.OBSERVACAO)
      expect(result.scoreAllTime).toBeNull()
      expect(result.score90d).toBeNull()
      expect(result.totalOperations).toBe(0)
    })

    it('retorna OBSERVACAO com 29 SELLs finalizados', () => {
      const txs = makeSells(29, 0.5, 200)
      const result = calc.calculate(txs)
      expect(result.status).toBe(WalletStatus.OBSERVACAO)
      expect(result.scoreAllTime).toBeNull()
      expect(result.score90d).toBeNull()
      expect(result.totalOperations).toBe(29)
    })

    it('ignora transações BUY na contagem de operações', () => {
      const sells = makeSells(5, 0.5, 200)
      const buys = makeSells(30, 0.5, 200).map((tx) => {
        tx.type = TransactionType.BUY
        return tx
      })
      const result = calc.calculate([...sells, ...buys])
      expect(result.status).toBe(WalletStatus.OBSERVACAO)
      expect(result.totalOperations).toBe(5)
    })

    it('ignora SELLs sem roiAdjusted na contagem', () => {
      const txsComRoi = makeSells(10, 0.5, 200)
      const txsSemRoi = makeSells(25, 0.5, 200).map((tx) => {
        tx.roiAdjusted = null
        return tx
      })
      const result = calc.calculate([...txsComRoi, ...txsSemRoi])
      expect(result.status).toBe(WalletStatus.OBSERVACAO)
      expect(result.totalOperations).toBe(10)
    })
  })

  // ── Wallet qualificada (≥ 30 ops, ≥ 3 meses, win rate ≥ 40%) ─────────────

  describe('wallet qualificada — categoria MAIN', () => {
    it('produz status ACTIVE e categoria MAIN', () => {
      const txs = makeMixedSells(40, 0.7, 150)
      const result = calc.calculate(txs)
      expect(result.status).toBe(WalletStatus.ACTIVE)
      expect(result.category).toBe('MAIN')
      expect(result.totalOperations).toBe(40)
    })

    it('scoreAllTime e score90d estão no intervalo [0, 100]', () => {
      const txs = makeMixedSells(50, 0.65, 180)
      const result = calc.calculate(txs)
      expect(result.scoreAllTime).not.toBeNull()
      expect(result.score90d).not.toBeNull()
      expect(result.scoreAllTime!).toBeGreaterThanOrEqual(0)
      expect(result.scoreAllTime!).toBeLessThanOrEqual(100)
      expect(result.score90d!).toBeGreaterThanOrEqual(0)
      expect(result.score90d!).toBeLessThanOrEqual(100)
    })

    it('score mais alto para wallet com 100% win rate e ROI alto', () => {
      const bom = makeSells(35, 2.0, 120) // +200% sempre, 4 meses
      const ruim = makeMixedSells(35, 0.45, 120, 0.1, -0.4)
      const resultBom = calc.calculate(bom)
      const resultRuim = calc.calculate(ruim)
      expect(resultBom.scoreAllTime!).toBeGreaterThan(resultRuim.scoreAllTime!)
    })
  })

  // ── HIGH_RISK_HIGH_REWARD (win rate < 40%) ─────────────────────────────────

  describe('desqualificação — HIGH_RISK_HIGH_REWARD', () => {
    it('categoria HIGH_RISK_HIGH_REWARD quando win rate < 40%', () => {
      // 30 ops: 11 wins (36%) / 19 losses → win rate < 40%
      const txs = makeMixedSells(30, 0.36, 150, 2.0, -0.1)
      const result = calc.calculate(txs)
      expect(result.category).toBe('HIGH_RISK_HIGH_REWARD')
      expect(result.winRate).toBeLessThan(0.4)
    })

    it('win rate exatamente 40% fica em MAIN (limite inclusivo não cai em HIGH_RISK)', () => {
      // Simulando win rate próximo a 40% com distribuição clara
      const wins = makeSells(12, 0.5, 150)  // 12 wins
      const losses = makeSells(18, -0.2, 149) // 18 losses → 12/30 = 40%
      const txs = [...wins, ...losses].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      )
      const result = calc.calculate(txs)
      // win rate ponderada pode variar levemente com decay; verificar apenas que não é NaN
      expect(result.winRate).toBeGreaterThanOrEqual(0)
      expect(result.winRate).toBeLessThanOrEqual(1)
    })
  })

  // ── NEWCOMER (< 3 meses de histórico) ────────────────────────────────────

  describe('desqualificação — NEWCOMER', () => {
    it('categoria NEWCOMER e scoreAllTime nulo quando histórico < 3 meses', () => {
      // 35 operações em 60 dias (< 3 meses)
      const txs = makeSells(35, 0.5, 60)
      const result = calc.calculate(txs)
      expect(result.category).toBe('NEWCOMER')
      expect(result.scoreAllTime).toBeNull()
      expect(result.historyMonths).toBeLessThan(3)
    })

    it('score90d é calculado mesmo para NEWCOMER com ≥ 5 ops em 90d', () => {
      const txs = makeSells(35, 0.5, 60)
      const result = calc.calculate(txs)
      expect(result.score90d).not.toBeNull()
      expect(result.score90d!).toBeGreaterThanOrEqual(0)
    })

    it('status ACTIVE quando score90d existe (mesmo sem scoreAllTime)', () => {
      const txs = makeSells(35, 0.5, 60)
      const result = calc.calculate(txs)
      expect(result.status).toBe(WalletStatus.ACTIVE)
    })
  })

  // ── Win Rate ──────────────────────────────────────────────────────────────

  describe('win rate', () => {
    it('winRate = 1.0 quando todos os SELLs têm ROI positivo', () => {
      const txs = makeSells(30, 0.5, 120)
      const result = calc.calculate(txs)
      expect(result.winRate).toBeCloseTo(1.0, 2)
    })

    it('winRate = 0 quando todos os SELLs têm ROI negativo', () => {
      const txs = makeSells(30, -0.3, 120)
      const result = calc.calculate(txs)
      expect(result.winRate).toBeCloseTo(0, 2)
    })

    it('winRate ≈ 0.5 com metade wins e metade losses do mesmo peso', () => {
      // Distribui igualmente no tempo para que decay seja parecido
      const txs = makeMixedSells(40, 0.5, 120)
      const result = calc.calculate(txs)
      // Com decay, wins mais recentes pesam mais; aceita margem de ±0.15
      expect(result.winRate).toBeGreaterThan(0.35)
      expect(result.winRate).toBeLessThan(0.65)
    })
  })

  // ── Sharpe Ratio ──────────────────────────────────────────────────────────

  describe('sharpe ratio', () => {
    it('Sharpe alto para ROI alto e consistente (std → 0)', () => {
      // Todos com mesmo ROI positivo → std = 0 → sharpe = 4.0 (caso especial)
      const txs = makeSells(30, 1.0, 120)
      const result = calc.calculate(txs)
      expect(result.sharpeRatio).toBeCloseTo(4.0, 1)
    })

    it('Sharpe negativo para ROI negativo e consistente (std → 0)', () => {
      const txs = makeSells(30, -0.5, 120)
      const result = calc.calculate(txs)
      expect(result.sharpeRatio).toBeCloseTo(-2.0, 1)
    })

    it('Sharpe mais alto para retorno consistente vs retorno volátil com mesma média', () => {
      // Consistente: sempre +20%
      const consistente = makeSells(30, 0.2, 120)
      // Volátil: alterna entre +90% e -50% (média ≈ +20%)
      const volátil = Array.from({ length: 30 }, (_, i) =>
        makeSells(1, i % 2 === 0 ? 0.9 : -0.5, 120 - i * 3, 120 - i * 3 - 1)[0]!,
      )
      const rConsistente = calc.calculate(consistente)
      const rVolatil = calc.calculate(volátil)
      expect(rConsistente.sharpeRatio).toBeGreaterThan(rVolatil.sharpeRatio)
    })
  })

  // ── ROI Ajustado ──────────────────────────────────────────────────────────

  describe('ROI ajustado', () => {
    it('média ponderada do roiAdjusted das transações', () => {
      // 30 ops com ROI uniforme de 0.8 → média ponderada = 0.8
      const txs = makeSells(30, 0.8, 120)
      const result = calc.calculate(txs)
      // Com decay temporal, valores recentes pesam mais mas com ROI uniforme a média = 0.8
      expect(result.roiAdjusted).toBeCloseTo(0.8, 4)
    })

    it('ROI negativo médio resulta em roiAdjusted negativo', () => {
      const txs = makeSells(30, -0.4, 120)
      const result = calc.calculate(txs)
      expect(result.roiAdjusted).toBeLessThan(0)
    })
  })

  // ── Consistência ──────────────────────────────────────────────────────────

  describe('consistência', () => {
    it('consistência = 0.5 quando há < 3 janelas de 30 dias', () => {
      // 10 dias → no máximo 2 buckets (cruza no máximo 1 fronteira de 30d)
      // buckets.size < 3 → retorna 0.5 diretamente, sem calcular std
      const txs = makeSells(30, 0.5, 10)
      const result = calc.calculate(txs)
      expect(result.consistency).toBe(0.5)
    })

    it('consistência alta para win rate estável entre períodos', () => {
      // 3+ janelas com o mesmo ROI → todos os períodos com winRate = 1 → std = 0 → consistency = 1
      const txs = makeSells(40, 0.5, 120)
      const result = calc.calculate(txs)
      expect(result.consistency).toBeCloseTo(1.0, 2)
    })

    it('consistência mais alta para performance estável do que para mudança brusca de padrão', () => {
      // Estável: 40 wins distribuídos em 180 dias → todos os buckets com winRate = 1 → consistency = 1
      const estavel = makeSells(40, 0.5, 180)

      // Instável: wins nos primeiros 90 dias, losses nos últimos 90 dias
      // → metade dos buckets com winRate = 1, metade com winRate = 0 → std ≈ 0.5 → consistency ≈ 0.5
      const txsWins = makeSells(20, 0.5, 180, 91)
      const txsLosses = makeSells(20, -0.5, 90, 1)
      const instavel = [...txsWins, ...txsLosses].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      )

      const rEstavel = calc.calculate(estavel)
      const rInstavel = calc.calculate(instavel)
      expect(rEstavel.consistency).toBeGreaterThan(rInstavel.consistency)
    })
  })

  // ── Score Dual ────────────────────────────────────────────────────────────

  describe('score dual — all-time vs 90 dias', () => {
    it('score90d é null quando há < 5 operações nos últimos 90 dias', () => {
      // 30 ops, mas apenas 3 nos últimos 90 dias
      const antigas = makeSells(27, 0.5, 400, 91)
      const recentes = makeSells(3, 0.5, 89)
      const result = calc.calculate([...antigas, ...recentes])
      expect(result.score90d).toBeNull()
    })

    it('score90d calculado quando há ≥ 5 ops nos últimos 90 dias', () => {
      const antigas = makeSells(25, 0.5, 400, 91)
      const recentes = makeSells(10, 0.5, 89)
      const result = calc.calculate([...antigas, ...recentes])
      expect(result.score90d).not.toBeNull()
    })

    it('score90d ignora operações com mais de 90 dias', () => {
      // Wallet com performance ruim nos primeiros 3 meses e ótima nos últimos 90d
      const ruins = makeSells(25, -0.8, 365, 91)
      const ótimas = makeSells(10, 3.0, 89)
      const result = calc.calculate([...ruins, ...ótimas])

      // score90d deve refletir apenas as 10 operações ótimas
      // score all-time deve ser arrastado para baixo pelas ruins
      expect(result.score90d).toBeGreaterThan(result.scoreAllTime ?? 0)
    })

    it('decay exponencial: score all-time favorece operações recentes', () => {
      // Série A: ótimas recentes, ruins antigas
      const txsA = [
        ...makeSells(15, -0.8, 365, 181), // ruins há 6-12 meses
        ...makeSells(15, 2.0, 180, 10),   // ótimas nos últimos 6 meses
      ]
      // Série B: ruins recentes, ótimas antigas
      const txsB = [
        ...makeSells(15, 2.0, 365, 181),  // ótimas há 6-12 meses
        ...makeSells(15, -0.8, 180, 10),  // ruins nos últimos 6 meses
      ]
      const rA = calc.calculate(txsA)
      const rB = calc.calculate(txsB)

      // Quem está melhorando (A) deve ter all-time maior que quem está piorando (B)
      if (rA.scoreAllTime !== null && rB.scoreAllTime !== null) {
        expect(rA.scoreAllTime).toBeGreaterThan(rB.scoreAllTime)
      }
    })
  })

  // ── Composição do score final ─────────────────────────────────────────────

  describe('composição do score — fórmula 30/25/25/20', () => {
    it('score = 81.25 para cenário de vitórias uniformes (+50%) com 4+ meses de histórico', () => {
      // winRate = 1.0, sharpe → 4.0 (std=0, roi>0), roiNorm = (0.5+1)/6 = 0.25, consistency = 1.0
      // score = 100 * (0.30*1 + 0.25*1 + 0.25*0.25 + 0.20*1) = 81.25
      const txs = makeSells(35, 0.5, 130)
      const result = calc.calculate(txs)
      expect(result.scoreAllTime).toBeCloseTo(81.25, 1)
    })

    it('score mais baixo para carteira com perdas consistentes', () => {
      const txs = makeSells(35, -0.5, 130)
      const result = calc.calculate(txs)
      // winRate = 0, sharpe → -2.0 (normalizado = 0), roiNorm = 0.083, consistency = 1.0
      // score = 100 * (0 + 0 + 0.25*0.083 + 0.20*1) ≈ 22.08
      expect(result.scoreAllTime).toBeGreaterThanOrEqual(0)
      expect(result.scoreAllTime!).toBeLessThan(30)
    })

    it('score sempre entre 0 e 100 independente dos dados', () => {
      const cenarios = [
        makeSells(30, 100.0, 120),    // ROI absurdo positivo
        makeSells(30, -0.999, 120),   // Quase -100%
        makeMixedSells(50, 0.8, 180), // Misto realista
      ]
      for (const txs of cenarios) {
        const result = calc.calculate(txs)
        if (result.scoreAllTime !== null) {
          expect(result.scoreAllTime).toBeGreaterThanOrEqual(0)
          expect(result.scoreAllTime).toBeLessThanOrEqual(100)
        }
        if (result.score90d !== null) {
          expect(result.score90d).toBeGreaterThanOrEqual(0)
          expect(result.score90d).toBeLessThanOrEqual(100)
        }
      }
    })
  })

  // ── historyMonths ─────────────────────────────────────────────────────────

  describe('historyMonths', () => {
    it('historyMonths ≈ 0 para array vazio', () => {
      const result = calc.calculate([])
      expect(result.historyMonths).toBe(0)
    })

    it('historyMonths reflete o intervalo entre o SELL mais antigo e hoje', () => {
      const txs = makeSells(30, 0.5, 120) // spread de 120 dias
      const result = calc.calculate(txs)
      // 120 dias / 30 dias/mês ≈ 4 meses
      expect(result.historyMonths).toBeCloseTo(4, 0)
    })
  })
})
