import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common'
import { WalletsService } from './wallets.service'
import { CreateWalletDto } from './dto/create-wallet.dto'
import { UpdateWalletDto } from './dto/update-wallet.dto'

@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  findAll(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.walletsService.findAll(limit, offset)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.walletsService.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateWalletDto) {
    return this.walletsService.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWalletDto) {
    return this.walletsService.update(id, dto)
  }
}
