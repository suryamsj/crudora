# API Reference

## Crudora Class

### Constructor

```typescript
new Crudora(db: any, dialect: 'postgresql' | 'mysql', logger?: CrudoraLogger)
```

Creates a new Crudora instance.

**Parameters:**
- `db` — Drizzle db instance (e.g. `drizzle(pool)`)
- `dialect` — `'postgresql'` or `'mysql'`
- `logger` — optional; custom logger implementing `CrudoraLogger`. Omit to use no logging.

**Throws** if `db` is not provided.

### Methods

#### registerModel(...modelClasses)

Registers one or more model classes. For each class, builds a Drizzle table object from `@Field()` metadata (respecting `static schema` for multi-schema support) and creates a `Repository`.

```typescript
crudora.registerModel(User, Post, Comment)
```

**Returns:** `this`

#### getRepository\<T\>(modelClass)

Returns the `Repository` for a registered model.

```typescript
const userRepo = crudora.getRepository(User)
```

**Throws** if the model was not registered.

**Returns:** `Repository<T>`

#### generateDrizzleSchema()

Generates a TypeScript Drizzle schema file as a string from all registered models. The output can be saved to `src/db/schema.ts` and used with `drizzle-kit`.

```typescript
const schema = crudora.generateDrizzleSchema()
console.log(schema)
```

**Returns:** `string` — ready-to-use TypeScript Drizzle schema

#### generateOpenApiSpec(basePath?, info?)

Generates an OpenAPI 3.0 spec object from all registered models. The spec is used internally by the built-in `docs` endpoint and can be consumed directly for custom tooling.

```typescript
const spec = crudora.generateOpenApiSpec('/api', {
  title: 'My API',
  version: '2.0.0',
  description: 'Optional description',
})
```

**Parameters:**
- `basePath` — optional, defaults to `'/api'`
- `info` — optional `{ title?, version?, description? }`

**Returns:** `Record<string, any>` — OpenAPI 3.0 JSON-serializable object

---

#### getValidationSchema\<T\>(modelClass)

Returns a **partial** Zod schema derived from `static fillable`. Used internally by **PATCH** routes (partial update — all fields optional).

```typescript
const schema = crudora.getValidationSchema(User)
```

**Returns:** `z.ZodType<Partial<T>>`

#### getStrictValidationSchema\<T\>(modelClass)

Returns a **strict** Zod schema requiring all `required` fillable fields. Used internally by **POST** and **PUT** routes.

```typescript
const schema = crudora.getStrictValidationSchema(User)
```

**Returns:** `z.ZodType<T>`

#### Custom Route Methods

Add custom routes that are registered alongside auto-generated CRUD routes.

```typescript
crudora.get(path, handler)
crudora.post(path, handler)
crudora.put(path, handler)
crudora.delete(path, handler)
crudora.patch(path, handler)
```

**Returns:** `this`

#### generateRoutes(app, basePath?)

Mounts all CRUD routes and custom routes on an Express app.

```typescript
crudora.generateRoutes(app, '/api/v1')
```

**Parameters:**
- `app` — Express application instance
- `basePath` — optional, defaults to `'/api'`

---

## CrudoraServer Class

### Constructor

```typescript
new CrudoraServer(config: CrudoraServerConfig)
```

```typescript
interface CrudoraServerConfig {
  db: any;                              // Drizzle db instance (required)
  dialect: 'postgresql' | 'mysql';      // (required)
  port?: number;                        // default: 3000
  cors?: boolean | string | string[];   // default: true (allow all origins)
  bodyParser?: boolean;                 // default: true
  bodyParserLimit?: string | number;    // default: '100kb'
  basePath?: string;                    // default: '/api'
  logger?: CrudoraLogger | false;       // default: built-in structured JSON logger
  rateLimit?: RateLimitConfig | false;  // default: 100 req/min per IP
  timeout?: number;                     // socket timeout in ms; 503 on expiry. default: 0 (disabled)
  healthCheck?: boolean | string;       // default: true → GET /health; string = custom path; false = disabled
  docs?: boolean | string;              // default: false; true → GET /docs (Scalar UI); string = custom path
}

interface RateLimitConfig {
  windowMs?: number;                    // sliding-window duration ms. default: 60_000
  max?: number;                         // max requests per window per key. default: 100
  message?: string;                     // 429 message. default: 'Too many requests'
  keyGenerator?: (req: any) => string;  // default: req.ip
}
```

**`cors` options:**
- `true` — allow all origins
- `false` — disable CORS middleware
- `'https://example.com'` — allow a specific origin
- `['https://a.com', 'https://b.com']` — allow multiple origins

**`bodyParserLimit` options:**
- `'100kb'` (default) — 100 kilobytes
- `'5mb'` — 5 megabytes (for bulk payloads)
- `102400` — raw bytes

**`logger` options:**
- omitted / `undefined` — uses the built-in structured JSON logger (logs to `console`)
- `CrudoraLogger` — use a custom logger (e.g. pino, winston)
- `false` — disable all logging

**`rateLimit` options:**
- omitted / `undefined` — enabled with 100 requests per minute per IP
- `RateLimitConfig` — custom window / limit / key function
- `false` — disable rate limiting (e.g. when an upstream proxy handles it)

> **Multi-instance note:** The built-in rate limiter is in-memory and per-process. Behind a load balancer each instance tracks its own counter independently. Use a Redis-backed limiter and set `rateLimit: false` for distributed deployments.

Rate-limited responses include standard headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1720000000   ← Unix timestamp (seconds)
Retry-After: 60                 ← only on 429
```

**`timeout` options:**
- `0` (default) — no timeout; handlers may run indefinitely
- `30_000` — terminate the request with `503 Request timed out` after 30 seconds

**`healthCheck` options:**
- `true` (default) — mount `GET /health` returning `{ success: true, data: { status: 'ok', timestamp } }`
- `'/healthz'` — mount on a custom path
- `false` — disable entirely

**`docs` options:**
- `false` (default) — disabled
- `true` — mount Scalar UI at `GET /docs` and raw spec at `GET /docs/openapi.json`
- `'/api-docs'` — custom base path (same behaviour, different mount point)
- `DocsConfig` — full control over path, OpenAPI info fields, and Scalar UI options

```typescript
docs: {
  path: '/docs',         // where UI and spec are served
  title: 'My API',      // OpenAPI info.title
  version: '2.0.0',     // OpenAPI info.version
  description: '...',   // OpenAPI info.description
  scalar: {             // forwarded directly to @scalar/express-api-reference
    theme: 'purple',
    darkMode: true,
    layout: 'classic',
  },
}
```

> **Requires `@scalar/express-api-reference`** — install it separately:
> ```bash
> npm install @scalar/express-api-reference
> ```
> If the package is not installed and `docs` is enabled, Crudora logs a warning and serves a plain install-prompt page at the docs path. The `/openapi.json` spec endpoint is always served regardless.

### Methods

#### registerModel(...modelClasses)

```typescript
server.registerModel(User, Post)
```

**Returns:** `this`

#### generateRoutes()

```typescript
server.generateRoutes()
```

**Returns:** `this`

#### use(middleware)

Adds middleware to the Express application.

```typescript
server.use(cors())
```

**Returns:** `this`

#### listen(callback?)

Starts the HTTP server and returns the underlying `http.Server` instance.

```typescript
const httpServer = server.listen(() => console.log('Server started'));

// Graceful shutdown
process.on('SIGTERM', () => httpServer.close(() => process.exit(0)));
```

**Returns:** `http.Server`

#### getHttpServer()

Returns the `http.Server` instance after `listen()` has been called, or `null` before.

```typescript
const httpServer = server.getHttpServer(); // null before listen()
server.listen();
const httpServer = server.getHttpServer(); // http.Server after listen()
```

**Returns:** `http.Server | null`

#### getTable(modelClass)

Returns the Drizzle table object for a registered model. Use when you need raw DB access to columns excluded by `static hidden` (e.g. reading a password hash in a login route).

```typescript
const usersTable = server.getTable(User);
const [row] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
```

**Throws** if the model was not registered.

**Returns:** Drizzle table object

#### getApp()

Returns the underlying Express application.

```typescript
const app = server.getApp()
```

**Returns:** `Express`

#### getCrudora()

Returns the underlying `Crudora` instance.

```typescript
const crudora = server.getCrudora()
```

**Returns:** `Crudora`

#### Custom Route Methods

```typescript
server.get(path, handler)
server.post(path, handler)
server.put(path, handler)
server.delete(path, handler)
server.patch(path, handler)
```

**Returns:** `this`

---

## Repository\<T\> Class

Constructed automatically via `registerModel()`. Access via `crudora.getRepository(ModelClass)`.

### Constructor

```typescript
new Repository(modelClass, db, table)
```

| Param | Description |
|---|---|
| `modelClass` | Model class (extends `Model`) |
| `db` | Drizzle db instance |
| `table` | Drizzle table object (built by `DrizzleTableBuilder`) |

### Methods

#### create(data)

```typescript
const user = await userRepo.create({ email: 'john@example.com', password: '...' })
```

Generates a UUID for the primary key if not provided, runs `beforeCreate` / `afterCreate` hooks, and fetches the created record back (hidden fields excluded).

**Returns:** `Promise<T>`

#### createMany(records)

```typescript
const users = await userRepo.createMany([
  { email: 'alice@example.com', password: '...' },
  { email: 'bob@example.com',   password: '...' },
])
```

Inserts multiple records in a single query. Generates UUIDs for missing primary keys. Runs `afterCreateMany` hook if defined. `beforeCreate` and `afterCreate` are **not** called per-item.

**Returns:** `Promise<T[]>`

#### findById(id, options?)

```typescript
const user = await userRepo.findById('uuid')

// Include soft-deleted records
const user = await userRepo.findById('uuid', { withDeleted: true })
```

**Returns:** `Promise<T | null>`

#### findOne(where)

```typescript
const user = await userRepo.findOne({ email: 'john@example.com' })
```

Returns the first record matching the equality filter.

**Returns:** `Promise<T | null>`

#### findAll(options?)

```typescript
const users = await userRepo.findAll({
  skip: 0,
  take: 10,
  where: { isActive: 'true' },
})
```

**Options:**
- `skip` — offset
- `take` — limit
- `where` — equality filters (plain object, each key = column name)
- `withDeleted` — include soft-deleted records (boolean)

**Returns:** `Promise<T[]>`

#### findWithCursor(options)

Cursor-based pagination for high-performance traversal of large datasets.

```typescript
const result = await userRepo.findWithCursor({
  take: 20,
  cursor: req.query.cursor as string | undefined,
  where: { isActive: 'true' },
})
// result.data    — array of records
// result.nextCursor — base64 cursor for the next page (null if no more)
```

**Returns:** `Promise<CursorResult<T>>`

#### update(id, data)

```typescript
const updated = await userRepo.update('uuid', { name: 'Jane' })
```

Runs `beforeUpdate` / `afterUpdate` hooks. Fetches the updated record back.

**Returns:** `Promise<T>`

#### delete(id)

```typescript
const deleted = await userRepo.delete('uuid')
```

For soft-delete models (`static softDelete = true`): sets `deletedAt` to the current timestamp.  
For regular models: hard-deletes the record.  
Runs `beforeDelete` / `afterDelete` hooks.

**Returns:** `Promise<T>` — the deleted record

#### hardDelete(id)

```typescript
await userRepo.hardDelete('uuid')
```

Always permanently deletes the record, even if `softDelete = true`.

**Returns:** `Promise<T>`

#### restore(id)

```typescript
await userRepo.restore('uuid')
```

Restores a soft-deleted record by clearing `deletedAt`.

**Returns:** `Promise<T>`

#### exists(where)

```typescript
const emailTaken = await userRepo.exists({ email: 'john@example.com' })
```

**Returns:** `Promise<boolean>`

#### count(where?)

```typescript
const total = await userRepo.count({ isActive: 'true' })
```

**Returns:** `Promise<number>`

#### transaction(fn)

```typescript
const result = await userRepo.transaction(async (tx) => {
  const user = await tx.insert(usersTable).values({ ... }).returning()
  return user
})
```

Runs a function inside a database transaction. `tx` is a Drizzle transaction object.

**Returns:** `Promise<R>`

---

## DrizzleTableBuilder Class

Builds a Drizzle table object at runtime from a Model class's `@Field()` decorator metadata.

```typescript
import { DrizzleTableBuilder } from 'crudora'

const table = DrizzleTableBuilder.build(User, 'postgresql')
// → pgSchema('auth').table('users', { id: uuid('id').primaryKey(), ... })
```

Respects `static schema` for multi-schema routing:
- `static schema = 'auth'` → `pgSchema('auth').table(...)`
- No schema → `pgTable(...)`

---

## Generated REST Endpoints

All responses use a consistent JSON envelope:

```json
{ "success": true,  "data": ..., "meta": ... }
{ "success": false, "error": "...", "details": [...] }
```

### GET /api/{tableName}

List all records with pagination.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default `1`) |
| `limit` | number | Records per page (default `10`) |
| `cursor` | string | Base64 cursor for cursor-based pagination |
| `sortBy` | string | Field to sort by |
| `sortOrder` | `asc` \| `desc` | Sort direction (default `asc`) |
| `withDeleted` | boolean | Include soft-deleted records |
| `{field}` | string | Equality filter (e.g. `?email=john@example.com`) |
| `{field}_gt` | string | Greater-than filter |
| `{field}_lt` | string | Less-than filter |
| `{field}_gte` | string | Greater-than-or-equal filter |
| `{field}_lte` | string | Less-than-or-equal filter |
| `{field}_like` | string | LIKE filter (SQL pattern) |
| `{field}_ne` | string | Not-equal filter |

**Response:**
```json
{
  "success": true,
  "data": [{ "id": "uuid", "email": "john@example.com" }],
  "meta": { "page": 1, "limit": 10, "total": 42, "pages": 5 }
}
```

### GET /api/{tableName}/:id

**Response:**
```json
{ "success": true, "data": { "id": "uuid", "email": "john@example.com" } }
```

Returns `404` if not found.

### POST /api/{tableName}

**Body:** JSON with fillable fields. Validated against **strict** Zod schema — all `required` fields must be present.

**Response** (`201`):
```json
{ "success": true, "data": { "id": "uuid", "email": "john@example.com" } }
```

Returns `422` on validation error.

### PUT /api/{tableName}/:id

Full replace — all `required` fields must be present. Validated against **strict** Zod schema.

**Response** (`200`):
```json
{ "success": true, "data": { "id": "uuid", "email": "jane@example.com" } }
```

Returns `422` on validation error, `404` if not found.

### PATCH /api/{tableName}/:id

Partial update — only provided fields are updated. Validated against **partial** Zod schema.

**Response** (`200`):
```json
{ "success": true, "data": { "id": "uuid", "email": "jane@example.com" } }
```

### DELETE /api/{tableName}/:id

Soft-delete or hard-delete depending on `static softDelete`.

**Response** (`200`):
```json
{ "success": true, "data": { "id": "uuid", "deletedAt": "2026-01-01T00:00:00.000Z" } }
```

Returns `404` if not found.

---

## Error Responses

### 422 Unprocessable Entity (validation error)
```json
{
  "success": false,
  "error": "Validation error",
  "details": [{ "field": "email", "message": "Required" }]
}
```

### 404 Not Found
```json
{ "success": false, "error": "Not found" }
```

### 500 Internal Server Error
```json
{ "success": false, "error": "Internal server error" }
```

---

## CrudoraLogger Interface

```typescript
interface CrudoraLogger {
  error(message: string, context?: Record<string, any>): void;
  warn(message: string,  context?: Record<string, any>): void;
  info(message: string,  context?: Record<string, any>): void;
  debug(message: string, context?: Record<string, any>): void;
}
```

The built-in default logger outputs structured JSON to `console`:

```json
{ "level": "info", "time": "2026-01-01T00:00:00.000Z", "msg": "POST /api/users", "correlationId": "uuid" }
```

Every request automatically gets a `correlationId` (UUID) attached to the log context.

**Custom logger example (pino):**

```typescript
import pino from 'pino';
const logger = pino();

new CrudoraServer({ db, dialect: 'postgresql', logger });
```

**Disable logging:**

```typescript
new CrudoraServer({ db, dialect: 'postgresql', logger: false });
```

---

**Author:** Muhammad Surya J  
**Repository:** https://github.com/suryamsj/crudora
