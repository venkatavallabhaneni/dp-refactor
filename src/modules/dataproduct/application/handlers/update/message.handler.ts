import { DataProductDto } from "../../dto/dataproduct.dto";
import { Handler } from "../commons/base.handler";
import { Injectable } from '@nestjs/common';

export class MessageUpdateHandler extends Handler<DataProductDto> {
    protected async process(request: DataProductDto): Promise<void> {
        // Skeleton only
        console.log('Message published:', request);
    }
}