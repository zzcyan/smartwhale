import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { AlertsService } from './alerts.service'
import { Alert, AlertType, Wallet, Transaction, TransactionType, TransactionStatus, Chain } from '../entities'

// ─── Mock factory ─────────────────────────────────────────────────────────────

const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
})

type MockRepo = ReturnType<typeof mockRepository>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWallet(overrides: Partial<Wallet> = {}): Wallet {
  const w = new Wallet()
  w.id = 'wallet-uuid-1'
  w.address = '0xabc'
  w.chain = Chain.ETH
  w.type = null
  w.currentScore = null
  w.winRate = null
  w.roi = null
  w.totalOperations = 0
  w.firstSeen = new Date('2024-01-01')
  w.lastActive = null
  w.createdAt = new Date()
  w.updatedAt = new Date()
  return Object.assign(w, overrides)
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const tx = new Transaction()
  tx.id = 'tx-uuid-1'
  tx.txHash = '0xdeadbeef'
  tx.type = TransactionType.BUY
  tx.tokenAddress = '0xtoken'
  tx.tokenSymbol = 'ETH'
  tx.amountUsd = '1500.00'
  tx.chain = Chain.ETH
  tx.blockNumber = '12345'
  tx.timestamp = new Date()
  tx.status = TransactionStatus.PENDENTE
  tx.isFinalized = false
  tx.tokenRiskScore = null
  tx.roiAdjusted = null
  tx.createdAt = new Date()
  tx.wallet = makeWallet()
  return Object.assign(tx, overrides)
}

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  const a = new Alert()
  a.id = 'alert-uuid-1'
  a.type = AlertType.WHALE_MOVEMENT
  a.message = 'test message'
  a.value = null
  a.isRead = false
  a.createdAt = new Date()
  a.wallet = makeWallet()
  return Object.assign(a, overrides)
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AlertsService', () => {
  let service: AlertsService
  let alertRepo: MockRepo
  let walletRepo: MockRepo
  let txRepo: MockRepo

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(Alert), useFactory: mockRepository },
        { provide: getRepositoryToken(Wallet), useFactory: mockRepository },
        { provide: getRepositoryToken(Transaction), useFactory: mockRepository },
      ],
    }).compile()

    service = module.get(AlertsService)
    alertRepo = module.get(getRepositoryToken(Alert))
    walletRepo = module.get(getRepositoryToken(Wallet))
    txRepo = module.get(getRepositoryToken(Transaction))
  })

  // ── findByWallet ──────────────────────────────────────────────────────────

  describe('findByWallet', () => {
    it('retorna alertas da wallet ordenados por createdAt DESC', async () => {
      const alerts = [makeAlert(), makeAlert({ id: 'alert-uuid-2' })]
      alertRepo.find.mockResolvedValue(alerts)

      const result = await service.findByWallet('wallet-uuid-1')

      expect(alertRepo.find).toHaveBeenCalledWith({
        where: { wallet: { id: 'wallet-uuid-1' } },
        order: { createdAt: 'DESC' },
      })
      expect(result).toEqual(alerts)
    })

    it('retorna array vazio quando wallet não tem alertas', async () => {
      alertRepo.find.mockResolvedValue([])

      const result = await service.findByWallet('wallet-uuid-1')

      expect(result).toEqual([])
    })
  })

  // ── markAsRead ────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('marca alerta como lido e persiste', async () => {
      const alert = makeAlert({ isRead: false })
      const saved = makeAlert({ isRead: true })

      alertRepo.findOne.mockResolvedValue(alert)
      alertRepo.save.mockResolvedValue(saved)

      const result = await service.markAsRead('alert-uuid-1')

      expect(alert.isRead).toBe(true)
      expect(alertRepo.save).toHaveBeenCalledWith(alert)
      expect(result.isRead).toBe(true)
    })

    it('lança NotFoundException quando alerta não existe', async () => {
      alertRepo.findOne.mockResolvedValue(null)

      await expect(service.markAsRead('inexistente')).rejects.toThrow(
        new NotFoundException('Alert inexistente not found'),
      )
    })
  })

  // ── createWhaleMovementAlert ──────────────────────────────────────────────

  describe('createWhaleMovementAlert', () => {
    it('cria alerta de COMPRA com mensagem "Comprou"', async () => {
      const wallet = makeWallet()
      const tx = makeTransaction({ type: TransactionType.BUY, tokenSymbol: 'ETH', amountUsd: '1500.00' })
      const builtAlert = makeAlert({ type: AlertType.WHALE_MOVEMENT })

      walletRepo.findOne.mockResolvedValue(wallet)
      alertRepo.create.mockReturnValue(builtAlert)
      alertRepo.save.mockResolvedValue(builtAlert)

      const result = await service.createWhaleMovementAlert('wallet-uuid-1', tx)

      expect(walletRepo.findOne).toHaveBeenCalledWith({ where: { id: 'wallet-uuid-1' } })
      const createCall = alertRepo.create.mock.calls[0][0] as Partial<Alert>
      expect(createCall.type).toBe(AlertType.WHALE_MOVEMENT)
      expect(createCall.wallet).toBe(wallet)
      expect(createCall.value).toBe('1500.00')
      expect(createCall.message).toContain('Comprou')
      expect(createCall.message).toContain('ETH')
      expect(result).toEqual(builtAlert)
    })

    it('cria alerta de VENDA com mensagem "Vendeu"', async () => {
      const wallet = makeWallet()
      const tx = makeTransaction({ type: TransactionType.SELL, tokenSymbol: 'BTC', amountUsd: '3000.00' })
      const builtAlert = makeAlert()

      walletRepo.findOne.mockResolvedValue(wallet)
      alertRepo.create.mockReturnValue(builtAlert)
      alertRepo.save.mockResolvedValue(builtAlert)

      await service.createWhaleMovementAlert('wallet-uuid-1', tx)

      const createCall = alertRepo.create.mock.calls[0][0] as Partial<Alert>
      expect(createCall.message).toContain('Vendeu')
      expect(createCall.message).toContain('BTC')
    })

    it('usa tokenAddress como fallback quando tokenSymbol é null', async () => {
      const wallet = makeWallet()
      const tx = makeTransaction({ tokenSymbol: null, tokenAddress: '0xcontract123' })
      const builtAlert = makeAlert()

      walletRepo.findOne.mockResolvedValue(wallet)
      alertRepo.create.mockReturnValue(builtAlert)
      alertRepo.save.mockResolvedValue(builtAlert)

      await service.createWhaleMovementAlert('wallet-uuid-1', tx)

      const createCall = alertRepo.create.mock.calls[0][0] as Partial<Alert>
      expect(createCall.message).toContain('0xcontract123')
    })

    it('define value igual ao amountUsd da transação', async () => {
      const wallet = makeWallet()
      const tx = makeTransaction({ amountUsd: '9999.50' })
      const builtAlert = makeAlert()

      walletRepo.findOne.mockResolvedValue(wallet)
      alertRepo.create.mockReturnValue(builtAlert)
      alertRepo.save.mockResolvedValue(builtAlert)

      await service.createWhaleMovementAlert('wallet-uuid-1', tx)

      const createCall = alertRepo.create.mock.calls[0][0] as Partial<Alert>
      expect(createCall.value).toBe('9999.50')
    })

    it('lança NotFoundException quando wallet não existe', async () => {
      walletRepo.findOne.mockResolvedValue(null)
      const tx = makeTransaction()

      await expect(service.createWhaleMovementAlert('inexistente', tx)).rejects.toThrow(
        new NotFoundException('Wallet inexistente not found'),
      )
      expect(alertRepo.create).not.toHaveBeenCalled()
    })
  })

  // ── createAccumulationAlert ───────────────────────────────────────────────

  describe('createAccumulationAlert', () => {
    it('cria alerta de ACCUMULATION com mensagem correta', async () => {
      const wallet = makeWallet()
      const builtAlert = makeAlert({ type: AlertType.ACCUMULATION })

      walletRepo.findOne.mockResolvedValue(wallet)
      alertRepo.create.mockReturnValue(builtAlert)
      alertRepo.save.mockResolvedValue(builtAlert)

      const result = await service.createAccumulationAlert('wallet-uuid-1', 'MATIC', 5)

      const createCall = alertRepo.create.mock.calls[0][0] as Partial<Alert>
      expect(createCall.type).toBe(AlertType.ACCUMULATION)
      expect(createCall.wallet).toBe(wallet)
      expect(createCall.value).toBeNull()
      expect(createCall.message).toContain('Possível Acumulação Silenciosa')
      expect(createCall.message).toContain('MATIC')
      expect(createCall.message).toContain('5')
      expect(result).toEqual(builtAlert)
    })

    it('inclui count mínimo (3) na mensagem', async () => {
      const wallet = makeWallet()
      const builtAlert = makeAlert()

      walletRepo.findOne.mockResolvedValue(wallet)
      alertRepo.create.mockReturnValue(builtAlert)
      alertRepo.save.mockResolvedValue(builtAlert)

      await service.createAccumulationAlert('wallet-uuid-1', 'SOL', 3)

      const createCall = alertRepo.create.mock.calls[0][0] as Partial<Alert>
      expect(createCall.message).toContain('3')
    })

    it('lança NotFoundException quando wallet não existe', async () => {
      walletRepo.findOne.mockResolvedValue(null)

      await expect(service.createAccumulationAlert('inexistente', 'ETH', 3)).rejects.toThrow(
        new NotFoundException('Wallet inexistente not found'),
      )
      expect(alertRepo.create).not.toHaveBeenCalled()
    })
  })

  // ── createConfluenceAlert ─────────────────────────────────────────────────

  describe('createConfluenceAlert', () => {
    it('cria um alerta por wallet com "Alta Confiança"', async () => {
      const wallets = [
        makeWallet({ id: 'w1' }),
        makeWallet({ id: 'w2' }),
        makeWallet({ id: 'w3' }),
      ]
      const builtAlerts = wallets.map((w) => makeAlert({ wallet: w, type: AlertType.CONFLUENCE }))

      alertRepo.create.mockImplementation((data: Partial<Alert>) =>
        makeAlert({ wallet: data.wallet, type: AlertType.CONFLUENCE }),
      )
      alertRepo.save.mockResolvedValue(builtAlerts)

      const result = await service.createConfluenceAlert('BTC', wallets, 'Alta Confiança')

      expect(alertRepo.create).toHaveBeenCalledTimes(3)
      const savedArg = alertRepo.save.mock.calls[0][0] as Alert[]
      expect(savedArg).toHaveLength(3)
      expect(result).toEqual(builtAlerts)
    })

    it('cria alertas com nível "Moderado" na mensagem', async () => {
      const wallets = [
        makeWallet({ id: 'w1' }),
        makeWallet({ id: 'w2' }),
        makeWallet({ id: 'w3' }),
      ]

      alertRepo.create.mockImplementation(() => makeAlert({ type: AlertType.CONFLUENCE }))
      alertRepo.save.mockResolvedValue([])

      await service.createConfluenceAlert('SOL', wallets, 'Moderado')

      const createCalls = alertRepo.create.mock.calls as [Partial<Alert>][]
      createCalls.forEach((call) => {
        expect(call[0].message).toContain('Moderado')
        expect(call[0].message).toContain('SOL')
        expect(call[0].message).toContain('janela de 4 horas')
      })
    })

    it('mensagem contém o número de wallets participantes', async () => {
      const wallets = [
        makeWallet({ id: 'w1' }),
        makeWallet({ id: 'w2' }),
        makeWallet({ id: 'w3' }),
        makeWallet({ id: 'w4' }),
      ]

      alertRepo.create.mockImplementation(() => makeAlert({ type: AlertType.CONFLUENCE }))
      alertRepo.save.mockResolvedValue([])

      await service.createConfluenceAlert('ETH', wallets, 'Alta Confiança')

      const createCalls = alertRepo.create.mock.calls as [Partial<Alert>][]
      createCalls.forEach((call) => {
        expect(call[0].message).toContain('4')
      })
    })

    it('todos os alertas têm value = null', async () => {
      const wallets = [
        makeWallet({ id: 'w1' }),
        makeWallet({ id: 'w2' }),
        makeWallet({ id: 'w3' }),
      ]

      alertRepo.create.mockImplementation(() => makeAlert())
      alertRepo.save.mockResolvedValue([])

      await service.createConfluenceAlert('BNB', wallets, 'Alta Confiança')

      const createCalls = alertRepo.create.mock.calls as [Partial<Alert>][]
      createCalls.forEach((call) => {
        expect(call[0].value).toBeNull()
      })
    })
  })

  // ── createReorgCancelAlert ────────────────────────────────────────────────

  describe('createReorgCancelAlert', () => {
    it('cria alerta REORG_CANCEL com txHash na mensagem e amountUsd no value', async () => {
      const wallet = makeWallet()
      const tx = makeTransaction({ txHash: '0xdeadbeef', amountUsd: '5000.00', wallet })
      const builtAlert = makeAlert({ type: AlertType.REORG_CANCEL, value: '5000.00' })

      txRepo.findOne.mockResolvedValue(tx)
      alertRepo.create.mockReturnValue(builtAlert)
      alertRepo.save.mockResolvedValue(builtAlert)

      const result = await service.createReorgCancelAlert('0xdeadbeef')

      expect(txRepo.findOne).toHaveBeenCalledWith({
        where: { txHash: '0xdeadbeef' },
        relations: ['wallet'],
      })
      const createCall = alertRepo.create.mock.calls[0][0] as Partial<Alert>
      expect(createCall.type).toBe(AlertType.REORG_CANCEL)
      expect(createCall.wallet).toBe(wallet)
      expect(createCall.value).toBe('5000.00')
      expect(createCall.message).toContain('0xdeadbeef')
      expect(createCall.message).toContain('Reorg')
      expect(result).toEqual(builtAlert)
    })

    it('mensagem menciona reorganização da blockchain', async () => {
      const wallet = makeWallet()
      const tx = makeTransaction({ wallet })

      txRepo.findOne.mockResolvedValue(tx)
      alertRepo.create.mockReturnValue(makeAlert())
      alertRepo.save.mockResolvedValue(makeAlert())

      await service.createReorgCancelAlert('0xdeadbeef')

      const createCall = alertRepo.create.mock.calls[0][0] as Partial<Alert>
      expect(createCall.message).toContain('reorganização da blockchain')
    })

    it('value do alerta reflete exatamente o amountUsd da transação', async () => {
      const wallet = makeWallet()
      const tx = makeTransaction({ amountUsd: '123456.78901234', wallet })

      txRepo.findOne.mockResolvedValue(tx)
      alertRepo.create.mockReturnValue(makeAlert())
      alertRepo.save.mockResolvedValue(makeAlert())

      await service.createReorgCancelAlert('0xdeadbeef')

      const createCall = alertRepo.create.mock.calls[0][0] as Partial<Alert>
      expect(createCall.value).toBe('123456.78901234')
    })

    it('lança NotFoundException quando txHash não existe', async () => {
      txRepo.findOne.mockResolvedValue(null)

      await expect(service.createReorgCancelAlert('0xinexistente')).rejects.toThrow(
        new NotFoundException('Transaction 0xinexistente not found'),
      )
      expect(alertRepo.create).not.toHaveBeenCalled()
    })
  })
})
