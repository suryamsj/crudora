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

  // Lifecycle Hooks - Static methods untuk class-level hooks
  static async beforeCreate?(data: any): Promise<any> {
    return data; // Default implementation - return data unchanged
  }

  static async afterCreate?(data: any, result: any): Promise<any> {
    return result; // Default implementation - return result unchanged
  }

  static async beforeUpdate?(id: string, data: any): Promise<any> {
    return data; // Default implementation - return data unchanged
  }

  static async afterUpdate?(id: string, data: any, result: any): Promise<any> {
    return result; // Default implementation - return result unchanged
  }

  static async beforeDelete?(id: string): Promise<void> {
    // Default implementation - do nothing
  }

  static async afterDelete?(id: string, result: any): Promise<any> {
    return result; // Default implementation - return result unchanged
  }

  static async beforeFind?(options?: any): Promise<any> {
    return options; // Default implementation - return options unchanged
  }

  static async afterFind?(result: any): Promise<any> {
    return result; // Default implementation - return result unchanged
  }

  // Instance-level hooks (untuk future enhancement)
  async beforeSave?(): Promise<void> {
    // Default implementation - do nothing
  }

  async afterSave?(): Promise<void> {
    // Default implementation - do nothing
  }

  // Method dinamis untuk generate select object
  static getSelectObject(prismaClient?: any): any {
    if (!this.hidden || this.hidden.length === 0) {
      return undefined; // Return all fields jika tidak ada hidden
    }

    // Jika ada fillable, gunakan itu sebagai whitelist
    if (this.fillable && this.fillable.length > 0) {
      const selectObject: any = {};

      // Include primary key jika tidak di-hidden
      const primaryKey = this.getPrimaryKey();
      if (!this.hidden.includes(primaryKey)) {
        selectObject[primaryKey] = true;
      }

      // Include fillable fields jika tidak di-hidden
      this.fillable.forEach(field => {
        if (!this.hidden?.includes(field)) {
          selectObject[field] = true;
        }
      });

      // Include timestamp fields jika timestamps enabled dan tidak di-hidden
      if (this.timestamps) {
        if (!this.hidden.includes('createdAt')) {
          selectObject.createdAt = true;
        }
        if (!this.hidden.includes('updatedAt')) {
          selectObject.updatedAt = true;
        }
      }

      return selectObject;
    }

    // Jika tidak ada fillable, gunakan approach exclude dengan Prisma DMMF
    if (prismaClient && prismaClient.dmmf) {
      try {
        const modelName = this.name;
        const modelDef = prismaClient.dmmf.datamodel.models.find(
          (model: any) => model.name === modelName
        );

        if (modelDef) {
          const selectObject: any = {};

          // Include semua field kecuali yang di-hidden
          modelDef.fields.forEach((field: any) => {
            if (!this.hidden!.includes(field.name)) {
              selectObject[field.name] = true;
            }
          });

          return selectObject;
        }
      } catch (error) {
        console.warn('Failed to use Prisma DMMF for dynamic field selection:', error);
      }
    }

    // Fallback: return undefined untuk select semua field
    // Lalu filter manual di level aplikasi jika diperlukan
    return undefined;
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

  // Lifecycle hooks
  beforeCreate?(data: any): Promise<any>;
  afterCreate?(data: any, result: any): Promise<any>;
  beforeUpdate?(id: string, data: any): Promise<any>;
  afterUpdate?(id: string, data: any, result: any): Promise<any>;
  beforeDelete?(id: string): Promise<void>;
  afterDelete?(id: string, result: any): Promise<any>;
  beforeFind?(options?: any): Promise<any>;
  afterFind?(result: any): Promise<any>;
} & typeof Model;
