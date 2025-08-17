import { Injectable } from '@nestjs/common';
import { DataProductDto } from "../../dto/dataproduct.dto";
import { Handler } from "../commons/base.handler";

@Injectable()
export class ValidateUpdateHandler extends Handler<DataProductDto> {
    protected async process(request: DataProductDto): Promise<void> {
        if (!request.name || !request.infoport) {
            throw new Error('Validation failed');
        }
    }
}
