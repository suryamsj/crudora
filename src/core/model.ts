export abstract class Model {
  static tableName?: string;
  static primaryKey?: string = 'id';
  static timestamps?: boolean = true;
  static fillable?: string[];
  static hidden?: string[];

  static getTableName(): string {
    return this.tableName || this.name.toLowerCase() + 's';
  }

  static getPrimaryKey(): string {
    return this.primaryKey || 'id';
  }
}

// Type helper untuk model constructor
export type ModelConstructor<T extends Model = Model> = {
  new (): T;
  tableName?: string;
  primaryKey?: string;
  timestamps?: boolean;
  fillable?: string[];
  hidden?: string[];
  getTableName(): string;
  getPrimaryKey(): string;
} & typeof Model;
