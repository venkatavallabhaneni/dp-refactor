// src/application/application.module.ts
import { Module } from '@nestjs/common';
import { DataProductStrategyFactory } from './application/factories/dataproduct.strategy.factory';
import { DataProductStrategyV1 } from './application/startegies/dataproduct.strategy.v1';

@Module({
  providers: [
    { provide: 'V1_STRATEGY', useClass: DataProductStrategyV1 },
    {
      provide: DataProductStrategyFactory,
      useFactory: (v1: DataProductStrategyV1) => new DataProductStrategyFactory(v1),
      inject: ['V1_STRATEGY'],
    },
  ],
  exports: [DataProductStrategyFactory],
})
export class ApplicationModule { }