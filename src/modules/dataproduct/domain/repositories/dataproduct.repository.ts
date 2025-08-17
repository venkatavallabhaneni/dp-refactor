// src/domain/repositories/data-product.repository.ts
import { Injectable } from '@nestjs/common';
import { DataProductDto } from '../../application/dto/dataproduct.dto';
import { DataProductMapper } from '../../mappers/dataproduct.mapper';


@Injectable()
export class DataProductRepository {
    async create(dto: DataProductDto): Promise<DataProductDto> {
        const entity = await DataProductModel.create(DataProductMapper.toEntity(dto));
        return DataProductMapper.toDto(entity);
    }

    async findById(id: string): Promise<DataProductDto | null> {
        const entity = await DataProductModel.findById(id).exec();
        return entity ? DataProductMapper.toDto(entity) : null;
    }

    async update(id: string, dto: DataProductDto): Promise<DataProductDto | null> {
        const entity = await DataProductModel.findByIdAndUpdate(
            id,
            DataProductMapper.toEntity(dto),
            { new: true }
        ).exec();
        return entity ? DataProductMapper.toDto(entity) : null;
    }

    async delete(id: string): Promise<void> {
        await DataProductModel.findByIdAndDelete(id).exec();
    }
}