// src/application/application.module.ts
import { Module } from '@nestjs/common';
import { DataProductController } from '../api/controllers/data-product.controller';
import { DataProductStrategyFactory } from './factories/data-product.factory';
import { DataProductStrategyV1 } from './strategies/v1/data-product.strategy.v1';
import * as CreateHandlers from './handlers/create';
import * as UpdateHandlers from './handlers/update';


@Module({
  controllers: [DataProductController],
  providers: [

    ...Object.values(CreateHandlers),
    ...Object.values(UpdateHandlers),

    DataProductStrategyV1,

    DataProductStrategyFactory,
  ],
})
export class ApplicationModule { }