import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Transaction, Wallet } from '../entities'
import { ScoringModule } from '../scoring/scoring.module'
import { BitcoinIndexer } from './chains/bitcoin.indexer'
import { EvmIndexer } from './chains/evm.indexer'
import { SolanaIndexer } from './chains/solana.indexer'
import { IndexerController } from './indexer.controller'
import { IndexerService } from './indexer.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction]),
    // ScoringModule exporta AccumulationDetector e ConfluenceDetector
    ScoringModule,
  ],
  controllers: [IndexerController],
  providers: [IndexerService, SolanaIndexer, EvmIndexer, BitcoinIndexer],
})
export class IndexerModule {}
