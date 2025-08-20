// src/application/factories/data-product.factory.ts
import { Injectable } from '@nestjs/common';
import { DataProductStrategy } from '../startegies/dataproduct.strategy';
import { DataProductStrategyV2 } from '../startegies/dataproduct.strategy.v2';
import { DataProductStrategyV1 } from '../startegies/dataproduct.strategy.v1';

@Injectable()
export class DataProductStrategyFactory {
  constructor(
    private readonly v1: DataProductStrategyV1,
    private readonly v2: DataProductStrategyV2
  ) { }
  getStrategy(version: string): DataProductStrategy {
    if (version === 'v1') return this.v1;
    if (version === 'v2') return this.v2;
    throw new Error(`Unsupported API version: ${version}`);
  }
}