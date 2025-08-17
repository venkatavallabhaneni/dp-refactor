// src/api/controllers/data-product.controller.ts
import { Controller, Post, Put, Delete, Get, Body, Param, Query } from '@nestjs/common';
import { DataProductService } from '../../application/services/dataproduct.service';
import { DataProductDto } from '../../application/dto/dataproduct.dto';

@Controller('api/:version/data-product')
export class DataProductController {
    constructor(private readonly service: DataProductService) { }

    @Post()
    async create(@Param('version') version: string, @Body() dto: DataProductDto) {
        return this.service.create(version, dto);
    }

    @Put(':id')
    async update(@Param('version') version: string, @Param('id') id: string, @Body() dto: DataProductDto) {
        return this.service.update(version, id, dto);
    }

    @Delete(':id')
    async delete(@Param('version') version: string, @Param('id') id: string) {
        return this.service.delete(version, id);
    }

    @Get(':id')
    async get(@Param('version') version: string, @Param('id') id: string) {
        return this.service.get(version, id);
    }
}