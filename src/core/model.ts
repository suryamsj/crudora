/**
 * Base class for all Crudora models. Extend this to define your table schema,
 * configure lifecycle hooks, and control API behaviour via static properties.
 *
 * Use `@Field()` decorators on instance properties to describe columns.
 * Use `@HasMany()`, `@HasOne()`, `@BelongsTo()`, `@BelongsToMany()` for relations.
 *
 * This is a plain class — **not** a decorator. Extend it:
 * ```ts
 * class User extends Model {
 *   static tableName = 'users';
 * }
 * ```
 */
export abstract class Model {
  static tableName?: string;
  static primaryKey?: string = 'id';
  static timestamps?: boolean = true;
  static softDelete?: boolean = false;
  static fillable?: string[];
  static hidden?: string[];
  static schema?: string;

  static getTableName(): string {
    return this.tableName || this.name.toLowerCase() + 's';
  }

  static getPrimaryKey(): string {
    return this.primaryKey || 'id';
  }

  // Lifecycle Hooks
  static async beforeCreate?(_data: any): Promise<any> {
    return _data;
  }

  static async afterCreate?(_data: any, result: any): Promise<any> {
    return result;
  }

  static async afterCreateMany?(_records: any[]): Promise<any[]> {
    return _records;
  }

  static async beforeUpdate?(_id: string, _data: any): Promise<any> {
    return _data;
  }

  static async afterUpdate?(_id: string, _data: any, result: any): Promise<any> {
    return result;
  }

  static async beforeDelete?(_id: string): Promise<void> {
    // Default implementation - do nothing
  }

  static async afterDelete?(_id: string, result: any): Promise<any> {
    return result;
  }

  static async beforeFind?(options?: any): Promise<any> {
    return options;
  }

  static async afterFind?(results: any[]): Promise<any[]> {
    return results;
  }

  async beforeSave?(): Promise<void> {
    // Default implementation - do nothing
  }

  async afterSave?(): Promise<void> {
    // Default implementation - do nothing
  }
}

export type ModelConstructor<T extends Model = Model> = {
  new (): T;
  tableName?: string;
  primaryKey?: string;
  timestamps?: boolean;
  softDelete?: boolean;
  fillable?: string[];
  hidden?: string[];
  schema?: string;
  getTableName(): string;
  getPrimaryKey(): string;

  beforeCreate?(data: any): Promise<any>;
  afterCreate?(data: any, result: any): Promise<any>;
  afterCreateMany?(records: any[]): Promise<any[]>;
  beforeUpdate?(id: string, data: any): Promise<any>;
  afterUpdate?(id: string, data: any, result: any): Promise<any>;
  beforeDelete?(id: string): Promise<void>;
  afterDelete?(id: string, result: any): Promise<any>;
  beforeFind?(options?: any): Promise<any>;
  afterFind?(results: any[]): Promise<any[]>;
} & typeof Model;
