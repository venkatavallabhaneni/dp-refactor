// src/application/strategies/v1/data-product.strategy.v1.ts
import { Injectable } from '@nestjs/common';

import { DataProductDto } from '../dto/dataproduct.dto';
import { BusinessCreateHandler } from '../handlers/create/businesslogic.handler';

import { ValidateCreateHandler } from '../handlers/create/validation.handler';
import { AuditCreateHandler } from '../handlers/create/audit.handler';
import { AuditUpdateHandler } from '../handlers/update/audit.handler';
import { BusinessUpdateHandler } from '../handlers/update/businesslogic.handler';
import { ValidateUpdateHandler } from '../handlers/update/validation.handler';
import { DataProductStrategy } from './dataproduct.strategy';
import { MessageUpdateHandler } from '../handlers/update/message.handler';

@Injectable()
export class DataProductStrategyV1 extends DataProductStrategy {
    constructor(
        private readonly validateCreate: ValidateCreateHandler,
        private readonly businessCreate: BusinessCreateHandler,
        private readonly auditCreate: AuditCreateHandler,

        private readonly validateUpdate: ValidateUpdateHandler,
        private readonly businessUpdate: BusinessUpdateHandler,
        private readonly auditUpdate: AuditUpdateHandler,
        private readonly messageUpdate: MessageUpdateHandler,

    ) {
        super();
    }

    async create(dto: DataProductDto) {
        this.validateCreate.setNext(this.businessCreate).setNext(this.auditCreate);
        await this.validateCreate.handle(dto);
        return dto;
    }

    async update(id: string, dto: DataProductDto) {
        dto.id = id;
        this.validateUpdate
            .setNext(this.businessUpdate)
            .setNext(this.auditUpdate)
            .setNext(this.messageUpdate);
        await this.validateUpdate.handle(dto);
        return dto;
    }


}