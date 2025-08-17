import { DataProductDto } from "../dto/dataproduct.dto";

export abstract class DataProductStrategy {
    abstract create(dto: DataProductDto): Promise<DataProductDto>;
    abstract update(id: string, dto: DataProductDto): Promise<DataProductDto>;

}