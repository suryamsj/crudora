import { z } from 'zod';
import { Model, ModelConstructor } from '../core/model';

export class ValidationGenerator {
  static generateZodSchema<T extends Model>(modelClass: ModelConstructor<T>): z.ZodType<Partial<T>> {
    // Simplified: gunakan static properties langsung dari model class
    const fillable = modelClass.fillable || [];
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    // Jika tidak ada fillable fields, return empty partial schema
    if (fillable.length === 0) {
      return z.object({}).partial() as any;
    }

    // Generate basic string validation untuk semua fillable fields
    fillable.forEach(fieldName => {
      schemaFields[fieldName] = z.string().optional();
    });

    return z.object(schemaFields).partial() as any;
  }

  static generateStrictZodSchema<T extends Model>(modelClass: ModelConstructor<T>): z.ZodType<any> {
    const fillable = modelClass.fillable || [];
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    // Jika tidak ada fillable fields, return empty schema
    if (fillable.length === 0) {
      return z.object({}) as any;
    }

    // Generate basic string validation untuk semua fillable fields
    fillable.forEach(fieldName => {
      schemaFields[fieldName] = z.string();
    });

    return z.object(schemaFields) as any;
  }
}
