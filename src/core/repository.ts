import { PrismaClient } from '@prisma/client';
import { getModelMetadata } from '../decorators/model';
import { Model, ModelConstructor } from './model';

export class Repository<T extends Model> {
  private prisma: PrismaClient;
  private modelName: string;
  private modelClass: ModelConstructor<T>;

  constructor(modelClass: ModelConstructor<T>, prisma: PrismaClient) {
    this.prisma = prisma;
    this.modelClass = modelClass;
    
    // Try to get metadata from decorator first, then fallback to static methods
    const metadata = getModelMetadata(modelClass as any);
    this.modelName = metadata?.tableName || modelClass.getTableName();
  }

  async create(data: Partial<T>): Promise<T> {
    const model = (this.prisma as any)[this.modelName];
    return await model.create({ data });
  }

  async findById(id: string): Promise<T | null> {
    const model = (this.prisma as any)[this.modelName];
    return await model.findUnique({ where: { id } });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
  }): Promise<T[]> {
    const model = (this.prisma as any)[this.modelName];
    return await model.findMany(options);
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const model = (this.prisma as any)[this.modelName];
    return await model.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<T> {
    const model = (this.prisma as any)[this.modelName];
    return await model.delete({ where: { id } });
  }

  async count(where?: any): Promise<number> {
    const model = (this.prisma as any)[this.modelName];
    return await model.count({ where });
  }
}
