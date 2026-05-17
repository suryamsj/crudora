import { z } from 'zod';
import { Model, ModelConstructor } from '../core/model';
import { getFieldMetadata } from '../decorators/model';
import { FieldOptions, FieldType } from '../types/model.type';

function zodTypeFor(opts: FieldOptions, forStrict: boolean): z.ZodTypeAny {
  const { type, required = false, nullable = false, length } = opts;
  let base: z.ZodTypeAny;
  switch (type) {
    case 'integer':
      base = z.number().int();
      break;
    case 'number':
      base = z.number();
      break;
    case 'boolean':
      base = z.boolean();
      break;
    case 'date':
      base = z.coerce.date();
      break;
    case 'decimal':
      base = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal number');
      break;
    case 'json':
      base = z.union([z.record(z.string(), z.any()), z.array(z.any())]);
      break;
    case 'uuid':
      base = z.uuid();
      break;
    case 'enum':
      base = opts.enumValues?.length
        ? z.enum(opts.enumValues as [string, ...string[]])
        : z.string();
      break;
    case 'bigint':
      base = z.number().int();
      break;
    case 'serial':
      base = z.number().int().positive();
      break;
    case 'array':
      base = z.array(z.string());
      break;
    case 'string':
      base = length ? z.string().max(length) : z.string();
      break;
    case 'text':
    default:
      base = z.string();
  }

  if (nullable) base = (base as any).nullable();

  // In strict mode, only required fields stay required; others become optional.
  // In partial mode, everything is optional.
  if (forStrict) {
    return required ? base : base.optional();
  }
  return base.optional();
}

const SYSTEM_FIELDS = new Set(['createdAt', 'updatedAt', 'deletedAt']);

function resolveFields(modelClass: ModelConstructor): Array<{ name: string; opts: FieldOptions }> {
  const fieldMeta = getFieldMetadata(modelClass) as Record<string, FieldOptions>;
  const hasMeta = Object.keys(fieldMeta).length > 0;
  const fillable = modelClass.fillable;

  if (hasMeta) {
    // Exclude primary-key and system-managed fields — users must never write these directly
    let entries = Object.entries(fieldMeta).filter(
      ([name, opts]) => !opts.primary && !SYSTEM_FIELDS.has(name),
    );

    // When fillable is defined, restrict validation to only those fields.
    // A field not in fillable (e.g. password set via beforeCreate hook) must not
    // be required from the request body even if it has required: true in @Field().
    if (fillable?.length) {
      entries = entries.filter(([name]) => fillable.includes(name));
    }

    return entries.map(([name, opts]) => ({ name, opts }));
  }

  // Fallback: fillable defined but no @Field() decorators (e.g. registerTable() without decorators).
  // Column types are unknown — treat all as optional strings and let the DB enforce constraints.
  return (fillable ?? []).map((name) => ({
    name,
    opts: { type: 'string' as FieldType, required: false },
  }));
}

export class ValidationGenerator {
  static generateZodSchema<T extends Model>(modelClass: ModelConstructor<T>): z.ZodType<Partial<T>> {
    const fields = resolveFields(modelClass);
    if (fields.length === 0) return z.object({}).partial() as any;

    const shape: Record<string, z.ZodTypeAny> = {};
    for (const { name, opts } of fields) {
      shape[name] = zodTypeFor(opts, false);
    }
    return z.object(shape) as any;
  }

  static generateStrictZodSchema<T extends Model>(modelClass: ModelConstructor<T>): z.ZodType<any> {
    const fields = resolveFields(modelClass);
    if (fields.length === 0) return z.object({}) as any;

    const shape: Record<string, z.ZodTypeAny> = {};
    for (const { name, opts } of fields) {
      shape[name] = zodTypeFor(opts, true);
    }
    return z.object(shape) as any;
  }
}
