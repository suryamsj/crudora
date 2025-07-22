import { PrismaClient } from '@prisma/client';
import { Model, ModelConstructor } from './model';

export class Repository<T extends Model> {
  private prisma: PrismaClient;
  private modelName: string;
  private modelClass: ModelConstructor<T>;

  constructor(modelClass: ModelConstructor<T>, prisma: PrismaClient) {
    this.prisma = prisma;
    this.modelClass = modelClass;
    this.modelName = modelClass.getTableName();
  }

  private getSelectOptions() {
    // Pass prisma client untuk akses DMMF
    return this.modelClass.getSelectObject(this.prisma);
  }

  private filterHiddenFields(data: any): any {
    // Fallback manual filtering jika select tidak bisa digunakan
    if (!this.modelClass.hidden || this.modelClass.hidden.length === 0) {
      return data;
    }

    const filterObject = (obj: any) => {
      if (!obj) return obj;
      const filtered = { ...obj };
      this.modelClass.hidden!.forEach(field => {
        delete filtered[field];
      });
      return filtered;
    };

    if (Array.isArray(data)) {
      return data.map(filterObject);
    }

    return filterObject(data);
  }

  async create(data: Partial<T>): Promise<T> {
    const model = (this.prisma as any)[this.modelName];
    const select = this.getSelectOptions();

    // Execute beforeCreate hook
    let processedData = data;
    if (this.modelClass.beforeCreate) {
      processedData = await this.modelClass.beforeCreate(data);
    }

    let result;
    if (select) {
      result = await model.create({ data: processedData, select });
    } else {
      result = await model.create({ data: processedData });
      result = this.filterHiddenFields(result);
    }

    // Execute afterCreate hook
    if (this.modelClass.afterCreate) {
      result = await this.modelClass.afterCreate(processedData, result);
    }

    return result;
  }

  async findById(id: string): Promise<T | null> {
    const model = (this.prisma as any)[this.modelName];
    const select = this.getSelectOptions();

    // Execute beforeFind hook
    let findOptions = { where: { id } };
    if (this.modelClass.beforeFind) {
      findOptions = await this.modelClass.beforeFind(findOptions);
    }

    let result;
    if (select) {
      result = await model.findUnique({ ...findOptions, select });
    } else {
      result = await model.findUnique(findOptions);
      result = result ? this.filterHiddenFields(result) : null;
    }

    // Execute afterFind hook
    if (result && this.modelClass.afterFind) {
      result = await this.modelClass.afterFind(result);
    }

    return result;
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
  }): Promise<T[]> {
    const model = (this.prisma as any)[this.modelName];
    const select = this.getSelectOptions();

    // Execute beforeFind hook
    let queryOptions = options ? { ...options } : undefined;
    if (this.modelClass.beforeFind) {
      queryOptions = await this.modelClass.beforeFind(queryOptions);
    }

    let results;
    if (select) {
      const finalOptions = queryOptions ? { ...queryOptions, select } : { select };
      results = await model.findMany(finalOptions);
    } else {
      results = await model.findMany(queryOptions);
      results = this.filterHiddenFields(results);
    }

    // Execute afterFind hook
    if (results && this.modelClass.afterFind) {
      results = await this.modelClass.afterFind(results);
    }

    return results;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const model = (this.prisma as any)[this.modelName];
    const select = this.getSelectOptions();

    // Execute beforeUpdate hook
    let processedData = data;
    if (this.modelClass.beforeUpdate) {
      processedData = await this.modelClass.beforeUpdate(id, data);
    }

    let result;
    if (select) {
      result = await model.update({
        where: { id },
        data: processedData,
        select
      });
    } else {
      result = await model.update({
        where: { id },
        data: processedData
      });
      result = this.filterHiddenFields(result);
    }

    // Execute afterUpdate hook
    if (this.modelClass.afterUpdate) {
      result = await this.modelClass.afterUpdate(id, processedData, result);
    }

    return result;
  }

  async delete(id: string): Promise<T> {
    const model = (this.prisma as any)[this.modelName];

    // Execute beforeDelete hook
    if (this.modelClass.beforeDelete) {
      await this.modelClass.beforeDelete(id);
    }

    const result = await model.delete({ where: { id } });

    // Execute afterDelete hook
    let finalResult = result;
    if (this.modelClass.afterDelete) {
      finalResult = await this.modelClass.afterDelete(id, result);
    }

    return finalResult;
  }

  async count(where?: any): Promise<number> {
    const model = (this.prisma as any)[this.modelName];
    return await model.count({ where });
  }
}
