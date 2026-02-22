import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Wallet } from '../entities'
import { CreateWalletDto } from './dto/create-wallet.dto'
import { UpdateWalletDto } from './dto/update-wallet.dto'

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  findAll(limit: number = 20, offset: number = 0): Promise<Wallet[]> {
    return this.walletRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    })
  }

  async findOne(id: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({ where: { id } })
    if (!wallet) throw new NotFoundException(`Wallet ${id} not found`)
    return wallet
  }

  create(dto: CreateWalletDto): Promise<Wallet> {
    const wallet = this.walletRepo.create({
      ...dto,
      firstSeen: new Date(dto.firstSeen),
    })
    return this.walletRepo.save(wallet)
  }

  async update(id: string, dto: UpdateWalletDto): Promise<Wallet> {
    const wallet = await this.findOne(id)
    Object.assign(wallet, dto)
    return this.walletRepo.save(wallet)
  }
}
