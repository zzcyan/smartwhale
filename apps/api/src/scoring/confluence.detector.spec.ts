import { Test, TestingModule } from '@nestjs/testing'
import { ConfluenceDetector, ConfluenceDetectorInput } from './confluence.detector'
import { AlertsService } from '../alerts/alerts.service'
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  Chain,
  Wallet,
  WalletStatus,
} from '../entities'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cria uma Wallet com currentScore configurável (TypeORM retorna decimal como string). */
function makeWallet(id: string, score: string | null): Wallet {
  const w = new Wallet()
  w.id = id
  w.address = `0xwallet${id}`
  w.chain = Chain.ETH
  w.type = null
  w.currentScore = score
  w.winRate = null
  w.roi = null
  w.totalOperations = score !== null ? 50 : 0
  w.firstSeen = new Date('2024-01-01')
  w.lastActive = new Date()
  w.status = score !== null ? WalletStatus.ACTIVE : WalletStatus.OBSERVACAO
  w.createdAt = new Date()
  w.updatedAt = new Date()
  w.scores = []
  w.transactions = []
  w.alerts = []
  return w
}

/**
 * Cria uma transação BUY de uma wallet para um token específico,
 * com timestamp = agora - offsetHours horas.
 */
function makeBuyTx(
  wallet: Wallet,
  tokenAddress: string,
  tokenSymbol: string | null,
  offsetHours: number,
  type: TransactionType = TransactionType.BUY,
): Transaction {
  const tx = new Transaction()
  tx.id = Math.random().toString(36).slice(2)
  tx.txHash = '0x' + Math.random().toString(36).slice(2)
  tx.wallet = wallet
  tx.tokenAddress = tokenAddress
  tx.tokenSymbol = tokenSymbol
  tx.chain = Chain.ETH
  tx.type = type
  tx.amountUsd = '10000.00'
  tx.blockNumber = '1000'
  tx.timestamp = new Date(Date.now() - offsetHours * 60 * 60 * 1000)
  tx.status = TransactionStatus.FINALIZADO
  tx.isFinalized = true
  tx.tokenRiskScore = null
  tx.roiAdjusted = null
  tx.createdAt = new Date()
  return tx
}

// ─── Mock AlertsService ───────────────────────────────────────────────────────

const mockAlertsService = () => ({
  createConfluenceAlert: jest.fn().mockResolvedValue([]),
})

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('ConfluenceDetector', () => {
  let detector: ConfluenceDetector
  let alertsService: ReturnType<typeof mockAlertsService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfluenceDetector,
        { provide: AlertsService, useFactory: mockAlertsService },
      ],
    }).compile()

    detector = module.get(ConfluenceDetector)
    alertsService = module.get(AlertsService)
  })

  // ── Caso 1: 3 wallets com score médio > 85 → "Alta Confiança" ─────────────

  it('caso 1 — 3 wallets com score médio = 90 → signal "Alta Confiança", alert disparado', async () => {
    const wallets = [makeWallet('w1', '90'), makeWallet('w2', '90'), makeWallet('w3', '90')]
    const txs = wallets.map((w) => makeBuyTx(w, '0xtoken', 'TKN', 1))
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    expect(result).toHaveLength(1)
    expect(result[0]!.confidenceLevel).toBe('Alta Confiança')
    expect(result[0]!.walletCount).toBe(3)
    expect(result[0]!.avgWhaleScore).toBeCloseTo(90)
    expect(result[0]!.tokenAddress).toBe('0xtoken')
    expect(result[0]!.tokenSymbol).toBe('TKN')
    expect(alertsService.createConfluenceAlert).toHaveBeenCalledTimes(1)
    expect(alertsService.createConfluenceAlert).toHaveBeenCalledWith('TKN', wallets, 'Alta Confiança')
  })

  // ── Caso 2: 3 wallets com score médio = 72 → "Moderado" ───────────────────

  it('caso 2 — 3 wallets com score médio = 72 → signal "Moderado", alert disparado', async () => {
    const wallets = [makeWallet('w1', '70'), makeWallet('w2', '72'), makeWallet('w3', '74')]
    const txs = wallets.map((w) => makeBuyTx(w, '0xtoken', 'TKN', 1))
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    expect(result).toHaveLength(1)
    expect(result[0]!.confidenceLevel).toBe('Moderado')
    expect(result[0]!.walletCount).toBe(3)
    expect(result[0]!.avgWhaleScore).toBeCloseTo(72)
    expect(alertsService.createConfluenceAlert).toHaveBeenCalledWith('TKN', expect.any(Array), 'Moderado')
  })

  // ── Caso 3: Apenas 2 wallets (abaixo do mínimo de 3) ─────────────────────

  it('caso 3 — apenas 2 wallets compram o mesmo token → array vazio, alert NÃO chamado', async () => {
    const wallets = [makeWallet('w1', '90'), makeWallet('w2', '90')]
    const txs = wallets.map((w) => makeBuyTx(w, '0xtoken', 'TKN', 1))
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    expect(result).toHaveLength(0)
    expect(alertsService.createConfluenceAlert).not.toHaveBeenCalled()
  })

  // ── Caso 4: Score médio abaixo de 60 → nenhum sinal ──────────────────────

  it('caso 4 — 3 wallets com score médio = 55 (< 60) → array vazio, alert NÃO chamado', async () => {
    const wallets = [makeWallet('w1', '55'), makeWallet('w2', '55'), makeWallet('w3', '55')]
    const txs = wallets.map((w) => makeBuyTx(w, '0xtoken', 'TKN', 1))
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    expect(result).toHaveLength(0)
    expect(alertsService.createConfluenceAlert).not.toHaveBeenCalled()
  })

  // ── Caso 5: Transações fora da janela de 4h → não contam ─────────────────

  it('caso 5 — compras 5h atrás estão fora da janela de 4h → não contam', async () => {
    const wallets = [makeWallet('w1', '90'), makeWallet('w2', '90'), makeWallet('w3', '90')]
    // 2 dentro da janela, 1 fora (5h atrás)
    const txs = [
      makeBuyTx(wallets[0]!, '0xtoken', 'TKN', 1),  // 1h atrás ✓
      makeBuyTx(wallets[1]!, '0xtoken', 'TKN', 2),  // 2h atrás ✓
      makeBuyTx(wallets[2]!, '0xtoken', 'TKN', 5),  // 5h atrás ✗ (fora da janela)
    ]
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    // Apenas 2 wallets dentro da janela → abaixo do mínimo de 3
    expect(result).toHaveLength(0)
    expect(alertsService.createConfluenceAlert).not.toHaveBeenCalled()
  })

  // ── Caso 6: Somente SELL (nenhum BUY) → array vazio ──────────────────────

  it('caso 6 — somente transações SELL → array vazio, alert NÃO chamado', async () => {
    const wallets = [makeWallet('w1', '90'), makeWallet('w2', '90'), makeWallet('w3', '90')]
    const txs = wallets.map((w) =>
      makeBuyTx(w, '0xtoken', 'TKN', 1, TransactionType.SELL),
    )
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    expect(result).toHaveLength(0)
    expect(alertsService.createConfluenceAlert).not.toHaveBeenCalled()
  })

  // ── Caso 7: Wallet com currentScore = null não conta ──────────────────────

  it('caso 7 — wallet com currentScore=null não conta para a confluência', async () => {
    const walletWithScore = [makeWallet('w1', '90'), makeWallet('w2', '90')]
    const walletWithoutScore = makeWallet('w3', null) // sem Whale Score calculado

    const txs = [
      makeBuyTx(walletWithScore[0]!, '0xtoken', 'TKN', 1),
      makeBuyTx(walletWithScore[1]!, '0xtoken', 'TKN', 1),
      makeBuyTx(walletWithoutScore, '0xtoken', 'TKN', 1),
    ]
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    // Apenas 2 wallets com score → abaixo do mínimo de 3
    expect(result).toHaveLength(0)
    expect(alertsService.createConfluenceAlert).not.toHaveBeenCalled()
  })

  // ── Caso 8: Dois tokens em confluência simultânea ─────────────────────────

  it('caso 8 — dois tokens em confluência simultânea → 2 signals, createConfluenceAlert chamado 2x', async () => {
    const walletsA = [makeWallet('wA1', '90'), makeWallet('wA2', '90'), makeWallet('wA3', '90')]
    const walletsB = [makeWallet('wB1', '75'), makeWallet('wB2', '75'), makeWallet('wB3', '75')]

    const txs = [
      ...walletsA.map((w) => makeBuyTx(w, '0xtokenA', 'TKA', 1)),
      ...walletsB.map((w) => makeBuyTx(w, '0xtokenB', 'TKB', 1)),
    ]
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    expect(result).toHaveLength(2)
    expect(alertsService.createConfluenceAlert).toHaveBeenCalledTimes(2)

    const tokenAddresses = result.map((s) => s.tokenAddress).sort()
    expect(tokenAddresses).toEqual(['0xtokenA', '0xtokenB'].sort())
  })

  // ── Caso 9: Mesma wallet compra 2x o mesmo token → conta como 1 wallet ───

  it('caso 9 — mesma wallet compra 2x o mesmo token → deduplica para 1 wallet', async () => {
    const repeatedWallet = makeWallet('w1', '90')
    const otherWallets = [makeWallet('w2', '90'), makeWallet('w3', '90')]

    const txs = [
      // w1 compra 2x
      makeBuyTx(repeatedWallet, '0xtoken', 'TKN', 1),
      makeBuyTx(repeatedWallet, '0xtoken', 'TKN', 2),
      // w2 e w3 compram 1x cada
      makeBuyTx(otherWallets[0]!, '0xtoken', 'TKN', 1),
      makeBuyTx(otherWallets[1]!, '0xtoken', 'TKN', 1),
    ]
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    // w1 + w2 + w3 = 3 wallets únicas → sinal válido
    expect(result).toHaveLength(1)
    expect(result[0]!.walletCount).toBe(3)
    expect(alertsService.createConfluenceAlert).toHaveBeenCalledTimes(1)
  })

  it('caso 9b — mesma wallet repete, sem outras wallets suficientes → array vazio', async () => {
    const singleWallet = makeWallet('w1', '90')
    // Uma segunda wallet
    const secondWallet = makeWallet('w2', '90')

    const txs = [
      makeBuyTx(singleWallet, '0xtoken', 'TKN', 1),
      makeBuyTx(singleWallet, '0xtoken', 'TKN', 2), // mesma wallet → descartada na dedup
      makeBuyTx(secondWallet, '0xtoken', 'TKN', 1),
    ]
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    // Apenas 2 wallets únicas → abaixo do mínimo
    expect(result).toHaveLength(0)
    expect(alertsService.createConfluenceAlert).not.toHaveBeenCalled()
  })

  // ── Caso 10: expiresAt ≈ 24h a partir de agora ───────────────────────────

  it('caso 10 — expiresAt está aproximadamente 24h a partir de agora', async () => {
    const wallets = [makeWallet('w1', '90'), makeWallet('w2', '90'), makeWallet('w3', '90')]
    const txs = wallets.map((w) => makeBuyTx(w, '0xtoken', 'TKN', 1))
    const input: ConfluenceDetectorInput = { transactions: txs }

    const before = Date.now()
    const result = await detector.detect(input)
    const after = Date.now()

    const expectedMin = before + 24 * 60 * 60 * 1000
    const expectedMax = after + 24 * 60 * 60 * 1000

    expect(result[0]!.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin)
    expect(result[0]!.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax)
  })

  // ── Caso 11: Limiar exato avg = 85 → "Moderado" (não "Alta Confiança") ───

  it('caso 11 — avg score = 85 (limiar exato, não > 85) → "Moderado"', async () => {
    const wallets = [makeWallet('w1', '85'), makeWallet('w2', '85'), makeWallet('w3', '85')]
    const txs = wallets.map((w) => makeBuyTx(w, '0xtoken', 'TKN', 1))
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    expect(result).toHaveLength(1)
    expect(result[0]!.confidenceLevel).toBe('Moderado')
    expect(result[0]!.avgWhaleScore).toBeCloseTo(85)
  })

  // ── Caso 12: Limiar exato avg = 60 → "Moderado" (mínimo válido) ──────────

  it('caso 12 — avg score = 60 (mínimo para "Moderado") → signal "Moderado"', async () => {
    const wallets = [makeWallet('w1', '60'), makeWallet('w2', '60'), makeWallet('w3', '60')]
    const txs = wallets.map((w) => makeBuyTx(w, '0xtoken', 'TKN', 1))
    const input: ConfluenceDetectorInput = { transactions: txs }

    const result = await detector.detect(input)

    expect(result).toHaveLength(1)
    expect(result[0]!.confidenceLevel).toBe('Moderado')
    expect(result[0]!.avgWhaleScore).toBeCloseTo(60)
    expect(alertsService.createConfluenceAlert).toHaveBeenCalledWith('TKN', expect.any(Array), 'Moderado')
  })

  // ── Caso 13: Input vazio → array vazio, sem erros ─────────────────────────

  it('caso 13 — array de transações vazio → array vazio, sem erros', async () => {
    const input: ConfluenceDetectorInput = { transactions: [] }

    const result = await detector.detect(input)

    expect(result).toHaveLength(0)
    expect(alertsService.createConfluenceAlert).not.toHaveBeenCalled()
  })
})
