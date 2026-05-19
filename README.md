# Crudora

Automatic CRUD API generator for TypeScript with Drizzle ORM — build REST APIs in minutes, not hours.

[![npm version](https://badge.fury.io/js/crudora.svg)](https://badge.fury.io/js/crudora)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Zero Configuration** — generate CRUD APIs instantly from model classes
- **Drizzle ORM** — type-safe queries with Drizzle under the hood
- **Multiple Schema Support** — `pgSchema` / `mysqlSchema` per model via `static schema`
- **`@Field()` Decorators** — define columns with types, constraints, and Drizzle table auto-generation
- **Rich Field Types** — `uuid`, `string`, `text`, `integer`, `number`, `boolean`, `date`, `decimal`, `json`, `enum`, `bigint`, `serial`, `array`
- **Advanced Filtering** — equality, range (`_gt`, `_gte`, `_lt`, `_lte`), negation (`_ne`), LIKE (`_like`), and IN (`_in`) operators via query params
- **Offset & Cursor Pagination** — built-in offset pagination and efficient cursor-based pagination
- **Zod Validation** — automatic request validation with length limits and enum constraints
- **Soft Delete** — built-in soft-delete support with `restore()` and `hardDelete()`
- **Relations** — `@HasMany`, `@HasOne`, `@BelongsTo`, `@BelongsToMany` with batch loading
- **Transactions** — `repository.transaction()` and `crudora.transaction()`
- **Lifecycle Hooks** — `beforeCreate`, `afterCreate`, `afterCreateMany`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`, `beforeFind`, `afterFind`
- **Structured Logging** — pluggable `CrudoraLogger` with correlation IDs per request; compatible with pino, winston
- **Field Security** — `hidden` fields stripped at query time via `getTableColumns()`
- **Request Timeout** — built-in socket-level timeout middleware; returns `503` when a handler exceeds the configured limit
- **Health Check** — built-in `GET /health` endpoint; configurable path or disable entirely
- **Graceful Shutdown** — `listen()` returns the underlying `http.Server` for clean SIGTERM handling
- **Built-in API Docs** — Scalar interactive UI at `/docs`; fully configurable (theme, layout, info); enable with `docs: true` after installing `@scalar/express-api-reference`
- **Standardized Responses** — all endpoints return `{ success, data, meta?, error? }` OpenAPI-style envelope
- **Schema Generator** — auto-generate Drizzle TypeScript schema files from models
- **TypeScript First** — full type safety, ESM and CJS dual build

## Installation

```bash
npm install crudora drizzle-orm
# PostgreSQL
npm install pg
# or MySQL
npm install mysql2
```

After installation, Crudora sets up your project with:
- `drizzle.config.ts` template
- `src/db/schema.ts` template
- Environment configuration (`.env`)
- Basic server setup (`src/server.ts`)

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev":         "ts-node src/server.ts",
    "build":       "tsc",
    "db:generate": "drizzle-kit generate",
    "db:push":     "drizzle-kit push",
    "db:migrate":  "drizzle-kit migrate",
    "db:studio":   "drizzle-kit studio"
  }
}
```

## Quick Start

```typescript
import { CrudoraServer, Model, Field } from 'crudora';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import 'dotenv/config';

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));

class User extends Model {
  static schema    = 'auth';           // PostgreSQL schema (optional)
  static tableName = 'users';
  static hidden    = ['password'];

  @Field({ type: 'uuid', primary: true })
  id!: string;

  @Field({ type: 'string', required: true, unique: true, length: 255 })
  email!: string;

  @Field({ type: 'string', required: true })
  password!: string;

  static async beforeCreate(data: any) {
    data.password = await hashPassword(data.password);
    return data;
  }

  static async afterCreate(_data: any, result: any) {
    await sendWelcomeEmail(result.email);
    return result;
  }
}

const server = new CrudoraServer({
  db,
  dialect:     'postgresql',
  port:        3000,
  timeout:     30_000,   // 503 after 30 s with no response
  healthCheck: true,     // GET /health → { status: 'ok' }
  // docs: true,         // GET /docs → Scalar UI (requires @scalar/express-api-reference)
});

const httpServer = server
  .registerModel(User)
  .generateRoutes()
  .listen();

// Graceful shutdown
process.on('SIGTERM', () => httpServer.close(() => process.exit(0)));
```

## Generated API Endpoints

For each registered model, Crudora automatically generates:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/{tableName}` | List all with offset or cursor pagination |
| `GET` | `/api/{tableName}/:id` | Get by ID |
| `POST` | `/api/{tableName}` | Create — returns `201` |
| `PUT` | `/api/{tableName}/:id` | Full replace — all required fields must be provided |
| `PATCH` | `/api/{tableName}/:id` | Partial update — any subset of fields |
| `DELETE` | `/api/{tableName}/:id` | Delete — returns `204 No Content` |

### Response Envelope

All endpoints return a consistent JSON envelope:

```json
// Success (list)
{
  "success": true,
  "data": [{ "id": "uuid", "email": "john@example.com" }],
  "meta": {
    "pagination": { "page": 1, "limit": 10, "total": 42, "pages": 5 }
  }
}

// Success (single)
{ "success": true, "data": { "id": "uuid", "email": "john@example.com" } }

// Error
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}

// Validation error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "email", "message": "Invalid email" }]
  }
}
```

### Query Parameters (GET list)

| Param | Example | Description |
|---|---|---|
| `page` | `?page=2` | Page number (offset pagination, default: `1`) |
| `limit` | `?limit=20` | Records per page (default: `10`, max: `1000`) |
| `orderBy` | `?orderBy=name,createdAt` | Sort fields (comma-separated) |
| `order` | `?order=asc,desc` | Sort directions (comma-separated) |
| `cursor` | `?cursor=base64...` | Cursor for cursor-based pagination |
| `cursorField` | `?cursorField=createdAt` | Field to use as cursor (default: primary key) |
| `select` | `?select=id,name,email` | Return only specified fields |
| `with` | `?with=posts,profile` | Load relations (max 5) |
| `withDeleted` | `?withDeleted=true` | Include soft-deleted records |
| `{field}` | `?name=John` | Equality filter |
| `{field}_gt` | `?age_gt=18` | Greater than |
| `{field}_gte` | `?age_gte=18` | Greater than or equal |
| `{field}_lt` | `?createdAt_lt=2025-01-01` | Less than |
| `{field}_lte` | `?createdAt_lte=2025-01-01` | Less than or equal |
| `{field}_ne` | `?status_ne=deleted` | Not equal |
| `{field}_like` | `?name_like=john` | LIKE `%john%` (case-sensitive) |
| `{field}_in` | `?status_in=active,pending` | IN list (comma-separated) |

## Multiple Schema Support

```typescript
class User extends Model {
  static schema    = 'auth';     // → pgSchema('auth').table('users', ...)
  static tableName = 'users';
}

class AuditLog extends Model {
  static schema    = 'audit';   // → pgSchema('audit').table('audit_logs', ...)
  static tableName = 'audit_logs';
}

class Post extends Model {
  // No schema → pgTable('posts', ...) (default public schema)
  static tableName = 'posts';
}
```

## `@Field()` Decorator

Columns are defined with `@Field()`. Crudora reads this metadata to auto-build Drizzle table objects at registration time.

```typescript
import { Model, Field } from 'crudora';

class Product extends Model {
  static tableName = 'products';

  @Field({ type: 'serial', primary: true })
  id!: number;

  @Field({ type: 'string', required: true, length: 200 })
  name!: string;

  @Field({ type: 'enum', enumValues: ['draft', 'published', 'archived'] })
  status!: string;

  @Field({ type: 'decimal', precision: 10, scale: 2, required: true })
  price!: string;

  @Field({ type: 'integer' })
  stock!: number;

  @Field({ type: 'boolean' })
  isActive!: boolean;

  @Field({ type: 'json' })
  metadata!: object;

  @Field({ type: 'array' })
  tags!: string[];
}
```

### Supported Field Types

| `type` | PostgreSQL | MySQL | Notes |
|---|---|---|---|
| `uuid` | `uuid` | `varchar(36)` | |
| `string` | `varchar(length)` | `varchar(length)` | Zod enforces `max(length)` |
| `text` | `text` | `text` | |
| `integer` | `integer` | `int` | |
| `number` | `doublePrecision` | `double` | |
| `boolean` | `boolean` | `boolean` | |
| `date` | `timestamp` | `datetime` | |
| `decimal` | `decimal(p, s)` | `decimal(p, s)` | |
| `json` | `json` | `json` | |
| `enum` | `text` + Zod enum | `mysqlEnum` | Requires `enumValues` |
| `bigint` | `bigint` (mode: number) | `bigint` (mode: number) | |
| `serial` | `serial` (auto-increment) | `int().autoincrement()` | DB-managed, skip in API |
| `array` | `text[]` | — (use `json`) | PostgreSQL only |

> **Note on `enum` in PostgreSQL:** The column is stored as `text`. Enum values are enforced by Zod at the API layer. MySQL uses a native `ENUM` column.

### Field Options

| Option | Type | Description |
|---|---|---|
| `type` | `FieldType` | Column type (required) |
| `primary` | `boolean` | Primary key — excluded from API validation |
| `required` | `boolean` | NOT NULL constraint + required in Zod |
| `nullable` | `boolean` | Column allows NULL; Zod accepts `null` values |
| `unique` | `boolean` | UNIQUE constraint |
| `length` | `number` | Max length for `string` — enforced by Zod |
| `precision` | `number` | Decimal precision (default: 10) |
| `scale` | `number` | Decimal scale (default: 2) |
| `default` | `any` | Column default value |
| `enumValues` | `string[]` | Required for `enum` type |

## Soft Delete

```typescript
class Post extends Model {
  static tableName  = 'posts';
  static softDelete = true;     // adds deletedAt column

  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'string' }) title!: string;
}

// DELETE /api/posts/:id → sets deletedAt (soft delete)
// GET /api/posts         → excludes soft-deleted records by default
// GET /api/posts?withDeleted=true → includes soft-deleted records

const repo = crudora.getRepository(Post);
await repo.restore('uuid');        // restore a soft-deleted record
await repo.hardDelete('uuid');     // permanently delete
```

## Relations

```typescript
import { HasMany, BelongsTo } from 'crudora';

class User extends Model {
  static tableName = 'users';

  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'string' }) name!: string;

  @HasMany(() => Post, 'authorId')
  posts?: Post[];
}

class Post extends Model {
  static tableName = 'posts';

  @Field({ type: 'uuid', primary: true }) id!: string;
  @Field({ type: 'string' }) title!: string;
  @Field({ type: 'uuid' }) authorId!: string;

  @BelongsTo(() => User, 'authorId')
  author?: User;
}

// Load with relations
// GET /api/users?with=posts
// GET /api/posts?with=author

// Or via repository
const users = await userRepo.findAll({ with: ['posts'] });
const post  = await postRepo.findById('uuid', { with: ['author'] });
```

## Lifecycle Hooks

```typescript
class User extends Model {
  static async beforeCreate(data: any) {
    data.password = await hashPassword(data.password);
    return data;
  }

  static async afterCreate(_data: any, result: any) {
    await sendWelcomeEmail(result.email);
    return result;
  }

  // Called once after createMany() — use for bulk side effects
  static async afterCreateMany(records: any[]) {
    await sendBulkWelcomeEmails(records.map(r => r.email));
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
    return options;
  }

  static async afterFind(results: any[]) {
    return results.map(u => ({ ...u, displayName: u.name }));
  }
}
```

> **`afterCreate` vs `afterCreateMany`:** `afterCreate` is called for each individual `create()`. `afterCreateMany` is called once with all records after `createMany()`. This is intentional — calling `afterCreate` N times in a batch defeats the performance benefit of bulk insert.

## Using Repositories

```typescript
const crudora = server.getCrudora();
const userRepo = crudora.getRepository(User);

// Create
const user = await userRepo.create({ email: 'john@example.com', password: 'plain' });

// Bulk insert
const users = await userRepo.createMany([
  { email: 'alice@example.com', password: '...' },
  { email: 'bob@example.com',   password: '...' },
]);

// Find
const user   = await userRepo.findById('uuid');
const users  = await userRepo.findAll({ skip: 0, take: 10, where: { isActive: 'true' } });
const first  = await userRepo.findOne({ email: 'john@example.com' });
const exists = await userRepo.exists({ email: 'john@example.com' });
const total  = await userRepo.count({ isActive: 'true' });

// Cursor pagination
const page1 = await userRepo.findWithCursor({ take: 10 });
const page2 = await userRepo.findWithCursor({ take: 10, cursor: page1.nextCursor });

// Update / Delete
const updated = await userRepo.update('uuid', { name: 'Jane' });
await userRepo.delete('uuid');

// Transactions
await userRepo.transaction(async (trx) => {
  const user = await trx.create({ email: 'alice@example.com', password: '...' });
  await postTrxRepo.create({ title: 'Hello', authorId: user.id });
});
```

## Logging

By default, Crudora writes structured JSON to the console for request errors:

```json
{"level":"error","time":"2025-01-01T00:00:00.000Z","msg":"POST request failed","path":"/api/users","correlationId":"uuid-...","error":"Duplicate key"}
```

Every request automatically gets a unique **correlation ID** (`req.correlationId`) that appears in all log entries for that request.

### Custom Logger

Pass any object with `error`, `warn`, `info`, `debug` methods:

```typescript
import pino from 'pino';

const logger = pino();

const server = new CrudoraServer({
  db,
  dialect: 'postgresql',
  logger: {
    error: (msg, ctx) => logger.error(ctx, msg),
    warn:  (msg, ctx) => logger.warn(ctx, msg),
    info:  (msg, ctx) => logger.info(ctx, msg),
    debug: (msg, ctx) => logger.debug(ctx, msg),
  },
});

// Or disable logging entirely
const server = new CrudoraServer({ db, dialect: 'postgresql', logger: false });
```

## Schema Generation

```typescript
const schema = server.getCrudora().generateDrizzleSchema();
console.log(schema);
// → TypeScript file ready for drizzle-kit
```

Example output:

```typescript
// Auto-generated by Crudora — do not edit manually
import { pgTable, pgSchema, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

const authSchema = pgSchema('auth');

export const usersTable = authSchema.table('users', {
  id:        uuid('id').primaryKey(),
  email:     varchar('email', { length: 255 }).notNull().unique(),
  password:  varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});
```

Or use the CLI:

```bash
npx crudora generate-schema --entry src/server.ts --output src/db/schema.ts
```

## Custom Routes

```typescript
server
  .post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const userRepo = server.getCrudora().getRepository(User);
    // includeHidden: true bypasses static hidden so the password hash is readable
    const row = await userRepo.findOne({ email }, { includeHidden: true });
    if (!row || !verifyPassword(password, (row as any).password)) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    }
    const { password: _pw, ...safeUser } = row as any;
    res.json({ success: true, data: { token: generateJWT(safeUser) } });
  });
```

## Authentication

Crudora has no built-in auth by design — strategies differ too much across projects. Use standard Express middleware instead.

**Protect all auto-generated routes:**

```typescript
// Mount before generateRoutes() — every /api/* route will require a valid JWT
server.getApp().use('/api', verifyJWT);

server.registerModel(User, Post).generateRoutes().listen();
```

**Add a login route** (note: `findOne()` strips `hidden` fields — pass `{ includeHidden: true }` to bypass):

```typescript
server.post('/auth/login', async (req, res) => {
  const userRepo = server.getCrudora().getRepository(User);

  // includeHidden: true bypasses static hidden so the password hash is readable
  const row = await userRepo.findOne({ email: req.body.email }, { includeHidden: true });

  if (!row || !verifyPassword(req.body.password, (row as any).password)) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  const { password: _pw, ...safeUser } = row as any;
  res.json({ success: true, data: { token: generateJWT(safeUser) } });
});
```

See the [Authentication Guide](./docs/authentication.md) for register, per-route middleware, role guards, and a full JWT example.

## API Documentation (Scalar)

Crudora can serve an interactive API reference powered by [Scalar](https://scalar.com) — auto-generated from your registered models.

**1. Install the peer dependency:**

```bash
npm install @scalar/express-api-reference
```

**2. Enable `docs` in your server config:**

```typescript
const server = new CrudoraServer({
  db,
  dialect: 'postgresql',
  docs: true, // → GET /docs (UI) + GET /docs/openapi.json (spec)
});
```

**3. Customize as needed:**

```typescript
docs: {
  path: '/docs',           // custom mount path, e.g. '/api-docs'
  title: 'My API',         // shown in Scalar UI header
  version: '1.0.0',
  description: 'Full description of what this API does.',
  scalar: {                // any @scalar/express-api-reference option
    theme: 'purple',       // 'default' | 'alternate' | 'moon' | 'purple' | ...
    darkMode: true,
    layout: 'classic',     // 'modern' (default) | 'classic'
  },
},
```

The raw OpenAPI 3.0 spec is always available at `{path}/openapi.json` — useful for importing into Postman, Insomnia, or other tooling even without the UI package installed.

> If `@scalar/express-api-reference` is not installed and `docs` is enabled, Crudora logs a warning and serves a plain install-prompt page. The spec endpoint is unaffected.

## Project Setup

```bash
# Install dependencies
npm install drizzle-orm pg
npm install -D drizzle-kit typescript ts-node

# Update .env with your DATABASE_URL

# Push schema to database
npx drizzle-kit push

# Start development server
npx ts-node src/server.ts
```

## Documentation

- [API Reference](./docs/api.md)
- [Model Definition Guide](./docs/models.md)
- [Custom Routes](./docs/custom-routes.md)
- [Authentication Guide](./docs/authentication.md)
- [Deployment Guide](./docs/deployment.md)
- [API Documentation (Scalar)](#api-documentation-scalar)

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT © [Muhammad Surya J](https://suryamsj.my.id)
