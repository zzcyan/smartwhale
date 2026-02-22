import { Test, TestingModule } from '@nestjs/testing'
import { AccumulationDetector, AccumulationDetectorInput } from './accumulation.detector'
import { AlertsService } from '../alerts/alerts.service'
import { Transaction, TransactionType, TransactionStatus, Chain } from '../entities'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cria uma transação de compra com timestamp relativo a "agora - offsetHours". */
function makeBuy(overrides: {
  tokenAddress?: string
  tokenSymbol?: string | null
  amountUsd?: string
  offsetHours?: number   // horas antes de agora (0 = agora)
  type?: TransactionType
}): Transaction {
  const tx = new Transaction()
  tx.id = Math.random().toString(36).slice(2)
  tx.txHash = '0x' + Math.random().toString(36).slice(2)
  tx.wallet = null as any
  tx.tokenAddress = overrides.tokenAddress ?? '0xtoken'
  tx.tokenSymbol = overrides.tokenSymbol !== undefined ? overrides.tokenSymbol : 'TKN'
  tx.chain = Chain.ETH
  tx.type = overrides.type ?? TransactionType.BUY
  tx.amountUsd = overrides.amountUsd ?? '10000.00'
  tx.blockNumber = '1'
  tx.timestamp = new Date(Date.now() - (overrides.offsetHours ?? 0) * 60 * 60 * 1000)
  tx.status = TransactionStatus.FINALIZADO
  tx.isFinalized = true
  tx.tokenRiskScore = null
  tx.roiAdjusted = null
  tx.createdAt = new Date()
  return tx
}

/** Gera N compras do mesmo token com espaçamento de `gapHours` entre cada uma. */
function makeBuyChain(
  n: number,
  gapHours: number,
  overrides: {
    tokenAddress?: string
    tokenSymbol?: string | null
    amountUsd?: string
  } = {},
): Transaction[] {
  return Array.from({ length: n }, (_, i) =>
    makeBuy({
      ...overrides,
      offsetHours: (n - 1 - i) * gapHours, // mais antigo primeiro
    }),
  )
}

// ─── Mock AlertsService ───────────────────────────────────────────────────────

const mockAlertsService = () => ({
  createAccumulationAlert: jest.fn().mockResolvedValue({}),
})

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AccumulationDetector', () => {
  let detector: AccumulationDetector
  let alertsService: ReturnType<typeof mockAlertsService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccumulationDetector,
        { provide: AlertsService, useFactory: mockAlertsService },
      ],
    }).compile()

    detector = module.get(AccumulationDetector)
    alertsService = module.get(AlertsService)
  })

  // ── Caso 1: Acumulação completa (5 compras, total ≥ $50k) ─────────────────

  it('caso 1 — 5 compras válidas, 2h+ de intervalo, total $80k → isComplete=true, alert disparado', async () => {
    const txs = makeBuyChain(5, 3, { amountUsd: '16000.00' }) // 5 × $16k = $80k
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map([['0xtoken', 1_000_000]]), // $16k < 3% de $1M = $30k ✓
    }

    const result = await detector.detect(input)

    expect(result).toHaveLength(1)
    expect(result[0]!.purchaseCount).toBe(5)
    expect(result[0]!.totalUsd).toBeCloseTo(80_000)
    expect(result[0]!.isComplete).toBe(true)
    expect(alertsService.createAccumulationAlert).toHaveBeenCalledTimes(1)
    expect(alertsService.createAccumulationAlert).toHaveBeenCalledWith('wallet-1', 'TKN', 5)
  })

  // ── Caso 2: Exatamente 3 compras → alert dispara, isComplete=false ─────────

  it('caso 2 — exatamente 3 compras válidas → count=3, isComplete=false, alert disparado', async () => {
    const txs = makeBuyChain(3, 3, { amountUsd: '5000.00' })
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map([['0xtoken', 500_000]]),
    }

    const result = await detector.detect(input)

    expect(result).toHaveLength(1)
    expect(result[0]!.purchaseCount).toBe(3)
    expect(result[0]!.isComplete).toBe(false)
    expect(alertsService.createAccumulationAlert).toHaveBeenCalledWith('wallet-1', 'TKN', 3)
  })

  // ── Caso 3: Apenas 2 compras → sem alerta, array vazio ────────────────────

  it('caso 3 — apenas 2 compras válidas → array vazio, alert NÃO chamado', async () => {
    const txs = makeBuyChain(2, 3, { amountUsd: '10000.00' })
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map([['0xtoken', 500_000]]),
    }

    const result = await detector.detect(input)

    expect(result).toHaveLength(0)
    expect(alertsService.createAccumulationAlert).not.toHaveBeenCalled()
  })

  // ── Caso 4: Intervalo < 2h → compras próximas ignoradas ───────────────────

  it('caso 4 — 5 compras a cada 30min → apenas 2 qualificam (cada 2h), sem alert', async () => {
    // Gap de 30min entre cada compra. O algoritmo greedy seleciona a próxima ≥ 2h depois:
    // buy[0] qualifica (t=0); buy[1..3] descartadas (< 2h); buy[4] qualifica (2h após buy[0]).
    // Resultado: chain = [buy[0], buy[4]] → count = 2 < 3 → sem alert.
    const txs = makeBuyChain(5, 0.5) // 0.5h = 30 min de gap
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map([['0xtoken', 1_000_000]]),
    }

    const result = await detector.detect(input)

    expect(result).toHaveLength(0)
    expect(alertsService.createAccumulationAlert).not.toHaveBeenCalled()
  })

  it('caso 4b — compras alternadas: 1h depois, 3h depois, 1h depois, 3h depois, 3h depois → 3 qualificam', async () => {
    // Offsets a partir de agora (mais antigo primeiro):
    // tx0: -11h, tx1: -10h (1h após tx0), tx2: -7h (3h após tx1), tx3: -6h (1h após tx2), tx4: -3h (3h após tx3), tx5: agora (3h após tx4)
    const now = Date.now()
    const txAt = (msAgo: number) =>
      makeBuy({ tokenAddress: '0xtoken', tokenSymbol: 'TKN', amountUsd: '5000.00', offsetHours: 0 })

    const makeAt = (hoursAgo: number): Transaction =>
      makeBuy({ tokenAddress: '0xtoken', tokenSymbol: 'TKN', amountUsd: '5000.00', offsetHours: hoursAgo })

    const txs = [
      makeAt(11), // qualifica (1ª)
      makeAt(10), // descartada (1h após anterior < 2h)
      makeAt(7),  // qualifica (3h após 1ª — ≥ 2h)
      makeAt(6),  // descartada (1h após anterior < 2h)
      makeAt(3),  // qualifica (3h após 2ª — ≥ 2h)
      makeAt(0),  // qualifica (3h após 3ª — ≥ 2h)
    ]

    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map([['0xtoken', 1_000_000]]),
    }

    const result = await detector.detect(input)

    expect(result[0]!.purchaseCount).toBe(4)
    expect(alertsService.createAccumulationAlert).toHaveBeenCalledWith('wallet-1', 'TKN', 4)

    void txAt // evita unused warning
  })

  // ── Caso 5: Compra excede 3% do volume diário → excluída ──────────────────

  it('caso 5 — uma compra acima de 3% do volume diário é excluída da cadeia', async () => {
    // Volume diário = $100k → 3% = $3k → compra de $4k supera o limite
    const txs = [
      makeBuy({ amountUsd: '2000.00', offsetHours: 12 }), // ✓
      makeBuy({ amountUsd: '4000.00', offsetHours: 9 }),  // ✗ excede 3% de $100k ($3k)
      makeBuy({ amountUsd: '2000.00', offsetHours: 6 }),  // ✓
      makeBuy({ amountUsd: '2000.00', offsetHours: 3 }),  // ✓
    ]
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map([['0xtoken', 100_000]]),
    }

    const result = await detector.detect(input)

    // 3 compras válidas (a de $4k é excluída), então count=3
    expect(result).toHaveLength(1)
    expect(result[0]!.purchaseCount).toBe(3)
    expect(result[0]!.totalUsd).toBeCloseTo(6_000)
  })

  // ── Caso 6: Compra fora da janela de 7 dias → excluída ────────────────────

  it('caso 6 — compra com mais de 7 dias é excluída da análise', async () => {
    const txs = [
      makeBuy({ amountUsd: '5000.00', offsetHours: 24 * 8 }), // 8 dias atrás → fora da janela
      makeBuy({ amountUsd: '5000.00', offsetHours: 12 }),
      makeBuy({ amountUsd: '5000.00', offsetHours: 8 }),
    ]
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map([['0xtoken', 1_000_000]]),
    }

    const result = await detector.detect(input)

    // Apenas 2 compras dentro da janela → não atinge mínimo de 3
    expect(result).toHaveLength(0)
    expect(alertsService.createAccumulationAlert).not.toHaveBeenCalled()
  })

  // ── Caso 7: 5 compras válidas, total < $50k → isComplete=false ────────────

  it('caso 7 — 5 compras válidas mas total < $50k → isComplete=false', async () => {
    // 5 × $8k = $40k < $50k
    const txs = makeBuyChain(5, 3, { amountUsd: '8000.00' })
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map([['0xtoken', 1_000_000]]),
    }

    const result = await detector.detect(input)

    expect(result).toHaveLength(1)
    expect(result[0]!.purchaseCount).toBe(5)
    expect(result[0]!.isComplete).toBe(false)
    expect(result[0]!.totalUsd).toBeCloseTo(40_000)
  })

  // ── Caso 8: Dois tokens acumulando simultaneamente ────────────────────────

  it('caso 8 — dois tokens acumulando → retorna 2 resultados, createAccumulationAlert chamado 2x', async () => {
    const txsA = makeBuyChain(3, 3, { tokenAddress: '0xtokenA', tokenSymbol: 'TKA', amountUsd: '5000.00' })
    const txsB = makeBuyChain(4, 3, { tokenAddress: '0xtokenB', tokenSymbol: 'TKB', amountUsd: '5000.00' })
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: [...txsA, ...txsB],
      tokenDailyVolumes: new Map([
        ['0xtokenA', 500_000],
        ['0xtokenB', 500_000],
      ]),
    }

    const result = await detector.detect(input)

    expect(result).toHaveLength(2)
    expect(alertsService.createAccumulationAlert).toHaveBeenCalledTimes(2)

    const addrs = result.map((r) => r.tokenAddress).sort()
    expect(addrs).toEqual(['0xtokenA', '0xtokenB'].sort())
  })

  // ── Caso 9: Apenas vendas (SELL) → array vazio ────────────────────────────

  it('caso 9 — somente transações SELL → array vazio, alert NÃO chamado', async () => {
    const txs = [
      makeBuy({ type: TransactionType.SELL, offsetHours: 12 }),
      makeBuy({ type: TransactionType.SELL, offsetHours: 8 }),
      makeBuy({ type: TransactionType.SELL, offsetHours: 4 }),
    ]
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map([['0xtoken', 500_000]]),
    }

    const result = await detector.detect(input)

    expect(result).toHaveLength(0)
    expect(alertsService.createAccumulationAlert).not.toHaveBeenCalled()
  })

  // ── Caso 10: Array de transações vazio ────────────────────────────────────

  it('caso 10 — array de transações vazio → array vazio, sem erros', async () => {
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: [],
      tokenDailyVolumes: new Map(),
    }

    const result = await detector.detect(input)

    expect(result).toHaveLength(0)
    expect(alertsService.createAccumulationAlert).not.toHaveBeenCalled()
  })

  // ── Caso 11: tokenDailyVolumes vazio → filtro de volume ignorado ──────────

  it('caso 11 — tokenDailyVolumes vazio → filtro de volume ignorado, compras grandes passam', async () => {
    // Compras gigantescas que seriam bloqueadas se houvesse volume → passam sem o volume
    const txs = makeBuyChain(3, 3, { amountUsd: '500000.00' })
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map(), // sem dados de volume
    }

    const result = await detector.detect(input)

    expect(result).toHaveLength(1)
    expect(result[0]!.purchaseCount).toBe(3)
  })

  // ── Caso 12: tokenSymbol null → usa tokenAddress no alert ─────────────────

  it('caso 12 — tokenSymbol null → createAccumulationAlert recebe tokenAddress como identificador', async () => {
    const txs = makeBuyChain(3, 3, { tokenAddress: '0xcontract123', tokenSymbol: null })
    const input: AccumulationDetectorInput = {
      walletId: 'wallet-1',
      transactions: txs,
      tokenDailyVolumes: new Map([['0xcontract123', 1_000_000]]),
    }

    const result = await detector.detect(input)

    expect(result[0]!.tokenSymbol).toBeNull()
    expect(alertsService.createAccumulationAlert).toHaveBeenCalledWith(
      'wallet-1',
      '0xcontract123',
      3,
    )
  })
})
