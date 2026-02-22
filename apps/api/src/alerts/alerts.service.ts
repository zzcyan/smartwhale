import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Alert, AlertType, Wallet, Transaction, TransactionType } from '../entities'

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  findByWallet(walletId: string): Promise<Alert[]> {
    return this.alertRepo.find({
      where: { wallet: { id: walletId } },
      order: { createdAt: 'DESC' },
    })
  }

  async markAsRead(id: string): Promise<Alert> {
    const alert = await this.alertRepo.findOne({ where: { id } })
    if (!alert) throw new NotFoundException(`Alert ${id} not found`)

    alert.isRead = true
    return this.alertRepo.save(alert)
  }

  /**
   * Cria alerta de WHALE_MOVEMENT quando uma transação é registrada em wallet monitorada.
   * Chamado pelo pipeline de transações após persistir a transação.
   */
  async createWhaleMovementAlert(walletId: string, transaction: Transaction): Promise<Alert> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } })
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`)

    const action = transaction.type === TransactionType.BUY ? 'Comprou' : 'Vendeu'
    const token = transaction.tokenSymbol ?? transaction.tokenAddress
    const amount = parseFloat(transaction.amountUsd).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    const alert = this.alertRepo.create({
      wallet,
      type: AlertType.WHALE_MOVEMENT,
      message: `${action} ${amount} USD de ${token}`,
      value: transaction.amountUsd,
    })

    return this.alertRepo.save(alert)
  }

  /**
   * Cria alerta de ACCUMULATION para acumulação silenciosa detectada.
   * Pré-condição: count >= 3 (validado pelo caller — SPEC.md §13).
   */
  async createAccumulationAlert(
    walletId: string,
    tokenSymbol: string,
    count: number,
  ): Promise<Alert> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } })
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`)

    const alert = this.alertRepo.create({
      wallet,
      type: AlertType.ACCUMULATION,
      message: `Possível Acumulação Silenciosa: ${count} compras de ${tokenSymbol} detectadas`,
      value: null,
    })

    return this.alertRepo.save(alert)
  }

  /**
   * Cria alertas de CONFLUENCE — um por wallet no array.
   * wallets já carregadas pelo caller (3+ wallets detectaram o mesmo token em janela de 4h).
   * confidenceLevel: 'Alta Confiança' | 'Moderado' (pré-calculado pelo caller — SPEC.md §12).
   * Retorna Alert[] (uma entrada por wallet).
   */
  async createConfluenceAlert(
    tokenSymbol: string,
    wallets: Wallet[],
    confidenceLevel: string,
  ): Promise<Alert[]> {
    const count = wallets.length

    const alerts = wallets.map((wallet) =>
      this.alertRepo.create({
        wallet,
        type: AlertType.CONFLUENCE,
        message: `Confluência ${confidenceLevel}: ${count} whales compraram ${tokenSymbol} na janela de 4 horas`,
        value: null,
      }),
    )

    return this.alertRepo.save(alerts)
  }

  /**
   * Cria alerta de REORG_CANCEL quando uma transação sofre reorganização de bloco.
   * SPEC.md §5.3: alerta de cancelamento explícito — NUNCA silenciar.
   */
  async createReorgCancelAlert(txHash: string): Promise<Alert> {
    const tx = await this.txRepo.findOne({
      where: { txHash },
      relations: ['wallet'],
    })
    if (!tx) throw new NotFoundException(`Transaction ${txHash} not found`)

    const alert = this.alertRepo.create({
      wallet: tx.wallet,
      type: AlertType.REORG_CANCEL,
      message: `Alerta de Reorg: transação ${txHash} foi cancelada pela reorganização da blockchain`,
      value: tx.amountUsd,
    })

    return this.alertRepo.save(alert)
  }
}
