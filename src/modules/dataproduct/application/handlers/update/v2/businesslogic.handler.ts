
import { Injectable } from '@nestjs/common';
import { DataProductDto } from '../../../dto/dataproduct.dto';
import { Handler } from '../../commons/base.handler';
import { DataProductRepository } from 'src/modules/dataproduct/domain/repositories/dataproduct.repository';
@Injectable()
export class BusinessUpdateHandlerV2 extends Handler<DataProductDto> {
    constructor(private readonly repo: DataProductRepository) {
        super();
    }

    protected async process(dto: DataProductDto) {
        const updated = await this.repo.update(dto.id, dto);
        return super.handle(updated);
    }
}

