import { Body, Controller, Post } from '@nestjs/common'
import { IndexerService } from './indexer.service'

@Controller('indexer')
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  /**
   * Recebe transações do Helius enhanced webhook.
   *
   * O Helius envia um array JSON de EnhancedTransaction. Cada item é
   * repassado ao SolanaIndexer para parse, filtragem e persistência.
   *
   * Endpoint: POST /indexer/helius/webhook
   */
  @Post('helius/webhook')
  async heliusWebhook(@Body() body: unknown[]): Promise<{ received: number }> {
    const payload = Array.isArray(body) ? body : []
    await this.indexerService.processHeliusWebhook(payload)
    return { received: payload.length }
  }
}
