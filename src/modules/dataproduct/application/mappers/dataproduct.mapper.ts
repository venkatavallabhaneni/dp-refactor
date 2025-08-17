
import { DataProduct } from '../../entities/dataproduct.entity';
import { DataProductDto } from '../dto/dataproduct.dto';

export class DataProductMapper {
    static toDomain(dto: DataProductDto): DataProduct {
        return new DataProduct(dto.id ?? '', dto.name, dto.infoport);
    }

    static toDto(entity: DataProduct): DataProductDto {
        return {
            id: entity.id,
            name: entity.name,
            infoport: entity.infoport,
        };
    }
}