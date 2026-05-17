# Model Definition Guide

Crudora uses an **inheritance pattern** combined with `@Field()` decorators to define models. Decorators drive Drizzle table auto-generation and multiple schema support.

## Basic Model

```typescript
import { Model, Field } from 'crudora';

class User extends Model {
  static schema    = 'auth';    // database schema (optional — PostgreSQL/MySQL)
  static tableName = 'users';
  static hidden    = ['password'];

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true, unique: true })
  email!: string;

  @Field({ type: 'string', required: true })
  password!: string;
}
```

At `registerModel(User)`, Crudora reads the `@Field()` metadata and builds:

```typescript
pgSchema('auth').table('users', {
  id:        uuid('id').primaryKey(),
  email:     varchar('email', { length: 255 }).notNull().unique(),
  password:  varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
})
```

## Static Configuration Properties

### `tableName`

Database table name. Defaults to lowercase class name + `s`.

```typescript
class User extends Model {
  static tableName = 'users';
}
```

### `schema`

Database schema name for PostgreSQL `pgSchema()` or MySQL `mysqlSchema()`. Omit for the default schema.

```typescript
class AuditLog extends Model {
  static schema    = 'audit';    // → pgSchema('audit').table(...)
  static tableName = 'audit_logs';
}
```

### `primaryKey`

Primary key field name. Defaults to `'id'`.

```typescript
class Product extends Model {
  static primaryKey = 'productId';
}
```

### `timestamps`

Auto-adds `createdAt` and `updatedAt` columns. Defaults to `true`.

```typescript
class Session extends Model {
  static tableName  = 'sessions';
  static timestamps = false;
}
```

### `softDelete`

When `true`, `delete()` sets `deletedAt` instead of removing the row. All `findAll` and `findById` calls automatically exclude soft-deleted records. Defaults to `false`.

```typescript
class Post extends Model {
  static tableName  = 'posts';
  static softDelete = true;
}
```

Methods available when `softDelete = true`:
- `repo.delete(id)` — sets `deletedAt`
- `repo.restore(id)` — clears `deletedAt`
- `repo.hardDelete(id)` — permanently removes the row
- `repo.findAll({ withDeleted: true })` — includes soft-deleted records

### `fillable`

Fields allowed for mass-assignment. Also used by `ValidationGenerator` to build Zod schemas.

```typescript
class Post extends Model {
  static fillable = ['title', 'body', 'authorId'];
}
```

### `hidden`

Fields excluded from API responses. Crudora uses `getTableColumns()` from Drizzle to build a SELECT that omits these columns at query time.

```typescript
class User extends Model {
  static hidden = ['password', 'refreshToken'];
}
```

## `@Field()` Decorator Options

```typescript
interface FieldOptions {
  type:         FieldType;    // required
  primary?:     boolean;      // PRIMARY KEY
  required?:    boolean;      // NOT NULL (and required in Zod for POST/PUT)
  nullable?:    boolean;      // column is nullable (overrides required for DB constraint)
  unique?:      boolean;      // UNIQUE
  length?:      number;       // max length for 'string' / 'uuid' (default 255)
  precision?:   number;       // for 'decimal'
  scale?:       number;       // for 'decimal'
  default?:     any;          // column default value
  enumValues?:  string[];     // required when type is 'enum'
}
```

### Supported `FieldType` values

| `type` | PostgreSQL column | MySQL column | Notes |
|---|---|---|---|
| `'uuid'` | `uuid` | `varchar(36)` | |
| `'string'` | `varchar(length \|\| 255)` | `varchar(length \|\| 255)` | `length` sets max; Zod enforces |
| `'text'` | `text` | `text` | Unbounded string |
| `'integer'` | `integer` | `int` | |
| `'number'` | `doublePrecision` | `double` | |
| `'boolean'` | `boolean` | `boolean` | |
| `'date'` | `timestamp` | `datetime` | |
| `'decimal'` | `decimal(p, s)` | `decimal(p, s)` | Use `precision` + `scale` |
| `'json'` | `json` | `json` | |
| `'bigint'` | `bigint` | `bigint` | Zod validates as integer |
| `'serial'` | `serial` | `serial` | Auto-increment; skips `.notNull()` and `.default()` |
| `'enum'` | `text` + Zod enum | `mysqlEnum(values)` | Requires `enumValues: [...]`; PG enforces at API layer |
| `'array'` | `text[]` | — | PostgreSQL only; MySQL throws at build time |

### `nullable` vs `required`

- `required: true` → column is `NOT NULL` in DB + required in Zod validation
- `nullable: true` → column can be `NULL` in DB; Zod accepts `null`; takes precedence over `required` for the DB constraint
- Both can coexist: `required: true, nullable: true` → Zod marks field as required (must be present in request body) but allows the value `null`

### Enum example

```typescript
class Post extends Model {
  static tableName = 'posts';
  static fillable  = ['title', 'status'];

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true })
  title!: string;

  @Field({ type: 'enum', required: true, enumValues: ['draft', 'published', 'archived'] })
  status!: 'draft' | 'published' | 'archived';
}
```

### Serial (auto-increment) example

```typescript
class Counter extends Model {
  static tableName  = 'counters';
  static timestamps = false;

  @Field({ type: 'serial', primary: true })
  id!: number;

  @Field({ type: 'string', required: true })
  name!: string;
}
```

## Multiple Schema Example

```typescript
// Users in 'auth' schema
class User extends Model {
  static schema    = 'auth';
  static tableName = 'users';
  static hidden    = ['password'];

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true, unique: true })
  email!: string;

  @Field({ type: 'string', required: true })
  password!: string;
}

// Posts in 'content' schema
class Post extends Model {
  static schema    = 'content';
  static tableName = 'posts';

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true, length: 300 })
  title!: string;

  @Field({ type: 'text' })
  body!: string;

  @Field({ type: 'boolean', default: false })
  published!: boolean;
}

// Audit logs in 'audit' schema, no timestamps
class AuditLog extends Model {
  static schema     = 'audit';
  static tableName  = 'logs';
  static timestamps = false;

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true })
  action!: string;

  @Field({ type: 'json' })
  payload!: object;

  @Field({ type: 'date', required: true })
  occurredAt!: Date;
}

// All three models, different schemas
server.registerModel(User, Post, AuditLog);
```

## Lifecycle Hooks

Override static methods on the Model class to intercept CRUD operations.

| Hook | Signature | Called by |
|---|---|---|
| `beforeCreate` | `(data) => data` | `create()` |
| `afterCreate` | `(data, result) => result` | `create()` |
| `afterCreateMany` | `(records) => records` | `createMany()` |
| `beforeUpdate` | `(id, data) => data` | `update()` |
| `afterUpdate` | `(id, data, result) => result` | `update()` |
| `beforeDelete` | `(id) => void` | `delete()`, `hardDelete()` |
| `afterDelete` | `(id, result) => result` | `delete()`, `hardDelete()` |
| `beforeFind` | `(options) => options` | `findAll()`, `findById()` |
| `afterFind` | `(results: any[]) => any[]` | `findAll()`, `findById()`, `findOne()` |

> **Note:** `afterCreateMany` is the batch-aware alternative to `afterCreate`. When using `createMany()`, `beforeCreate` and `afterCreate` are **not** called per-item — only `afterCreateMany` is called once with the complete result array. This avoids N hook calls on large inserts.

```typescript
class User extends Model {
  static tableName = 'users';
  static hidden    = ['password'];

  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'string', required: true }) email!: string;
  @Field({ type: 'string', required: true }) password!: string;

  static async beforeCreate(data: any) {
    data.password = await hashPassword(data.password);
    return data;
  }

  static async afterCreate(_data: any, result: any) {
    await sendWelcomeEmail(result.email);
    return result;
  }

  static async afterCreateMany(records: any[]) {
    await Promise.all(records.map(r => sendWelcomeEmail(r.email)));
    return records;
  }

  static async beforeUpdate(_id: string, data: any) {
    return data;
  }

  static async afterUpdate(id: string, _data: any, result: any) {
    await auditLog('update', id);
    return result;
  }

  static async beforeDelete(id: string) {
    await archiveUserData(id);
  }

  static async afterDelete(id: string, result: any) {
    await auditLog('delete', id);
    return result;
  }

  static async beforeFind(options: any) {
    return { ...options, where: { ...options?.where, deletedAt: null } };
  }

  static async afterFind(results: any[]) {
    return results.map(u => ({ ...u, displayName: u.email.split('@')[0] }));
  }
}
```

## Schema Generation

Generate a ready-to-use Drizzle TypeScript schema file from all registered models:

```typescript
const schema = server.getCrudora().generateDrizzleSchema();
console.log(schema);
// Save to src/db/schema.ts, then run: npx drizzle-kit push
```

Or via CLI:

```bash
npx crudora generate-schema
```

Example output for User + Post above:

```typescript
// Auto-generated by Crudora
import { pgTable, pgSchema, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

const authSchema    = pgSchema('auth');
const contentSchema = pgSchema('content');

export const usersTable = authSchema.table('users', {
  id:        uuid('id').primaryKey(),
  email:     varchar('email', { length: 255 }).notNull().unique(),
  password:  varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const postsTable = contentSchema.table('posts', {
  id:        uuid('id').primaryKey(),
  title:     varchar('title', { length: 300 }).notNull(),
  body:      text('body'),
  published: boolean('published').default(false),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});
```

## Best Practices

1. **Always set `tableName`** explicitly — don't rely on auto-pluralization
2. **Use `@Field()` decorators** for every column — this is how Crudora builds the Drizzle table
3. **Set `hidden`** for any sensitive column (`password`, tokens, internal flags)
4. **Put business logic in lifecycle hooks**, not in routes
5. **Use `static schema`** to organize tables across PostgreSQL/MySQL schemas
6. **Keep `fillable`** in sync with your `@Field()` columns for Zod validation to cover the right fields
7. **Use `nullable: true`** for optional columns that can legitimately hold `null` in the database
8. **Prefer `softDelete`** over hard-delete for any data that may need recovery or audit trails
