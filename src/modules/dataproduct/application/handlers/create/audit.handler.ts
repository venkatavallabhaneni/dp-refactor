import { DataProductDto } from "../../dto/dataproduct.dto";
import { Handler } from "../commons/base.handler";
import { Injectable } from '@nestjs/common';
@Injectable()
export class AuditCreateHandler extends Handler<DataProductDto> {
    protected async process(request: DataProductDto): Promise<void> {
        console.log('Audit log:', request);
    }
}
