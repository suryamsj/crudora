import { z } from 'zod';
import { getFieldMetadata } from '../decorators/model';
import { FieldOptions } from '../types/model.type';

export class ValidationGenerator {
  static generateZodSchema<T>(modelClass: new () => T): z.ZodType<Partial<T>> {
    const fieldMetadata = getFieldMetadata(modelClass);
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    // If no field metadata, return empty partial schema
    if (Object.keys(fieldMetadata).length === 0) {
      return z.object({}).partial() as z.ZodType<Partial<T>>;
    }

    for (const [fieldName, options] of Object.entries(fieldMetadata) as [string, FieldOptions][]) {
      schemaFields[fieldName] = this.createZodField(options);
    }

    return z.object(schemaFields).partial() as z.ZodType<Partial<T>>;
  }

  static generateStrictZodSchema<T>(modelClass: new () => T): z.ZodType<T> {
    const fieldMetadata = getFieldMetadata(modelClass);
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    // If no field metadata, return empty schema
    if (Object.keys(fieldMetadata).length === 0) {
      return z.object({}) as z.ZodType<T>;
    }

    for (const [fieldName, options] of Object.entries(fieldMetadata) as [string, FieldOptions][]) {
      // For strict schema, skip primary key fields that are auto-generated
      if (options.primary && options.type === 'uuid') {
        continue;
      }
      schemaFields[fieldName] = this.createZodField(options);
    }

    return z.object(schemaFields) as z.ZodType<T>;
  }

  private static createZodField(options: FieldOptions): z.ZodTypeAny {
    let field: z.ZodTypeAny;

    switch (options.type) {
      case 'string':
        field = z.string();
        if (options.length) {
          field = (field as z.ZodString).max(options.length);
        }
        break;
      case 'number':
        field = z.number();
        break;
      case 'boolean':
        field = z.boolean();
        break;
      case 'date':
        field = z.date();
        break;
      case 'uuid':
        field = z.string().uuid();
        break;
      default:
        field = z.string();
    }

    // If required is explicitly false, make field optional
    if (options.required === false) {
      field = field.optional();
    }

    return field;
  }
}
