import { getFieldMetadata } from '../decorators/model';
import { Dialect, FieldOptions, FieldType } from '../types/model.type';
import { ModelConstructor } from './model';

/** Escape single-quotes and backslashes so the string is safe inside a JS single-quoted literal. */
function safe(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function pgColumnDef(name: string, opts: FieldOptions): string {
  const type: FieldType = opts.type;
  let col: string;

  const n = safe(name);
  switch (type) {
    case 'uuid':
      col = `uuid('${n}')`;
      break;
    case 'text':
      col = `text('${n}')`;
      break;
    case 'integer':
      col = `integer('${n}')`;
      break;
    case 'number':
      col = `doublePrecision('${n}')`;
      break;
    case 'boolean':
      col = `boolean('${n}')`;
      break;
    case 'date':
      col = `timestamp('${n}', { mode: 'date' })`;
      break;
    case 'decimal':
      col = `decimal('${n}', { precision: ${opts.precision ?? 10}, scale: ${opts.scale ?? 2} })`;
      break;
    case 'json':
      col = `json('${n}')`;
      break;
    case 'enum':
      col = `text('${n}')`;
      break;
    case 'bigint':
      col = `bigint('${n}', { mode: 'number' })`;
      break;
    case 'serial':
      col = `serial('${n}')`;
      break;
    case 'array':
      col = `text('${n}').array()`;
      break;
    case 'string':
    default:
      col = `varchar('${n}', { length: ${opts.length ?? 255} })`;
  }

  if (opts.primary) col += '.primaryKey()';
  if (opts.required && !opts.nullable && opts.type !== 'serial') col += '.notNull()';
  if (opts.unique) col += '.unique()';
  if (opts.default !== undefined && opts.type !== 'serial') col += `.default(${JSON.stringify(opts.default)})`;

  return col;
}

function mysqlColumnDef(name: string, opts: FieldOptions): string {
  const type: FieldType = opts.type;
  let col: string;

  const n = safe(name);
  switch (type) {
    case 'uuid':
      col = `varchar('${n}', { length: 36 })`;
      break;
    case 'text':
      col = `text('${n}')`;
      break;
    case 'integer':
      col = `int('${n}')`;
      break;
    case 'number':
      col = `double('${n}')`;
      break;
    case 'boolean':
      col = `boolean('${n}')`;
      break;
    case 'date':
      col = `datetime('${n}', { mode: 'date' })`;
      break;
    case 'decimal':
      col = `decimal('${n}', { precision: ${opts.precision ?? 10}, scale: ${opts.scale ?? 2} })`;
      break;
    case 'json':
      col = `json('${n}')`;
      break;
    case 'enum':
      col = `mysqlEnum('${n}', [${(opts.enumValues ?? []).map((v) => `'${safe(v)}'`).join(', ')}])`;
      break;
    case 'bigint':
      col = `bigint('${n}', { mode: 'number' })`;
      break;
    case 'serial':
      col = `int('${n}').autoincrement()`;
      break;
    case 'array':
      col = `json('${n}')`;
      break;
    case 'string':
    default:
      col = `varchar('${n}', { length: ${opts.length ?? 255} })`;
  }

  if (opts.primary) col += '.primaryKey()';
  if (opts.required && !opts.nullable && opts.type !== 'serial') col += '.notNull()';
  if (opts.unique) col += '.unique()';
  if (opts.default !== undefined && opts.type !== 'serial') col += `.default(${JSON.stringify(opts.default)})`;

  return col;
}

function generateModelBlock(
  modelClass: ModelConstructor,
  dialect: Dialect,
  schemaVars: Map<string, string>,
): string {
  const fields = getFieldMetadata(modelClass) as Record<string, FieldOptions>;
  const tableName = modelClass.getTableName();
  const schemaName = (modelClass as any).schema as string | undefined;
  const exportName = modelClass.name.charAt(0).toLowerCase() + modelClass.name.slice(1) + 'Table';
  const columnDef = dialect === 'postgresql' ? pgColumnDef : mysqlColumnDef;

  const cols: string[] = [];
  for (const [fieldName, opts] of Object.entries(fields)) {
    cols.push(`  ${fieldName}: ${columnDef(fieldName, opts)},`);
  }

  if (modelClass.timestamps !== false) {
    if (dialect === 'postgresql') {
      cols.push(`  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),`);
      cols.push(`  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),`);
    } else {
      cols.push(`  createdAt: datetime('createdAt', { mode: 'date' }).notNull(),`);
      cols.push(`  updatedAt: datetime('updatedAt', { mode: 'date' }).notNull(),`);
    }
  }

  if (modelClass.softDelete) {
    if (dialect === 'postgresql') {
      cols.push(`  deletedAt: timestamp('deletedAt', { mode: 'date' }),`);
    } else {
      cols.push(`  deletedAt: datetime('deletedAt', { mode: 'date' }),`);
    }
  }

  let tableCall: string;
  if (schemaName) {
    const schemaVar = schemaVars.get(schemaName)!;
    tableCall = `${schemaVar}.table('${safe(tableName)}', {\n${cols.join('\n')}\n})`;
  } else {
    const tableFactory = dialect === 'postgresql' ? 'pgTable' : 'mysqlTable';
    tableCall = `${tableFactory}('${safe(tableName)}', {\n${cols.join('\n')}\n})`;
  }

  return `export const ${exportName} = ${tableCall};\n`;
}

export class SchemaGenerator {
  static generateDrizzleSchema(models: ModelConstructor[], dialect: Dialect): string {
    const schemaNames = new Set<string>();
    for (const m of models) {
      const s = (m as any).schema as string | undefined;
      if (s) schemaNames.add(s);
    }

    // Assign variable names for each schema
    const schemaVars = new Map<string, string>();
    for (const name of schemaNames) {
      schemaVars.set(name, name + 'Schema');
    }

    // Collect imports
    const coreImports = new Set<string>();
    const schemaFactory = dialect === 'postgresql' ? 'pgSchema' : 'mysqlSchema';
    const tableFactory = dialect === 'postgresql' ? 'pgTable' : 'mysqlTable';
    const pkg = dialect === 'postgresql' ? 'drizzle-orm/pg-core' : 'drizzle-orm/mysql-core';

    if (schemaNames.size > 0) coreImports.add(schemaFactory);

    // Check if any model uses default (no schema) tables
    const hasDefaultSchema = models.some((m) => !(m as any).schema);
    if (hasDefaultSchema) coreImports.add(tableFactory);

    // Collect column builder imports
    const colImports = new Set<string>();
    for (const modelClass of models) {
      const fields = getFieldMetadata(modelClass) as Record<string, FieldOptions>;
      for (const opts of Object.values(fields)) {
        colImports.add(getColumnImport(opts.type, dialect));
      }
      if (modelClass.timestamps !== false) {
        colImports.add(dialect === 'postgresql' ? 'timestamp' : 'datetime');
      }
    }

    const allImports = new Set([...coreImports, ...colImports]);
    let output = `// Auto-generated by Crudora — do not edit manually\n`;
    output += `import { ${[...allImports].sort().join(', ')} } from '${pkg}';\n\n`;

    // Schema variable declarations
    for (const [name, varName] of schemaVars) {
      output += `const ${varName} = ${schemaFactory}('${safe(name)}');\n`;
    }
    if (schemaVars.size > 0) output += '\n';

    // Model table blocks
    for (const modelClass of models) {
      output += generateModelBlock(modelClass, dialect, schemaVars) + '\n';
    }

    return output;
  }
}

function getColumnImport(type: FieldType, dialect: Dialect): string {
  if (dialect === 'postgresql') {
    const map: Record<FieldType, string> = {
      uuid: 'uuid',
      text: 'text',
      string: 'varchar',
      integer: 'integer',
      number: 'doublePrecision',
      boolean: 'boolean',
      date: 'timestamp',
      decimal: 'decimal',
      json: 'json',
      enum: 'text',
      bigint: 'bigint',
      serial: 'serial',
      array: 'text',
    };
    return map[type] ?? 'varchar';
  } else {
    const map: Record<FieldType, string> = {
      uuid: 'varchar',
      text: 'text',
      string: 'varchar',
      integer: 'int',
      number: 'double',
      boolean: 'boolean',
      date: 'datetime',
      decimal: 'decimal',
      json: 'json',
      enum: 'mysqlEnum',
      bigint: 'bigint',
      serial: 'int',
      array: 'json',
    };
    return map[type] ?? 'varchar';
  }
}
