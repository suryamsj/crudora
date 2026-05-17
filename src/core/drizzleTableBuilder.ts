import {
  pgTable,
  pgSchema,
  text,
  varchar,
  integer,
  doublePrecision,
  boolean,
  timestamp,
  decimal,
  json,
  uuid,
  bigint as pgBigint,
  serial as pgSerial,
} from 'drizzle-orm/pg-core';
import {
  mysqlTable,
  mysqlSchema,
  varchar as mysqlVarchar,
  int,
  double,
  boolean as mysqlBoolean,
  datetime,
  decimal as mysqlDecimal,
  json as mysqlJson,
  text as mysqlText,
  bigint as mysqlBigint,
  mysqlEnum,
} from 'drizzle-orm/mysql-core';
import { getFieldMetadata } from '../decorators/model';
import { Dialect, FieldOptions, FieldType } from '../types/model.type';
import { ModelConstructor } from './model';

function buildPgColumn(name: string, opts: FieldOptions): any {
  const type: FieldType = opts.type;

  let col: any;
  switch (type) {
    case 'uuid':
      col = uuid(name);
      break;
    case 'text':
      col = text(name);
      break;
    case 'integer':
      col = integer(name);
      break;
    case 'number':
      col = doublePrecision(name);
      break;
    case 'boolean':
      col = boolean(name);
      break;
    case 'date':
      col = timestamp(name, { mode: 'date' });
      break;
    case 'decimal':
      col = decimal(name, {
        precision: opts.precision ?? 10,
        scale: opts.scale ?? 2,
      });
      break;
    case 'json':
      col = json(name);
      break;
    case 'enum':
      // PostgreSQL: no native column-level enum without pgEnum (a named type).
      // Use text column — Zod validates allowed values at the API layer.
      col = text(name);
      break;
    case 'bigint':
      col = pgBigint(name, { mode: 'number' });
      break;
    case 'serial':
      col = pgSerial(name);
      break;
    case 'array':
      col = text(name).array();
      break;
    case 'string':
    default:
      col = varchar(name, { length: opts.length ?? 255 });
  }

  if (opts.primary) col = col.primaryKey();
  // serial columns are implicitly NOT NULL with a default — skip notNull()
  if (opts.required && !opts.nullable && opts.type !== 'serial') col = col.notNull();
  if (opts.unique) col = col.unique();
  if (opts.default !== undefined && opts.type !== 'serial') col = col.default(opts.default);

  return col;
}

function buildMysqlColumn(name: string, opts: FieldOptions): any {
  const type: FieldType = opts.type;

  let col: any;
  switch (type) {
    case 'uuid':
      col = mysqlVarchar(name, { length: 36 });
      break;
    case 'text':
      col = mysqlText(name);
      break;
    case 'integer':
      col = int(name);
      break;
    case 'number':
      col = double(name);
      break;
    case 'boolean':
      col = mysqlBoolean(name);
      break;
    case 'date':
      col = datetime(name, { mode: 'date' });
      break;
    case 'decimal':
      col = mysqlDecimal(name, {
        precision: opts.precision ?? 10,
        scale: opts.scale ?? 2,
      });
      break;
    case 'json':
      col = mysqlJson(name);
      break;
    case 'enum':
      if (!opts.enumValues?.length) {
        throw new Error(`Field "${name}" of type "enum" requires the enumValues option`);
      }
      col = mysqlEnum(name, opts.enumValues as [string, ...string[]]);
      break;
    case 'bigint':
      col = mysqlBigint(name, { mode: 'number' });
      break;
    case 'serial':
      col = int(name).autoincrement();
      break;
    case 'array':
      throw new Error(`Field type "array" is not supported in MySQL dialect. Use "json" instead.`);
    case 'string':
    default:
      col = mysqlVarchar(name, { length: opts.length ?? 255 });
  }

  if (opts.primary) col = col.primaryKey();
  if (opts.required && !opts.nullable && opts.type !== 'serial') col = col.notNull();
  if (opts.unique) col = col.unique();
  if (opts.default !== undefined && opts.type !== 'serial') col = col.default(opts.default);

  return col;
}

function buildPgColumns(fields: Record<string, FieldOptions>, modelClass: ModelConstructor): Record<string, any> {
  const cols: Record<string, any> = {};

  for (const [name, opts] of Object.entries(fields)) {
    cols[name] = buildPgColumn(name, opts);
  }

  if (modelClass.timestamps !== false) {
    cols.createdAt = timestamp('createdAt', { mode: 'date' }).defaultNow().notNull();
    cols.updatedAt = timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull();
  }

  if (modelClass.softDelete) {
    cols.deletedAt = timestamp('deletedAt', { mode: 'date' });
  }

  return cols;
}

function buildMysqlColumns(fields: Record<string, FieldOptions>, modelClass: ModelConstructor): Record<string, any> {
  const cols: Record<string, any> = {};

  for (const [name, opts] of Object.entries(fields)) {
    cols[name] = buildMysqlColumn(name, opts);
  }

  if (modelClass.timestamps !== false) {
    cols.createdAt = datetime('createdAt', { mode: 'date' }).notNull();
    cols.updatedAt = datetime('updatedAt', { mode: 'date' }).notNull();
  }

  if (modelClass.softDelete) {
    cols.deletedAt = datetime('deletedAt', { mode: 'date' });
  }

  return cols;
}

export class DrizzleTableBuilder {
  static build(modelClass: ModelConstructor, dialect: Dialect): any {
    const fields = getFieldMetadata(modelClass) as Record<string, FieldOptions>;
    const tableName = modelClass.getTableName();
    const schemaName = (modelClass as any).schema as string | undefined;

    if (dialect === 'postgresql') {
      const cols = buildPgColumns(fields, modelClass);
      return schemaName
        ? pgSchema(schemaName).table(tableName, cols)
        : pgTable(tableName, cols);
    }

    if (dialect === 'mysql') {
      const cols = buildMysqlColumns(fields, modelClass);
      return schemaName
        ? mysqlSchema(schemaName).table(tableName, cols)
        : mysqlTable(tableName, cols);
    }

    throw new Error(`Unsupported dialect: ${dialect}. Use 'postgresql' or 'mysql'.`);
  }
}
