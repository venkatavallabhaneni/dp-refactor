
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { DataProductDto } from '../../application/dto/dataproduct.dto';
import { DataProductStrategyFactory } from '../../application/factories/dataproduct.strategy.factory';

@Controller('data-products')
export class DataProductController {
  constructor(private readonly strategyFactory: DataProductStrategyFactory) { }

  @Post()
  create(@Body() dto: DataProductDto, @Query('version') v = 'v1') {
    return this.strategyFactory.getStrategy(v).create(dto);
  }
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: DataProductDto, @Query('version') v = 'v1') {
    return this.strategyFactory.getStrategy(v).update(id, dto);
  }

}