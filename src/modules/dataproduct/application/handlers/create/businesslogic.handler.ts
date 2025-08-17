import { DataProductDto } from "../../dto/dataproduct.dto";
import { Handler } from "../commons/base.handler";
import { Injectable } from '@nestjs/common';
@Injectable()
export class BusinessCreateHandler extends Handler<DataProductDto> {
    protected async process(request: DataProductDto): Promise<void> {
        // Business logic goes here
    }
}

