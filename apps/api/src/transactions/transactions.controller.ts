import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { TransactionsService } from './transactions.service'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { ListTransactionsDto } from './dto/list-transactions.dto'

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll(@Query() query: ListTransactionsDto) {
    return this.transactionsService.findAll(query.wallet_id, query.limit, query.offset)
  }

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto)
  }
}
