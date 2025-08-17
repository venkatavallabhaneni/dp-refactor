// src/application/factories/data-product.factory.ts
import { Injectable } from '@nestjs/common';
import { DataProductStrategy } from '../startegies/dataproduct.strategy';

@Injectable()
export class DataProductStrategyFactory {
  constructor(
    private readonly v1: DataProductStrategy,
    private readonly v2: 
  ) { }
  getStrategy(version: string): DataProductStrategy {
    if (version === 'v1') return this.v1;
    throw new Error(`Unsupported API version: ${version}`);
  }
}