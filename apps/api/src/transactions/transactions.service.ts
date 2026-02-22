import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Transaction, Wallet } from '../entities'
import { CreateTransactionDto } from './dto/create-transaction.dto'

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  findAll(walletId?: string, limit = 20, offset = 0): Promise<Transaction[]> {
    const qb = this.txRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.wallet', 'wallet')
      .orderBy('tx.timestamp', 'DESC')
      .take(limit)
      .skip(offset)

    if (walletId) {
      qb.where('tx.wallet_id = :walletId', { walletId })
    }

    return qb.getMany()
  }

  async create(dto: CreateTransactionDto): Promise<Transaction> {
    const wallet = await this.walletRepo.findOne({ where: { id: dto.walletId } })
    if (!wallet) throw new NotFoundException(`Wallet ${dto.walletId} not found`)

    const tx = this.txRepo.create({
      wallet,
      tokenAddress: dto.tokenAddress,
      tokenSymbol: dto.tokenSymbol ?? null,
      chain: dto.chain,
      type: dto.type,
      amountUsd: dto.amountUsd,
      txHash: dto.txHash,
      blockNumber: dto.blockNumber,
      timestamp: new Date(dto.timestamp),
    })
    return this.txRepo.save(tx)
  }
}
