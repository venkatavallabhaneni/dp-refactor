// src/application/strategies/v2/data-product.strategy.v2.ts
import { Injectable } from '@nestjs/common';

import { ValidateUpdateHandler, BusinessUpdateHandlerV2, AuditUpdateHandler, MessageUpdateHandler } from '../../handlers';
import { DataProductDto } from '../dto/dataproduct.dto';
import { DataProductStrategy } from './dataproduct.strategy';
import { DataProductStrategyV1 } from './dataproduct.strategy.v1';

@Injectable()
export class DataProductStrategyV2 implements DataProductStrategy {
    constructor(
        private readonly v1: DataProductStrategyV1,

        private readonly validateUpdate: ValidateUpdateHandler,
        private readonly businessUpdateV2: BusinessUpdateHandlerV2,
        private readonly auditUpdate: AuditUpdateHandler,
        private readonly messageUpdate: MessageUpdateHandler,
    ) { }

    async create(dto: DataProductDto) {
        return this.v1.create(dto);
    }

    async update(id: string, dto: DataProductDto) {
        dto.id = id;
        this.validateUpdate
            .setNext(this.businessUpdateV2)
            .setNext(this.auditUpdate)
            .setNext(this.messageUpdate);
        await this.validateUpdate.handle(dto);
        return dto;
    }


}