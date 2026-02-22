import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Alert, Transaction, Wallet } from './entities'

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Wallet) private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Alert) private readonly alertRepo: Repository<Alert>,
  ) {}

  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }

  async getStats(): Promise<{ totalWallets: number; totalTransactions: number; totalAlerts: number }> {
    const [totalWallets, totalTransactions, totalAlerts] = await Promise.all([
      this.walletRepo.count(),
      this.txRepo.count(),
      this.alertRepo.count(),
    ])
    return { totalWallets, totalTransactions, totalAlerts }
  }
}
